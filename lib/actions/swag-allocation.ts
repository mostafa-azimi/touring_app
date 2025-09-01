"use server"

import { createClient } from "@/lib/supabase/server"

interface SwagItem {
  id: string
  name: string
  quantity: number
}

interface Participant {
  id: string
  name: string
  email: string
}

export async function allocateSwagToTour(tourId: string, participantIds: string[]) {
  const supabase = await createClient()

  try {
    // Get all available swag items with quantity > 0
    const { data: swagItems, error: swagError } = await supabase
      .from("swag_items")
      .select("id, name, quantity")
      .gt("quantity", 0)
      .order("quantity", { ascending: false }) // Prioritize items with more stock

    if (swagError) throw swagError

    if (!swagItems || swagItems.length === 0) {
      return {
        success: true,
        message: "No swag items available for allocation",
        allocations: [],
      }
    }

    const allocations: Array<{
      tour_id: string
      participant_id: string
      swag_item_id: string
      quantity: number
    }> = []

    const swagUpdates: Array<{
      id: string
      quantity: number
    }> = []

    // Distribute swag items evenly among participants
    for (const swagItem of swagItems) {
      const itemsPerParticipant = Math.floor(swagItem.quantity / participantIds.length)
      const remainingItems = swagItem.quantity % participantIds.length

      if (itemsPerParticipant > 0) {
        // Give each participant the base amount
        for (const participantId of participantIds) {
          allocations.push({
            tour_id: tourId,
            participant_id: participantId,
            swag_item_id: swagItem.id,
            quantity: itemsPerParticipant,
          })
        }
      }

      // Distribute remaining items to first few participants
      for (let i = 0; i < remainingItems; i++) {
        const existingAllocation = allocations.find(
          (a) => a.participant_id === participantIds[i] && a.swag_item_id === swagItem.id,
        )

        if (existingAllocation) {
          existingAllocation.quantity += 1
        } else {
          allocations.push({
            tour_id: tourId,
            participant_id: participantIds[i],
            swag_item_id: swagItem.id,
            quantity: 1,
          })
        }
      }

      // Calculate new quantity for this swag item
      const totalAllocated = allocations
        .filter((a) => a.swag_item_id === swagItem.id)
        .reduce((sum, a) => sum + a.quantity, 0)

      swagUpdates.push({
        id: swagItem.id,
        quantity: swagItem.quantity - totalAllocated,
      })
    }

    // Insert allocations
    if (allocations.length > 0) {
      const { error: allocationError } = await supabase.from("tour_swag_allocations").insert(allocations)

      if (allocationError) throw allocationError

      // Update swag item quantities
      for (const update of swagUpdates) {
        const { error: updateError } = await supabase
          .from("swag_items")
          .update({ quantity: update.quantity })
          .eq("id", update.id)

        if (updateError) throw updateError
      }
    }

    return {
      success: true,
      message: `Successfully allocated ${allocations.length} swag items to ${participantIds.length} participants`,
      allocations,
    }
  } catch (error) {
    console.error("Error allocating swag:", error)
    return {
      success: false,
      message: "Failed to allocate swag items",
      allocations: [],
    }
  }
}

export async function getSwagAllocationPreview(participantCount: number) {
  const supabase = await createClient()

  try {
    const { data: swagItems, error } = await supabase
      .from("swag_items")
      .select("id, name, quantity")
      .gt("quantity", 0)
      .order("quantity", { ascending: false })

    if (error) throw error

    const preview = swagItems?.map((item) => {
      const itemsPerParticipant = Math.floor(item.quantity / participantCount)
      const remainingItems = item.quantity % participantCount
      const participantsGettingExtra = remainingItems

      return {
        name: item.name,
        totalAvailable: item.quantity,
        itemsPerParticipant,
        participantsGettingExtra,
        totalToAllocate: item.quantity,
      }
    })

    return {
      success: true,
      preview: preview || [],
    }
  } catch (error) {
    return {
      success: false,
      preview: [],
    }
  }
}

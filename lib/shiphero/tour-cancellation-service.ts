import { createClient } from '@/lib/supabase/client'

interface CancellationResult {
  success: boolean
  canceledOrders: string[]
  canceledPurchaseOrders: string[]
  errors: string[]
  timestamp: string
}

interface TourOrderData {
  id: string
  host_shiphero_sales_order_id?: string
  shiphero_purchase_order_id?: string
  participants: Array<{
    id: string
    name: string
    shiphero_sales_order_id?: string
  }>
}

export class TourCancellationService {
  private supabase
  private shipHero: any

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Initialize ShipHero client with fresh access token
   */
  private async initializeShipHero(): Promise<void> {
    console.log('🔌 Initializing ShipHero client for cancellation...')
    
    // Get access token from localStorage
    const accessToken = localStorage.getItem('shiphero_access_token')
    
    if (!accessToken) {
      throw new Error('No ShipHero access token available. Please generate a new access token first.')
    }

    // Import ShipHero client dynamically to avoid SSR issues
    const { GraphQLClient } = await import('graphql-request')
    
    this.shipHero = new GraphQLClient('https://public-api.shiphero.com/graphql', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    
    console.log('✅ ShipHero client initialized for cancellation')
  }

  /**
   * Cancel a sales order in ShipHero
   */
  private async cancelSalesOrder(orderId: string): Promise<boolean> {
    const mutation = `
      mutation CancelOrder($orderId: String!) {
        order_cancel(data: { order_id: $orderId }) {
          request_id
          complexity
          order {
            id
            fulfillment_status
          }
        }
      }
    `

    try {
      console.log(`🚫 Canceling sales order: ${orderId}`)
      const result = await this.shipHero.request(mutation, { orderId })
      
      if (result.order_cancel?.order?.id) {
        console.log(`✅ Successfully canceled sales order: ${orderId}`)
        return true
      } else {
        console.error(`❌ Failed to cancel sales order: ${orderId}`, result)
        return false
      }
    } catch (error: any) {
      console.error(`❌ Error canceling sales order ${orderId}:`, error)
      return false
    }
  }

  /**
   * Cancel a purchase order in ShipHero
   */
  private async cancelPurchaseOrder(purchaseOrderId: string): Promise<boolean> {
    const mutation = `
      mutation CancelPurchaseOrder($purchaseOrderId: String!) {
        purchase_order_cancel(
          id: $purchaseOrderId
        ) {
          request_id
          purchase_order {
            id
            status
          }
        }
      }
    `

    try {
      console.log(`🚫 Canceling purchase order: ${purchaseOrderId}`)
      const result = await this.shipHero.request(mutation, { purchaseOrderId })
      
      if (result.purchase_order_cancel?.purchase_order?.id) {
        console.log(`✅ Successfully canceled purchase order: ${purchaseOrderId}`)
        return true
      } else {
        console.error(`❌ Failed to cancel purchase order: ${purchaseOrderId}`, result)
        return false
      }
    } catch (error: any) {
      console.error(`❌ Error canceling purchase order ${purchaseOrderId}:`, error)
      return false
    }
  }

  /**
   * Get tour data with all associated order IDs
   */
  private async getTourOrderData(tourId: string): Promise<TourOrderData> {
    console.log(`🔍 Fetching tour order data for: ${tourId}`)

    const { data: tour, error: tourError } = await this.supabase
      .from('tours')
      .select(`
        id,
        host_shiphero_sales_order_id,
        shiphero_purchase_order_id,
        tour_participants (
          id,
          name,
          shiphero_sales_order_id
        )
      `)
      .eq('id', tourId)
      .single()

    if (tourError) {
      throw new Error(`Failed to fetch tour data: ${tourError.message}`)
    }

    console.log(`✅ Found tour with ${tour.tour_participants?.length || 0} participants`)
    
    return {
      id: tour.id,
      host_shiphero_sales_order_id: tour.host_shiphero_sales_order_id,
      shiphero_purchase_order_id: tour.shiphero_purchase_order_id,
      participants: tour.tour_participants || []
    }
  }

  /**
   * Cancel entire tour - all orders and purchase orders
   */
  async cancelTour(tourId: string): Promise<CancellationResult> {
    console.log(`🚫 Starting tour cancellation for: ${tourId}`)
    
    const result: CancellationResult = {
      success: false,
      canceledOrders: [],
      canceledPurchaseOrders: [],
      errors: [],
      timestamp: new Date().toISOString()
    }

    try {
      // Initialize ShipHero client
      await this.initializeShipHero()

      // Get tour data with all order IDs
      const tourData = await this.getTourOrderData(tourId)

      // Cancel host sales order if it exists
      if (tourData.host_shiphero_sales_order_id) {
        const canceled = await this.cancelSalesOrder(tourData.host_shiphero_sales_order_id)
        if (canceled) {
          result.canceledOrders.push(tourData.host_shiphero_sales_order_id)
        } else {
          result.errors.push(`Failed to cancel host sales order: ${tourData.host_shiphero_sales_order_id}`)
        }
      }

      // Cancel all participant sales orders
      for (const participant of tourData.participants) {
        if (participant.shiphero_sales_order_id) {
          const canceled = await this.cancelSalesOrder(participant.shiphero_sales_order_id)
          if (canceled) {
            result.canceledOrders.push(participant.shiphero_sales_order_id)
          } else {
            result.errors.push(`Failed to cancel sales order for ${participant.name}: ${participant.shiphero_sales_order_id}`)
          }
        }
      }

      // Cancel purchase order if it exists
      if (tourData.shiphero_purchase_order_id) {
        const canceled = await this.cancelPurchaseOrder(tourData.shiphero_purchase_order_id)
        if (canceled) {
          result.canceledPurchaseOrders.push(tourData.shiphero_purchase_order_id)
        } else {
          result.errors.push(`Failed to cancel purchase order: ${tourData.shiphero_purchase_order_id}`)
        }
      }

      // Update tour status in database
      const { error: updateError } = await this.supabase
        .from('tours')
        .update({ 
          canceled_at: result.timestamp,
          status: 'canceled'
        })
        .eq('id', tourId)

      if (updateError) {
        result.errors.push(`Failed to update tour status: ${updateError.message}`)
      }

      // Determine overall success
      const totalExpectedCancellations = 
        (tourData.host_shiphero_sales_order_id ? 1 : 0) +
        tourData.participants.filter(p => p.shiphero_sales_order_id).length +
        (tourData.shiphero_purchase_order_id ? 1 : 0)

      const totalSuccessfulCancellations = result.canceledOrders.length + result.canceledPurchaseOrders.length

      result.success = totalSuccessfulCancellations > 0 && result.errors.length === 0

      console.log(`🏁 Tour cancellation complete:`, {
        tourId,
        expectedCancellations: totalExpectedCancellations,
        successfulCancellations: totalSuccessfulCancellations,
        errors: result.errors.length,
        success: result.success
      })

      return result

    } catch (error: any) {
      console.error('❌ Tour cancellation failed:', error)
      result.errors.push(error.message)
      return result
    }
  }
}

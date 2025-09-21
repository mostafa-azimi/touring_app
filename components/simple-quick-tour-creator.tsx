"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

export function SimpleQuickTourCreator() {
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleCreateTour = async () => {
    console.log("👆 BUTTON CLICKED: Create Sample Tour button was clicked")
    setIsCreating(true)
    
    try {
      console.log("🚀 Starting Quick Tour creation process...")
      
      // Create a sample tour with pre-configured settings
      const tourData = {
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        time: "09:00:00",
        warehouse_id: "c3b5019f-726e-4d8b-8439-004ad82e8306", // Default warehouse
        host_id: "b60f2af5-dfbb-403c-b1c5-951a7f50a6f7", // Default host
        selected_workflows: ["standard_receiving", "bulk_shipping", "multi_item_batch"],
        selected_skus: ["PB_Crackers", "Cheese_crackers", "Blue Raspberry Airhead", "Watermelon Airhead", "Sour Watermelon Airhead"],
        workflow_configs: {
          standard_receiving: {
            skuQuantities: {
              "PB_Crackers": 5,
              "Cheese_crackers": 3,
              "Blue Raspberry Airhead": 10,
              "Watermelon Airhead": 7,
              "Sour Watermelon Airhead": 2
            }
          },
          bulk_shipping: {
            orderCount: 5,
            skuQuantities: {
              "PB_Crackers": 1,
              "Cheese_crackers": 1
            }
          },
          multi_item_batch: {
            orderCount: 3,
            skuQuantities: {
              "Blue Raspberry Airhead": 1,
              "Watermelon Airhead": 1,
              "Sour Watermelon Airhead": 1
            }
          }
        }
      }
      
      console.log("📋 Creating tour with data:", tourData)
      
      // Insert the tour into the database
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .insert([tourData])
        .select()
        .single()
      
      if (tourError) {
        console.error("❌ Error creating tour:", tourError)
        throw tourError
      }
      
      console.log("✅ Tour created successfully:", tour)
      
      toast({
        title: "🎉 Quick Tour Created!",
        description: `Sample tour created for ${tourData.date}. You can now finalize it to create orders.`,
      })
      
      // Refresh the page to show the new tour
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (error: any) {
      console.error("❌ Failed to create quick tour:", error)
      toast({
        title: "❌ Error Creating Tour",
        description: `Failed to create sample tour: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">🚀 Quick Tour Creator</h2>
        <p className="text-muted-foreground">Create a complete tour with sample orders instantly</p>
        
        <Button 
          size="lg" 
          className="px-6 py-6 text-lg"
          onClick={handleCreateTour}
          disabled={isCreating}
        >
          {isCreating ? "Creating Tour..." : "Create Sample Tour"}
        </Button>
        
        <div className="text-sm text-muted-foreground">
          <p>This will create:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>1 Purchase Order (5 SKUs, random quantities 1-25)</li>
            <li>10 Multi-item Batch Orders (2-4 SKUs each, max 2 units per SKU)</li>
            <li>10 Single-item Batch Orders (1 SKU each)</li>
            <li>25 Bulk Ship Orders (identical orders)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

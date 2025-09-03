import { createShipHeroClient } from './client'
import { createClient } from '@/lib/supabase/client'
import { ShipHeroOrderService } from './order-service'

export interface TourData {
  id: string
  host: {
    id: string
    name: string
    first_name: string
    last_name: string
  }
  participants: Array<{
    id: string
    name: string
    first_name: string
    last_name: string
    email: string
    company: string
    title: string
  }>
  warehouse: {
    id: string
    name: string
    address: any
    shiphero_warehouse_id: string
  }
}

export type WorkflowOption = 
  | "receive_to_light" 
  | "pack_to_light" 
  | "standard_receiving" 
  | "bulk_shipping" 
  | "single_item_batch" 
  | "multi_item_batch"

export class TourFinalizationService {
  private supabase
  private orderService: ShipHeroOrderService
  private shipHero: any

  constructor() {
    this.supabase = createClient()
    this.orderService = new ShipHeroOrderService()
  }

  /**
   * Get a fresh access token and initialize ShipHero client
   */
  private async initializeShipHero(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Tour finalization service must be used in browser environment.')
    }

    const refreshToken = localStorage.getItem('shiphero_refresh_token')
    
    if (!refreshToken) {
      throw new Error('ShipHero refresh token is required. Please configure it in Settings → ShipHero tab.')
    }

    const tokenResponse = await fetch('/api/shiphero/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to get ShipHero access token. Please check your refresh token in Settings.')
    }

    const tokenData = await tokenResponse.json()
    this.shipHero = createShipHeroClient(tokenData.access_token)
  }

  /**
   * Fetch tour details including host, participants, and warehouse info
   */
  async getTourDetails(tourId: string): Promise<TourData> {
    const { data: tour, error: tourError } = await this.supabase
      .from('tours')
      .select(`
        id,
        warehouse_id,
        host_id,
        warehouses (
          id,
          name,
          address,
          shiphero_warehouse_id
        ),
        hosts (
          id,
          name,
          first_name,
          last_name
        )
      `)
      .eq('id', tourId)
      .single()

    if (tourError) throw new Error(`Failed to fetch tour: ${tourError.message}`)

    const { data: participants, error: participantsError } = await this.supabase
      .from('tour_participants')
      .select('id, name, first_name, last_name, email, company, title')
      .eq('tour_id', tourId)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    return {
      id: tour.id,
      host: {
        id: tour.hosts.id,
        name: tour.hosts.name,
        first_name: tour.hosts.first_name,
        last_name: tour.hosts.last_name
      },
      participants: participants || [],
      warehouse: {
        id: tour.warehouses.id,
        name: tour.warehouses.name,
        address: tour.warehouses.address,
        shiphero_warehouse_id: tour.warehouses.shiphero_warehouse_id
      }
    }
  }

  /**
   * Update tour status in the database
   */
  async updateTourStatus(tourId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('tours')
      .update({ status })
      .eq('id', tourId)

    if (error) throw new Error(`Failed to update tour status: ${error.message}`)
  }

  /**
   * Main controller for tour finalization
   */
  async finalizeTour(tourId: string, selectedOptions: WorkflowOption[]): Promise<{
    success: boolean
    message: string
    errors: string[]
  }> {
    console.log(`Finalizing tour ${tourId} with options:`, selectedOptions)
    
    const errors: string[] = []

    try {
      await this.initializeShipHero()
      
      // Fetch tour details once at the beginning
      const tourData = await this.getTourDetails(tourId)

      // Logic Block 1: "As-Is" Workflow
      if (selectedOptions.includes("receive_to_light") || selectedOptions.includes("pack_to_light")) {
        try {
          await this.createAsIsWorkflowOrders(tourData)
        } catch (error) {
          const errorMsg = `As-Is Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Logic Block 2: "Standard Receiving" PO
      if (selectedOptions.includes("standard_receiving")) {
        try {
          await this.createStandardReceivingPO(tourData)
        } catch (error) {
          const errorMsg = `Standard Receiving PO failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Logic Block 3: "Bulk Shipping" SOs
      if (selectedOptions.includes("bulk_shipping")) {
        try {
          await this.createBulkShippingSOs(tourData)
        } catch (error) {
          const errorMsg = `Bulk Shipping SOs failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Logic Block 4: "Single-Item Batch" SOs
      if (selectedOptions.includes("single_item_batch")) {
        try {
          await this.createSingleItemBatchSOs(tourData)
        } catch (error) {
          const errorMsg = `Single-Item Batch SOs failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Logic Block 5: "Multi-Item Batch" SOs
      if (selectedOptions.includes("multi_item_batch")) {
        try {
          await this.createMultiItemBatchSOs(tourData)
        } catch (error) {
          const errorMsg = `Multi-Item Batch SOs failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Update tour status to finalized
      await this.updateTourStatus(tourId, "finalized")

      const successMessage = errors.length > 0 
        ? `Tour finalized with ${errors.length} workflow error(s)`
        : "Tour finalized successfully with all selected workflows"

      return {
        success: errors.length === 0,
        message: successMessage,
        errors
      }

    } catch (error) {
      const errorMsg = `Tour finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      return {
        success: false,
        message: errorMsg,
        errors: [errorMsg, ...errors]
      }
    }
  }

  /**
   * MODULE 1: Creates Sales Orders for all participants and an aggregated Purchase Order.
   * This is the original, "as-is" workflow.
   */
  private async createAsIsWorkflowOrders(tourData: TourData): Promise<void> {
    // Use the existing order service for the as-is workflow
    console.log("Executing: As-Is Workflow using existing order service")
    
    const salesResult = await this.orderService.createSalesOrdersForTour(tourData.id)
    if (!salesResult.success) {
      throw new Error(`Sales orders failed: ${salesResult.message}`)
    }

    const poResult = await this.orderService.createPurchaseOrderForTour(tourData.id)
    if (!poResult.success) {
      throw new Error(`Purchase order failed: ${poResult.message}`)
    }

    console.log("Executed: As-Is Workflow")
  }

  /**
   * MODULE 2: Creates a separate, unique Purchase Order for "Standard Receiving".
   */
  private async createStandardReceivingPO(tourData: TourData): Promise<void> {
    const poLineItems = [
      { sku: "STANDARD-RECEIVING-01", quantity: 8 },
      { sku: "STANDARD-RECEIVING-02", quantity: 5 },
      { sku: "STANDARD-RECEIVING-03", quantity: 3 },
      { sku: "STANDARD-RECEIVING-04", quantity: 1 },
      { sku: "STANDARD-RECEIVING-05", quantity: 2 },
      { sku: "STANDARD-RECEIVING-06", quantity: 4 },
    ]

    const mutation = `
      mutation CreatePurchaseOrder($data: PurchaseOrderCreateInput!) {
        purchase_order_create(data: $data) {
          request_id
          purchase_order {
            id
            legacy_id
            po_number
          }
        }
      }
    `

    const variables = {
      data: {
        po_number: `STD-RCV-${tourData.host.name}-${new Date().toISOString().slice(0, 10)}`,
        vendor_id: "1076735",
        warehouse_id: tourData.warehouse.shiphero_warehouse_id,
        line_items: poLineItems.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          expected_weight_in_lbs: "1"
        }))
      }
    }

    const result = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.shipHero.accessToken}`
      },
      body: JSON.stringify({ query: mutation, variables })
    })

    const data = await result.json()

    if (data.data?.purchase_order_create?.purchase_order) {
      console.log("Executed: Standard Receiving PO")
    } else {
      throw new Error(`Failed to create Standard Receiving PO: ${data.errors?.[0]?.message || 'Unknown error'}`)
    }
  }

  /**
   * MODULE 3: Creates a batch of 10 Sales Orders for "Bulk Shipping".
   */
  private async createBulkShippingSOs(tourData: TourData): Promise<void> {
    const orderPromises = []
    
    for (let i = 1; i <= 10; i++) {
      const mutation = `
        mutation CreateOrder($data: OrderCreateInput!) {
          order_create(data: $data) {
            request_id
            order {
              id
              legacy_id
              order_number
            }
          }
        }
      `

      const variables = {
        data: {
          order_number: `BULK-${tourData.id}-${i}`,
          shop_name: "Touring App",
          fulfillment_status: "pending",
          order_date: new Date().toISOString(),
          total_tax: "0.00",
          subtotal: "0.00",
          total_discounts: "0.00",
          total_price: "0.00",
          shipping_address: {
            first_name: `Bulk Customer ${i}`,
            last_name: "Test",
            address1: `${100 + i} Bulk St`,
            city: "Shippington",
            state: "CA",
            zip: `9021${i % 10}`,
            country: "US"
          },
          line_items: [{
            sku: "BULK-SHIP-SKU",
            quantity: 1,
            price: "0.00"
          }]
        }
      }

      const orderPromise = fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.shipHero.accessToken}`
        },
        body: JSON.stringify({ query: mutation, variables })
      }).then(response => response.json())

      orderPromises.push(orderPromise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for any failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      throw new Error(`Failed to create ${failures.length} bulk shipping orders`)
    }

    console.log("Executed: Bulk Shipping SO Batch")
  }

  /**
   * MODULE 4: Creates a batch of 5 single-item Sales Orders for "Single-Item Batch Picking".
   */
  private async createSingleItemBatchSOs(tourData: TourData): Promise<void> {
    const skusForBatch = [
      "SINGLE-ITEM-A", "SINGLE-ITEM-B", "SINGLE-ITEM-A", "SINGLE-ITEM-C", "SINGLE-ITEM-B"
    ]

    const orderPromises = []
    
    for (let i = 0; i < skusForBatch.length; i++) {
      const mutation = `
        mutation CreateOrder($data: OrderCreateInput!) {
          order_create(data: $data) {
            request_id
            order {
              id
              legacy_id
              order_number
            }
          }
        }
      `

      const variables = {
        data: {
          order_number: `SINGLE-${tourData.id}-${i + 1}`,
          shop_name: "Touring App",
          fulfillment_status: "pending",
          order_date: new Date().toISOString(),
          total_tax: "0.00",
          subtotal: "0.00",
          total_discounts: "0.00",
          total_price: "0.00",
          shipping_address: {
            first_name: `Single-Item Customer ${i + 1}`,
            last_name: "Test",
            address1: `${200 + i} Single Ave`,
            city: "Pickville",
            state: "TX",
            zip: `7500${i}`,
            country: "US"
          },
          line_items: [{
            sku: skusForBatch[i],
            quantity: 1,
            price: "0.00"
          }]
        }
      }

      const orderPromise = fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.shipHero.accessToken}`
        },
        body: JSON.stringify({ query: mutation, variables })
      }).then(response => response.json())

      orderPromises.push(orderPromise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for any failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      throw new Error(`Failed to create ${failures.length} single-item batch orders`)
    }

    console.log("Executed: Single-Item Batch SOs")
  }

  /**
   * MODULE 5: Creates a batch of 5 multi-item/SKU Sales Orders for "Multi-Item Batch Picking".
   */
  private async createMultiItemBatchSOs(tourData: TourData): Promise<void> {
    const orderDefinitions = [
      [{ sku: "MULTI-ITEM-X", quantity: 1 }, { sku: "MULTI-ITEM-Y", quantity: 2 }], // Order 1
      [{ sku: "MULTI-ITEM-Z", quantity: 1 }],                                     // Order 2
      [{ sku: "MULTI-ITEM-X", quantity: 3 }, { sku: "MULTI-ITEM-Z", quantity: 1 }], // Order 3
      [{ sku: "MULTI-ITEM-Y", quantity: 1 }, { sku: "MULTI-ITEM-A", quantity: 1 }], // Order 4
      [{ sku: "MULTI-ITEM-X", quantity: 2 }],                                     // Order 5
    ]

    const orderPromises = []
    
    for (let i = 0; i < orderDefinitions.length; i++) {
      const mutation = `
        mutation CreateOrder($data: OrderCreateInput!) {
          order_create(data: $data) {
            request_id
            order {
              id
              legacy_id
              order_number
            }
          }
        }
      `

      const variables = {
        data: {
          order_number: `MULTI-${tourData.id}-${i + 1}`,
          shop_name: "Touring App",
          fulfillment_status: "pending",
          order_date: new Date().toISOString(),
          total_tax: "0.00",
          subtotal: "0.00",
          total_discounts: "0.00",
          total_price: "0.00",
          shipping_address: {
            first_name: `Multi-Item Customer ${i + 1}`,
            last_name: "Test",
            address1: `${300 + i} Multi Rd`,
            city: "Sortburg",
            state: "FL",
            zip: `3310${i}`,
            country: "US"
          },
          line_items: orderDefinitions[i].map(item => ({
            sku: item.sku,
            quantity: item.quantity,
            price: "0.00"
          }))
        }
      }

      const orderPromise = fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.shipHero.accessToken}`
        },
        body: JSON.stringify({ query: mutation, variables })
      }).then(response => response.json())

      orderPromises.push(orderPromise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for any failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      throw new Error(`Failed to create ${failures.length} multi-item batch orders`)
    }

    console.log("Executed: Multi-Item Batch SOs")
  }
}

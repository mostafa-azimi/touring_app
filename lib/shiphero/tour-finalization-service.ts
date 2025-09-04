import { createClient } from '@/lib/supabase/client'
import { getCelebrityNames } from '@/lib/celebrity-names'

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
  selected_workflows: string[]
  selected_skus: string[]
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
  private shipHero: any

  constructor() {
    this.supabase = createClient()
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
    // Store access token for API route calls instead of direct GraphQL
    this.shipHero = { accessToken: tokenData.access_token }
  }

  /**
   * Helper method to create sales orders via Next.js API route
   */
  private async createSalesOrderViaAPI(orderData: any): Promise<any> {
    const response = await fetch('/api/shiphero/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.shipHero.accessToken}`
      },
      body: JSON.stringify({
        type: 'sales_order',
        data: orderData
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create sales order: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  /**
   * Helper method to create purchase orders via Next.js API route
   */
  private async createPurchaseOrderViaAPI(poData: any): Promise<any> {
    const response = await fetch('/api/shiphero/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.shipHero.accessToken}`
      },
      body: JSON.stringify({
        type: 'purchase_order',
        data: poData
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create purchase order: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  /**
   * Fetch tour details including host, participants, and warehouse info
   */
  async getTourDetails(tourId: string): Promise<TourData> {
    console.log('🔍 Fetching tour details for:', tourId)
    
    // First, get basic tour data
    const { data: tour, error: tourError } = await this.supabase
      .from('tours')
      .select('id, warehouse_id, host_id, selected_workflows, selected_skus')
      .eq('id', tourId)
      .single()

    if (tourError) throw new Error(`Failed to fetch tour: ${tourError.message}`)
    
    console.log('✅ Basic tour data:', tour)
    
    // Get warehouse data separately
    const { data: warehouse, error: warehouseError } = await this.supabase
      .from('warehouses')
      .select('id, name, address, shiphero_warehouse_id')
      .eq('id', tour.warehouse_id)
      .single()
      
    if (warehouseError) throw new Error(`Failed to fetch warehouse: ${warehouseError.message}`)
    console.log('✅ Warehouse data:', warehouse)
    
    // Get host data separately  
    const { data: host, error: hostError } = await this.supabase
      .from('team_members')
      .select('id, name, first_name, last_name')
      .eq('id', tour.host_id)
      .single()
      
    if (hostError) throw new Error(`Failed to fetch host: ${hostError.message}`)
    console.log('✅ Host data:', host)

    // Get participants
    const { data: participants, error: participantsError } = await this.supabase
      .from('tour_participants')
      .select('id, name, first_name, last_name, email, company, title')
      .eq('tour_id', tourId)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    return {
      id: tour.id,
      host: {
        id: host.id,
        name: host.name,
        first_name: host.first_name,
        last_name: host.last_name
      },
      participants: participants || [],
      warehouse: {
        id: warehouse.id,
        name: warehouse.name,
        address: warehouse.address,
        shiphero_warehouse_id: warehouse.shiphero_warehouse_id
      },
      selected_workflows: tour.selected_workflows || [],
      selected_skus: tour.selected_skus || []
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
    instructionGuide?: string
  }> {
    console.log(`🚀 DEPLOYMENT MARKER V8 - TourFinalizationService.finalizeTour called`)
    console.log(`📋 Tour ID: ${tourId}`)
    console.log(`🎯 Selected options:`, selectedOptions)
    
    const errors: string[] = []

    try {
      console.log('🔌 Initializing ShipHero client...')
      await this.initializeShipHero()
      console.log('✅ ShipHero client initialized')
      
      // Fetch tour details once at the beginning
      const tourData = await this.getTourDetails(tourId)

      // Logic Block 1: Receive-to-Light Workflow
      if (selectedOptions.includes("receive_to_light")) {
        try {
          await this.createReceiveToLightWorkflowOrders(tourData)
        } catch (error) {
          const errorMsg = `Receive-to-Light Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Logic Block 1b: Pack-to-Light Workflow  
      if (selectedOptions.includes("pack_to_light")) {
        try {
          await this.createPackToLightWorkflowOrders(tourData)
        } catch (error) {
          const errorMsg = `Pack-to-Light Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      // Generate instruction guide
      const instructionGuide = await this.generateInstructionGuide(tourId)
      console.log("📋 Generated instruction guide:", instructionGuide.substring(0, 200) + "...")

      // Update tour status to finalized
      await this.updateTourStatus(tourId, "finalized")

      const successMessage = errors.length > 0 
        ? `Tour finalized with ${errors.length} workflow error(s). Instruction guide generated.`
        : "Tour finalized successfully with all selected workflows. Instruction guide generated."

      return {
        success: errors.length === 0,
        message: successMessage,
        errors,
        instructionGuide
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
   * MODULE 1: Creates Purchase Order ONLY for Receive-to-Light (receiving workflow).
   * R2L is just receiving - no sales orders needed.
   */
  private async createReceiveToLightWorkflowOrders(tourData: TourData): Promise<void> {
    console.log("Executing: Receive-to-Light Workflow (PO ONLY) using SELECTED SKUs")
    console.log("🎯 Selected SKUs for R2L workflow:", tourData.selected_skus)
    
    // R2L is just receiving - only create purchase order
    await this.createStandardReceivingPO(tourData, "R2L")

    console.log("Executed: Receive-to-Light Workflow - PO created for receiving")
  }

  /**
   * MODULE 1b: Creates Sales Orders for participants/host and Purchase Order for Pack-to-Light.
   * Uses participant and host names (no celebrity names for pack-to-light).
   */
  private async createPackToLightWorkflowOrders(tourData: TourData): Promise<void> {
    console.log("Executing: Pack-to-Light Workflow using SELECTED SKUs")
    console.log("🎯 Selected SKUs for P2L workflow:", tourData.selected_skus)
    
    // Create participant orders first (using selected SKUs)
    const participantOrders = await this.createParticipantOrders(tourData, "P2L")
    
    // If no participants, create demo orders using host name
    if (participantOrders.length === 0) {
      console.log("No participants - creating demo orders using host name for demonstration")
      await this.createHostDemoOrders(tourData, "P2L-HOST", 3)
    }
    
    // Create purchase order using selected SKUs
    await this.createStandardReceivingPO(tourData, "P2L")

    console.log("Executed: Pack-to-Light Workflow with selected SKUs")
  }

  /**
   * MODULE 2: Creates a separate, unique Purchase Order for the selected receiving workflow.
   */
  private async createStandardReceivingPO(tourData: TourData, workflowName: string = "STANDARD-RECEIVING"): Promise<void> {
    // Use selected SKUs only - no hardcoded fallbacks
    if (tourData.selected_skus.length === 0) {
      throw new Error(`No SKUs selected for ${workflowName} PO. Please select SKUs when creating the tour.`)
    }
    
    let skusToUse = tourData.selected_skus
    
    // Limit to first 6 SKUs to keep PO manageable
    skusToUse = skusToUse.slice(0, 6)
    
    const poLineItems = skusToUse.map((sku, index) => ({
      sku: sku,
      quantity: Math.floor(Math.random() * 10) + 5 // 5-14 quantity
    }))

    console.log(`Creating ${workflowName} PO with ${poLineItems.length} SKUs:`, poLineItems.map(item => item.sku))

    const poData = {
      po_number: `${workflowName}-${tourData.host.name}-${new Date().toISOString().slice(0, 10)}`,
      po_date: new Date().toISOString().slice(0, 10),
      vendor_id: "1076735",
      warehouse_id: tourData.warehouse.shiphero_warehouse_id,
      subtotal: "0.00",
      tax: "0.00", 
      shipping_price: "0.00",
      total_price: "0.00",
      fulfillment_status: "pending",
      discount: "0.00",
      line_items: poLineItems.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        expected_weight_in_lbs: "1",
        vendor_id: "1076735",
        quantity_received: 0,
        quantity_rejected: 0,
        price: "0.00",
        product_name: item.sku,
        fulfillment_status: "pending",
        sell_ahead: 0
      }))
    }

    const data = await this.createPurchaseOrderViaAPI(poData)

    if (data.data?.purchase_order_create?.purchase_order) {
      console.log(`Executed: ${workflowName} PO`)
    } else {
      throw new Error(`Failed to create ${workflowName} PO: ${data.errors?.[0]?.message || 'Unknown error'}`)
    }
  }

  /**
   * MODULE 3: Creates a batch of 10 Sales Orders for "Bulk Shipping".
   */
  private async createBulkShippingSOs(tourData: TourData): Promise<void> {
    console.log("🎯 Starting Bulk Shipping workflow...")
    
    // Step 1: Create participant orders first
    const participantOrders = await this.createParticipantOrders(tourData, "BULK")
    
    // Step 2: Create demo orders with celebrity names
    const demoOrders = await this.createDemoOrders(tourData, "BULK-DEMO", 10)
    
    console.log(`✅ Bulk Shipping completed: ${participantOrders.length} participant + ${demoOrders.length} demo orders`)
  }


  /**
   * MODULE 4: Creates a batch of 5 single-item Sales Orders for "Single-Item Batch Picking".
   */
  private async createSingleItemBatchSOs(tourData: TourData): Promise<void> {
    console.log("🎯 Starting Single-Item Batch workflow...")
    
    // Step 1: Create participant orders first
    const participantOrders = await this.createParticipantOrders(tourData, "SINGLE")
    
    // Step 2: Create demo orders with celebrity names (5 single-item orders)
    const demoOrders = await this.createDemoOrders(tourData, "SINGLE-DEMO", 5)
    
    console.log(`✅ Single-Item Batch completed: ${participantOrders.length} participant + ${demoOrders.length} demo orders`)
  }


  /**
   * MODULE 5: Creates a batch of 5 multi-item/SKU Sales Orders for "Multi-Item Batch Picking".
   */
  private async createMultiItemBatchSOs(tourData: TourData): Promise<void> {
    console.log("🎯 Starting Multi-Item Batch workflow...")
    
    // Step 1: Create participant orders first (they already get multiple SKUs from helper method)
    const participantOrders = await this.createParticipantOrders(tourData, "MULTI")
    
    // Step 2: Create demo orders with celebrity names and multiple SKUs
    const demoOrders = await this.createMultiItemDemoOrders(tourData, "MULTI-DEMO", 5)
    
    console.log(`✅ Multi-Item Batch completed: ${participantOrders.length} participant + ${demoOrders.length} demo orders`)
  }

  /**
   * Helper method specifically for multi-item demo orders
   */
  private async createMultiItemDemoOrders(tourData: TourData, orderPrefix: string, count: number): Promise<any[]> {
    console.log(`Creating ${count} multi-item demo orders with celebrity names...`)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for Multi-Item Demo Orders. Please select SKUs when creating the tour.")
    }

    const celebrities = getCelebrityNames(count)
    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const orderPromises = []

    for (let i = 0; i < count; i++) {
      const celebrity = celebrities[i] || { first: "Demo", last: `Customer ${i + 1}` }
      
      // Create multi-item orders using selected SKUs
      const numItems = Math.min(Math.floor(Math.random() * 3) + 2, tourData.selected_skus.length) // 2-4 items
      const lineItems = []
      
      for (let j = 0; j < numItems; j++) {
        const skuIndex = (i + j) % tourData.selected_skus.length
        lineItems.push({
          sku: tourData.selected_skus[skuIndex],
          quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
          price: "12.00",
          product_name: `Product ${tourData.selected_skus[skuIndex]}`,
          partner_line_item_id: `multi-line-${i + 1}-${j + 1}`,
          fulfillment_status: "pending",
          quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
          warehouse_id: tourData.warehouse.shiphero_warehouse_id
        })
      }

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: (lineItems.reduce((sum, item) => sum + (item.quantity * 12), 0)).toString(),
        total_discounts: "0.00",
        total_price: (lineItems.reduce((sum, item) => sum + (item.quantity * 12), 0)).toString(),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "Demo Carrier",
          method: "Standard"
        },
        shipping_address: {
          first_name: celebrity.first,
          last_name: celebrity.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `${celebrity.first.toLowerCase()}.${celebrity.last.toLowerCase().replace(/\s/g, '')}@demo.com`
        },
        billing_address: {
          first_name: celebrity.first,
          last_name: celebrity.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `${celebrity.first.toLowerCase()}.${celebrity.last.toLowerCase().replace(/\s/g, '')}@demo.com`
        },
        line_items: lineItems,
        required_ship_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tags: ["multi-item", "celebrity", "tour"]
      }

      const promise = this.createSalesOrderViaAPI(orderData)

      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} multi-item demo orders:`, failures)
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} multi-item demo orders with celebrity names`)
    
    return successful.map(result => result.data.order_create.order)
  }

  // REMOVED: Legacy createMultiItemBatchSOsOld method - replaced with selected SKU approach

  /**
   * Helper method to get warehouse shipping address
   */
  private getWarehouseShippingAddress(tourData: TourData) {
    const address = tourData.warehouse.address
    return {
      first_name: "Warehouse",
      last_name: "Demo",
      address1: address?.address1 || address?.address || "123 Warehouse St",
      address2: address?.address2 || "",
      city: address?.city || "Demo City",
      state: address?.state || "CA",
      zip: address?.zip || "90210",
      country: address?.country || "US",
      phone: address?.phone || "555-0123"
    }
  }

  /**
   * Helper method to create participant orders using selected SKUs
   */
  private async createParticipantOrders(tourData: TourData, orderPrefix: string): Promise<any[]> {
    console.log(`Creating orders for ${tourData.participants.length} participants first...`)
    
    if (tourData.participants.length === 0) {
      console.log("No participants found, skipping participant orders")
      return []
    }

    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const orderPromises = []

    for (let i = 0; i < tourData.participants.length; i++) {
      const participant = tourData.participants[i]
      
      // Use selected SKUs for participant orders
      const lineItems = tourData.selected_skus.slice(0, 3).map((sku, index) => ({
        sku: sku,
        quantity: 1,
        price: "10.00",
        product_name: `Product ${sku}`,
        partner_line_item_id: `participant-line-${i + 1}-${index + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }))

      const orderData = {
        order_number: `${orderPrefix}-PARTICIPANT-${i + 1}`,
        shop_name: "Touring App",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: (lineItems.length * 10).toString(),
        total_discounts: "0.00",
        total_price: (lineItems.length * 10).toString(),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "Demo Carrier",
          method: "Standard"
        },
        shipping_address: {
          first_name: participant.first_name || "Participant",
          last_name: participant.last_name || `${i + 1}`,
          company: participant.company || "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: participant.email || `participant${i + 1}@demo.com`
        },
        billing_address: {
          first_name: participant.first_name || "Participant",
          last_name: participant.last_name || `${i + 1}`,
          company: participant.company || "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: participant.email || `participant${i + 1}@demo.com`
        },
        line_items: lineItems,
        required_ship_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tags: ["participant", "tour"]
      }

      const promise = this.createSalesOrderViaAPI(orderData)

      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} participant orders:`, failures)
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} participant orders`)
    
    return successful.map(result => result.data.order_create.order)
  }

  /**
   * Helper method to create demo orders using celebrity names and selected SKUs
   */
  private async createDemoOrders(tourData: TourData, orderPrefix: string, count: number): Promise<any[]> {
    console.log(`Creating ${count} demo orders with celebrity names...`)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const celebrities = getCelebrityNames(count)
    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const orderPromises = []

    for (let i = 0; i < count; i++) {
      const celebrity = celebrities[i] || { first: "Demo", last: `Customer ${i + 1}` }
      
      // Use selected SKUs for demo orders, rotate through them
      const selectedSkuIndex = i % tourData.selected_skus.length
      const lineItems = [{
        sku: tourData.selected_skus[selectedSkuIndex],
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
        price: "15.00",
        product_name: `Product ${tourData.selected_skus[selectedSkuIndex]}`,
        partner_line_item_id: `line-${i + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: (lineItems[0].quantity * 15).toString(),
        total_discounts: "0.00",
        total_price: (lineItems[0].quantity * 15).toString(),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "Demo Carrier",
          method: "Standard"
        },
        shipping_address: {
          first_name: celebrity.first,
          last_name: celebrity.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `${celebrity.first.toLowerCase()}.${celebrity.last.toLowerCase().replace(/\s/g, '')}@demo.com`
        },
        billing_address: {
          first_name: celebrity.first,
          last_name: celebrity.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `${celebrity.first.toLowerCase()}.${celebrity.last.toLowerCase().replace(/\s/g, '')}@demo.com`
        },
        line_items: lineItems,
        required_ship_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tags: ["demo", "celebrity", "tour"]
      }

      const promise = this.createSalesOrderViaAPI(orderData)

      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} demo orders:`, failures)
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} demo orders with celebrity names`)
    
    return successful.map(result => result.data.order_create.order)
  }

  /**
   * Helper method to create simple demo orders WITHOUT celebrity names (for Pack-to-Light)
   */
  private async createSimpleDemoOrders(tourData: TourData, orderPrefix: string, count: number): Promise<any[]> {
    console.log(`Creating ${count} simple demo orders (no celebrity names)...`)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const orderPromises = []

    for (let i = 0; i < count; i++) {
      // Use simple demo customer names instead of celebrities
      const demoCustomer = { first: "Demo", last: `Customer ${i + 1}` }
      
      // Use selected SKUs for demo orders, rotate through them
      const selectedSkuIndex = i % tourData.selected_skus.length
      const lineItems = [{
        sku: tourData.selected_skus[selectedSkuIndex],
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
        price: "15.00",
        product_name: `Product ${tourData.selected_skus[selectedSkuIndex]}`,
        partner_line_item_id: `line-${i + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: (lineItems[0].quantity * 15).toString(),
        total_discounts: "0.00",
        total_price: (lineItems[0].quantity * 15).toString(),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "Demo Carrier",
          method: "Standard"
        },
        shipping_address: {
          first_name: demoCustomer.first,
          last_name: demoCustomer.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `demo.customer${i + 1}@example.com`
        },
        billing_address: {
          first_name: demoCustomer.first,
          last_name: demoCustomer.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `demo.customer${i + 1}@example.com`
        },
        line_items: lineItems,
        required_ship_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tags: ["demo", "simple", "tour"]
      }

      const promise = this.createSalesOrderViaAPI(orderData)
      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} simple demo orders:`, failures)
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} simple demo orders (no celebrities)`)
    
    return successful.map(result => result.data.order_create.order)
  }

  /**
   * Helper method to create demo orders using host name (for Pack-to-Light when no participants)
   */
  private async createHostDemoOrders(tourData: TourData, orderPrefix: string, count: number): Promise<any[]> {
    console.log(`Creating ${count} demo orders using host name: ${tourData.host.name}`)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const orderPromises = []

    for (let i = 0; i < count; i++) {
      // Use host name for demo orders
      const hostName = {
        first: tourData.host.first_name || "Host",
        last: tourData.host.last_name || tourData.host.name || "Demo"
      }
      
      // Use selected SKUs for demo orders, rotate through them
      const selectedSkuIndex = i % tourData.selected_skus.length
      const lineItems = [{
        sku: tourData.selected_skus[selectedSkuIndex],
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
        price: "15.00",
        product_name: `Product ${tourData.selected_skus[selectedSkuIndex]}`,
        partner_line_item_id: `host-line-${i + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: (lineItems[0].quantity * 15).toString(),
        total_discounts: "0.00",
        total_price: (lineItems[0].quantity * 15).toString(),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "Demo Carrier",
          method: "Standard"
        },
        shipping_address: {
          first_name: hostName.first,
          last_name: hostName.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `host.demo${i + 1}@example.com`
        },
        billing_address: {
          first_name: hostName.first,
          last_name: hostName.last,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state_code,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country_code,
          phone: warehouseAddress.phone,
          email: `host.demo${i + 1}@example.com`
        },
        line_items: lineItems,
        required_ship_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tags: ["demo", "host", "tour"]
      }

      const promise = this.createSalesOrderViaAPI(orderData)
      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} host demo orders:`, failures)
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} demo orders using host name`)
    
    return successful.map(result => result.data.order_create.order)
  }

  /**
   * Generate comprehensive instruction guide for the tour
   */
  async generateInstructionGuide(tourId: string): Promise<string> {
    console.log("📋 Generating instruction guide...")
    
    const tourData = await this.getTourDetails(tourId)
    const selectedWorkflows = tourData.selected_workflows
    
    let guide = `# 🎯 Tour Instruction Guide\n\n`
    guide += `**Tour ID:** ${tourData.id}\n`
    guide += `**Warehouse:** ${tourData.warehouse.name}\n`
    guide += `**Host:** ${tourData.host.name}\n`
    guide += `**Participants:** ${tourData.participants.length}\n`
    guide += `**Selected SKUs:** ${tourData.selected_skus.join(', ')}\n`
    guide += `**Date:** ${new Date().toLocaleDateString()}\n\n`
    
    guide += `## 📦 Order Creation Summary\n\n`
    
    if (selectedWorkflows.includes("receive_to_light") || selectedWorkflows.includes("pack_to_light")) {
      guide += `### ✅ As-Is Workflow (Receive to Light / Pack to Light)\n`
      guide += `- **Participant Orders:** BULK-PARTICIPANT-1 to BULK-PARTICIPANT-${tourData.participants.length}\n`
      guide += `- **Purpose:** Use these orders for standard receiving and packing demonstrations\n`
      guide += `- **SKUs Used:** ${tourData.selected_skus.slice(0, 3).join(', ')}\n\n`
    }
    
    if (selectedWorkflows.includes("standard_receiving")) {
      guide += `### 📥 Standard Receiving Purchase Order\n`
      guide += `- **PO Number:** STD-RCV-${tourData.host.name}-${new Date().toISOString().slice(0, 10)}\n`
      guide += `- **Purpose:** Demonstrate standard receiving workflow\n`
      guide += `- **SKUs:** ${tourData.selected_skus.slice(0, 6).join(', ')}\n`
      guide += `- **Quantities:** 5-14 units each (randomized)\n\n`
    }
    
    if (selectedWorkflows.includes("bulk_shipping")) {
      guide += `### 📦 Bulk Shipping Orders\n`
      guide += `- **Participant Orders:** BULK-PARTICIPANT-1 to BULK-PARTICIPANT-${tourData.participants.length}\n`
      guide += `- **Demo Orders:** BULK-DEMO-1 to BULK-DEMO-10 (Celebrity names)\n`
      guide += `- **Purpose:** Demonstrate bulk shipping and batch processing\n`
      guide += `- **All orders ship to warehouse address to prevent actual shipping**\n\n`
    }
    
    if (selectedWorkflows.includes("single_item_batch")) {
      guide += `### 🎯 Single-Item Batch Picking\n`
      guide += `- **Participant Orders:** SINGLE-PARTICIPANT-1 to SINGLE-PARTICIPANT-${tourData.participants.length}\n`
      guide += `- **Demo Orders:** SINGLE-DEMO-1 to SINGLE-DEMO-5 (Celebrity names)\n`
      guide += `- **Purpose:** Demonstrate single-item batch picking efficiency\n`
      guide += `- **Strategy:** Use these orders to show batch picking of same SKUs\n\n`
    }
    
    if (selectedWorkflows.includes("multi_item_batch")) {
      guide += `### 🎯 Multi-Item Batch Picking\n`
      guide += `- **Participant Orders:** MULTI-PARTICIPANT-1 to MULTI-PARTICIPANT-${tourData.participants.length}\n`
      guide += `- **Demo Orders:** MULTI-DEMO-1 to MULTI-DEMO-5 (Celebrity names)\n`
      guide += `- **Purpose:** Demonstrate complex multi-SKU batch picking\n`
      guide += `- **Strategy:** Each order contains 2-4 different SKUs for complexity\n\n`
    }
    
    guide += `## 🎭 Celebrity Names Used\n`
    guide += `Demo orders use famous celebrity names for realistic appearance:\n`
    guide += `Taylor Swift, Dwayne Johnson, Beyoncé Knowles, Ryan Reynolds, Zendaya Coleman, etc.\n\n`
    
    guide += `## 🏢 Shipping Addresses\n`
    guide += `**ALL ORDERS** use the warehouse address as shipping destination:\n`
    guide += `${tourData.warehouse.address?.address1 || tourData.warehouse.address?.address || 'Warehouse Address'}\n`
    guide += `${tourData.warehouse.address?.city || 'City'}, ${tourData.warehouse.address?.state || 'ST'} ${tourData.warehouse.address?.zip || '00000'}\n\n`
    
    guide += `## 📋 Training Workflow Steps\n\n`
    
    if (selectedWorkflows.includes("standard_receiving")) {
      guide += `### 1️⃣ Standard Receiving Demo\n`
      guide += `- Use PO: STD-RCV-${tourData.host.name}-${new Date().toISOString().slice(0, 10)}\n`
      guide += `- Show receiving process with selected SKUs\n`
      guide += `- Demonstrate putaway and location assignment\n\n`
    }
    
    if (selectedWorkflows.includes("receive_to_light") || selectedWorkflows.includes("pack_to_light")) {
      guide += `### 2️⃣ Receive to Light / Pack to Light\n`
      guide += `- Use participant orders first: BULK-PARTICIPANT-1 onwards\n`
      guide += `- Demonstrate light-guided processes\n`
      guide += `- Show efficiency improvements\n\n`
    }
    
    if (selectedWorkflows.includes("bulk_shipping")) {
      guide += `### 3️⃣ Bulk Shipping Demo\n`
      guide += `- Start with participant orders: BULK-PARTICIPANT-*\n`
      guide += `- Then use celebrity demo orders: BULK-DEMO-*\n`
      guide += `- Show batch processing and efficiency gains\n\n`
    }
    
    if (selectedWorkflows.includes("single_item_batch")) {
      guide += `### 4️⃣ Single-Item Batch Picking\n`
      guide += `- Use SINGLE-PARTICIPANT-* and SINGLE-DEMO-* orders\n`
      guide += `- Group orders by SKU for batch efficiency\n`
      guide += `- Demonstrate pick path optimization\n\n`
    }
    
    if (selectedWorkflows.includes("multi_item_batch")) {
      guide += `### 5️⃣ Multi-Item Batch Picking\n`
      guide += `- Use MULTI-PARTICIPANT-* and MULTI-DEMO-* orders\n`
      guide += `- Show complex batch picking with multiple SKUs\n`
      guide += `- Demonstrate advanced sorting and fulfillment\n\n`
    }
    
    guide += `## ⚠️ Important Notes\n`
    guide += `- **Participant orders are created FIRST** before demo orders\n`
    guide += `- **No physical shipping** - all addresses point to warehouse\n`
    guide += `- **Selected SKUs** are used instead of hardcoded items\n`
    guide += `- **Celebrity names** make demos more engaging and realistic\n`
    guide += `- **Order numbers** are prefixed for easy identification\n\n`
    
    guide += `Generated on: ${new Date().toLocaleString()}\n`
    
    console.log("📋 Instruction guide generated successfully")
    return guide
  }
}

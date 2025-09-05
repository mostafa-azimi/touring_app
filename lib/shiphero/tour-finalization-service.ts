import { createClient } from '@/lib/supabase/client'
import { getCelebrityNames } from '@/lib/celebrity-names'

export interface TourData {
  id: string
  date: string
  time: string
  tour_numeric_id: number
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
    code?: string
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

    const result = await response.json()
    
    // Log the raw ShipHero response for debugging
    console.log(`🔍 Raw ShipHero API response:`, JSON.stringify(result, null, 2))
    
    return result
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
    
    // First, get basic tour data including date
    const { data: tour, error: tourError } = await this.supabase
      .from('tours')
      .select('id, warehouse_id, host_id, selected_workflows, selected_skus, date, time, tour_numeric_id')
      .eq('id', tourId)
      .single()

    if (tourError) throw new Error(`Failed to fetch tour: ${tourError.message}`)
    
    console.log('✅ Basic tour data:', tour)
    
    // Get warehouse data separately including warehouse code
    const { data: warehouse, error: warehouseError } = await this.supabase
      .from('warehouses')
      .select('id, name, address, shiphero_warehouse_id, code')
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
      date: tour.date,
      time: tour.time,
      tour_numeric_id: tour.tour_numeric_id,
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
        shiphero_warehouse_id: warehouse.shiphero_warehouse_id,
        code: warehouse.code
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
   * Save instruction guide to database for persistence
   */
  private async saveInstructionGuide(tourId: string, instructionGuide: string): Promise<void> {
    const { error } = await this.supabase
      .from('tours')
      .update({ 
        instruction_guide: instructionGuide,
        instruction_guide_generated_at: new Date().toISOString()
      })
      .eq('id', tourId)

    if (error) {
      console.error('Failed to save instruction guide:', error)
      // Don't throw error - this is not critical for tour finalization
    } else {
      console.log('✅ Instruction guide saved to database')
    }
  }

  /**
   * Main controller for tour finalization
   */
  async finalizeTour(tourId: string, selectedOptions: WorkflowOption[]): Promise<{
    success: boolean
    message: string
    errors: string[]
    instructionGuide?: string
    finalizationResult?: {
      tourId: string
      tourDate: string
      tourTime: string
      warehouseName: string
      warehouseAddress: string
      hostName: string
      selectedWorkflows: string[]
      selectedSkus: string[]
      participantCount: number
      orders: {
        sales_orders: Array<{
          order_number: string
          workflow: string
          customer_name: string
          items: Array<{ sku: string; quantity: number }>
        }>
        purchase_orders: Array<{
          po_number: string
          workflow: string
          items: Array<{ sku: string; quantity: number }>
        }>
      }
      instructions: string
    }
  }> {
    console.log(`🚀 DEPLOYMENT MARKER V8 - TourFinalizationService.finalizeTour called`)
    console.log(`📋 Tour ID: ${tourId}`)
    console.log(`🎯 Selected options:`, selectedOptions)
    
    const errors: string[] = []
    const salesOrders: Array<{
      order_number: string
      workflow: string
      customer_name: string
      items: Array<{ sku: string; quantity: number }>
    }> = []
    const purchaseOrders: Array<{
      po_number: string
      workflow: string
      items: Array<{ sku: string; quantity: number }>
    }> = []

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

      // Save instruction guide to database
      await this.saveInstructionGuide(tourId, instructionGuide)

      // Update tour status to finalized
      await this.updateTourStatus(tourId, "finalized")

      const successMessage = errors.length > 0 
        ? `Tour finalized with ${errors.length} workflow error(s). Instruction guide generated.`
        : "Tour finalized successfully with all selected workflows. Instruction guide generated."

      // Create finalization result
      const finalizationResult = {
        tourId: tourData.id,
        tourDate: tourData.date || new Date().toISOString().split('T')[0],
        tourTime: tourData.time || '10:00',
        warehouseName: tourData.warehouse.name,
        warehouseAddress: `${tourData.warehouse.address?.address1 || ''} ${tourData.warehouse.address?.city || ''} ${tourData.warehouse.address?.state || ''} ${tourData.warehouse.address?.zip || ''}`.trim() || 'Address not available',
        hostName: `${tourData.host.first_name} ${tourData.host.last_name}`,
        selectedWorkflows: selectedOptions,
        selectedSkus: tourData.selected_skus,
        participantCount: tourData.participants.length,
        orders: {
          sales_orders: salesOrders,
          purchase_orders: purchaseOrders
        },
        instructions: instructionGuide
      }

      return {
        success: errors.length === 0,
        message: successMessage,
        errors,
        instructionGuide,
        finalizationResult
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
    
    // If no participants, create a sales order for the host for demonstration
    if (participantOrders.length === 0) {
      console.log("No participants - creating sales order for host using selected SKUs")
      await this.createHostSalesOrder(tourData, "P2L-HOST")
    }
    
    // Create purchase order using selected SKUs (sum of all participants + host)
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
          partner_line_item_id: `multi-${Date.now()}-${i + 1}-${j + 1}`,
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
   * Helper method to decode ShipHero warehouse ID and extract warehouse number
   */
  private decodeWarehouseId(base64Id: string): string {
    try {
      const decoded = atob(base64Id)
      // Remove "Warehouse:" prefix and return just the number
      return decoded.replace('Warehouse:', '')
    } catch (error) {
      console.error('Failed to decode warehouse ID:', base64Id, error)
      return 'Unknown'
    }
  }

  /**
   * Helper method to generate standardized order metadata for all sales orders
   */
  private getStandardOrderMetadata(tourData: TourData) {
    // Calculate dates
    const tourDate = new Date(tourData.date)
    const orderDate = new Date(tourDate)
    orderDate.setDate(orderDate.getDate() - 1) // Day before tour
    
    // Extract warehouse number from ShipHero warehouse ID
    const warehouseNumber = this.decodeWarehouseId(tourData.warehouse.shiphero_warehouse_id)
    
    // Debug logging for tag generation
    console.log('🔧 Tag generation debug:')
    console.log('  - tour_numeric_id:', tourData.tour_numeric_id)
    console.log('  - warehouse.code:', tourData.warehouse.code)
    console.log('  - shiphero_warehouse_id:', tourData.warehouse.shiphero_warehouse_id)
    console.log('  - decoded warehouse number:', warehouseNumber)
    
    // Generate tags using 6-digit numeric tour ID, warehouse code, and warehouse number
    // Fallback to UUID-based ID if tour_numeric_id is missing
    const tourIdForTag = tourData.tour_numeric_id 
      ? `tour_${tourData.tour_numeric_id}` 
      : `tour_${tourData.id.slice(-6)}` // Use last 6 chars of UUID as fallback
    
    const tags = [
      'tour_orders',
      tourIdForTag,
      tourData.warehouse.code || 'WH001', // Use warehouse code from settings
      warehouseNumber // Use decoded warehouse number
    ]
    
    console.log('🏷️ Generated tags:', tags)

    const metadata = {
      fulfillment_status: "Tour_Orders",
      order_date: orderDate.toISOString(),
      required_ship_date: tourDate.toISOString().slice(0, 10),
      shipping_lines: {
        title: "Generic Shipping",
        price: "0.00",
        carrier: "generic",
        method: "generic"
      },
      tags: tags,
      total_tax: "0.00",
      total_discounts: "0.00"
    }
    
    console.log('📊 Standard metadata generated:', JSON.stringify(metadata, null, 2))
    return metadata
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
    const standardMetadata = this.getStandardOrderMetadata(tourData)
    const orderPromises = []

    for (let i = 0; i < tourData.participants.length; i++) {
      const participant = tourData.participants[i]
      
      // Use selected SKUs for participant orders
      const lineItems = tourData.selected_skus.slice(0, 3).map((sku, index) => ({
        sku: sku,
        quantity: 1,
        price: "10.00",
        product_name: `Product ${sku}`,
        partner_line_item_id: `participant-${Date.now()}-${i + 1}-${index + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }))

      const orderData = {
        order_number: `${orderPrefix}-PARTICIPANT-${i + 1}`,
        shop_name: "Touring App",
        ...standardMetadata,
        subtotal: (lineItems.length * 10).toString(),
        total_price: (lineItems.length * 10).toString(),
        shipping_address: {
          first_name: participant.first_name || "Participant",
          last_name: participant.last_name || `${i + 1}`,
          company: participant.company || "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country,
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
        line_items: lineItems
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
        partner_line_item_id: `demo-${Date.now()}-${i + 1}`,
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
    const standardMetadata = this.getStandardOrderMetadata(tourData)
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
        partner_line_item_id: `demo-${Date.now()}-${i + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        ...standardMetadata,
        subtotal: (lineItems[0].quantity * 15).toString(),
        total_price: (lineItems[0].quantity * 15).toString(),
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
        line_items: lineItems
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
   * Helper method to create a single sales order for the host (for Pack-to-Light when no participants)
   */
  private async createHostSalesOrder(tourData: TourData, orderPrefix: string): Promise<any> {
    console.log(`🔧 createHostSalesOrder: Creating host sales order using: ${tourData.host.name}`)
    console.log(`🔧 createHostSalesOrder: Order prefix: ${orderPrefix}`)
    console.log(`🔧 createHostSalesOrder: Selected SKUs:`, tourData.selected_skus)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const standardMetadata = this.getStandardOrderMetadata(tourData)
    console.log(`🔧 createHostSalesOrder: Warehouse address:`, warehouseAddress)
    console.log(`🔧 createHostSalesOrder: Standard metadata:`, standardMetadata)
    
    // Create line items for all selected SKUs with unique IDs
    const timestamp = Date.now()
    const lineItems = tourData.selected_skus.map((sku, index) => ({
      sku: sku,
      quantity: 1, // Simple quantity of 1 for host demo
      price: "15.00",
      product_name: `Product ${sku}`,
      partner_line_item_id: `host-${timestamp}-${index + 1}`,
      fulfillment_status: "pending",
      quantity_pending_fulfillment: 1,
      warehouse_id: tourData.warehouse.shiphero_warehouse_id
    }))

    const orderData = {
      order_number: `${orderPrefix}-${tourData.host.first_name || 'HOST'}`,
      shop_name: "Touring App",
      ...standardMetadata,
      subtotal: (lineItems.reduce((sum, item) => sum + (item.quantity * 15), 0)).toString(),
      total_price: (lineItems.reduce((sum, item) => sum + (item.quantity * 15), 0)).toString(),
      shipping_address: {
        first_name: tourData.host.first_name || "Host",
        last_name: tourData.host.last_name || "Demo",
        company: "",
        address1: warehouseAddress.address1,
        address2: warehouseAddress.address2,
        city: warehouseAddress.city,
        state: warehouseAddress.state,
        state_code: warehouseAddress.state,
        zip: warehouseAddress.zip,
        country: warehouseAddress.country,
        country_code: warehouseAddress.country,
        phone: warehouseAddress.phone,
        email: "host@example.com"
      },
      billing_address: {
        first_name: tourData.host.first_name || "Host",
        last_name: tourData.host.last_name || "Demo",
        company: "",
        address1: warehouseAddress.address1,
        address2: warehouseAddress.address2,
        city: warehouseAddress.city,
        state: warehouseAddress.state,
        state_code: warehouseAddress.state,
        zip: warehouseAddress.zip,
        country: warehouseAddress.country,
        country_code: warehouseAddress.country,
        phone: warehouseAddress.phone,
        email: "host@example.com"
      },
      line_items: lineItems
    }

    console.log(`🔧 createHostSalesOrder: Final order data:`, JSON.stringify(orderData, null, 2))

    try {
      const result = await this.createSalesOrderViaAPI(orderData)
      
      // Check for ShipHero GraphQL errors in the response
      if (result.errors && result.errors.length > 0) {
        console.error(`❌ ShipHero API returned errors:`, result.errors)
        console.error(`❌ Full ShipHero response:`, JSON.stringify(result, null, 2))
        throw new Error(`ShipHero API errors: ${JSON.stringify(result.errors)}`)
      }
      
      // Check if the order was actually created
      if (!result.data?.order_create?.order) {
        console.error(`❌ No order returned from ShipHero:`, result)
        throw new Error(`ShipHero did not return an order object`)
      }
      
      console.log(`✅ Created host sales order: ${orderData.order_number}`)
      console.log(`✅ ShipHero order ID: ${result.data.order_create.order.id}`)
      console.log(`✅ ShipHero order number: ${result.data.order_create.order.order_number}`)
      return result
    } catch (error) {
      console.error(`❌ Failed to create host sales order:`, error)
      console.error(`❌ Order data that failed:`, JSON.stringify(orderData, null, 2))
      throw error
    }
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
    const standardMetadata = this.getStandardOrderMetadata(tourData)
    const orderPromises = []

    for (let i = 0; i < count; i++) {
      // Use host name for demo orders
      const hostName = {
        first: tourData.host.first_name || "Host",
        last: tourData.host.last_name || tourData.host.name || "Demo"
      }
      
      // Use selected SKUs for demo orders, rotate through them
      const selectedSkuIndex = i % tourData.selected_skus.length
      const timestamp = Date.now()
      const lineItems = [{
        sku: tourData.selected_skus[selectedSkuIndex],
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
        price: "15.00",
        product_name: `Product ${tourData.selected_skus[selectedSkuIndex]}`,
        partner_line_item_id: `host-demo-${timestamp}-${i + 1}`,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]

      const orderData = {
        order_number: `${orderPrefix}-${i + 1}`,
        shop_name: "Touring App",
        ...standardMetadata,
        subtotal: (lineItems[0].quantity * 15).toString(),
        total_price: (lineItems[0].quantity * 15).toString(),
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
        line_items: lineItems
      }

      const promise = this.createSalesOrderViaAPI(orderData)
      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    
    // Check for failures and log detailed errors
    const failures = results.filter(result => !result.data?.order_create?.order)
    if (failures.length > 0) {
      console.error(`Failed to create ${failures.length} host demo orders:`)
      failures.forEach((failure, index) => {
        console.error(`  Order ${index + 1} error:`, {
          errors: failure.errors,
          data: failure.data,
          fullResponse: failure
        })
      })
    }
    
    const successful = results.filter(result => result.data?.order_create?.order)
    console.log(`✅ Created ${successful.length} demo orders using host name`)
    
    return successful.map(result => result.data.order_create.order)
  }

  /**
   * Generate host-friendly tour guide with step-by-step instructions
   */
  async generateInstructionGuide(tourId: string): Promise<string> {
    console.log("📋 Generating host-friendly instruction guide...")
    
    const tourData = await this.getTourDetails(tourId)
    const selectedWorkflows = tourData.selected_workflows
    
    let guide = `# 🎯 WAREHOUSE TOUR GUIDE\n\n`
    guide += `## 📋 Tour Overview\n`
    guide += `**Date:** ${new Date().toLocaleDateString()}\n`
    guide += `**Warehouse:** ${tourData.warehouse.name}\n`
    guide += `**Host:** ${tourData.host.name}\n`
    guide += `**Participants:** ${tourData.participants.length}\n`
    guide += `**Duration:** Approximately 45-60 minutes\n\n`
    
    guide += `## 🚀 WELCOME & INTRODUCTION (5 minutes)\n`
    guide += `1. **Welcome participants** and introduce yourself\n`
    guide += `2. **Safety briefing** - warehouse safety rules and procedures\n`
    guide += `3. **Tour overview** - explain what they'll see and experience\n`
    guide += `4. **Q&A expectations** - encourage questions throughout\n\n`
    
    guide += `## 🏢 WAREHOUSE OVERVIEW (10 minutes)\n`
    guide += `1. **Facility tour** - show the physical layout\n`
    guide += `2. **Technology stack** - introduce ShipHero and warehouse systems\n`
    guide += `3. **Daily operations** - explain typical workflow and volume\n`
    guide += `4. **Team structure** - roles and responsibilities\n\n`
    
    // Add specific workflow demonstrations
    let workflowCounter = 1
    
    if (selectedWorkflows.includes('receive_to_light')) {
      guide += `## 📦 DEMONSTRATION ${workflowCounter}: RECEIVE-TO-LIGHT (R2L)\n`
      guide += `**Time:** 10 minutes | **Location:** Receiving area\n\n`
      guide += `### What to show:\n`
      guide += `- **Light-guided receiving** - how lights direct workers to correct locations\n`
      guide += `- **Accuracy improvements** - reduced errors with visual guidance\n`
      guide += `- **Speed benefits** - faster putaway with directed workflows\n`
      guide += `- **Real-time updates** - inventory updates as items are received\n\n`
      guide += `### Key talking points:\n`
      guide += `- "This system eliminates guesswork in receiving"\n`
      guide += `- "Lights guide workers to exact locations, reducing training time"\n`
      guide += `- "Real-time inventory updates prevent stock discrepancies"\n\n`
      workflowCounter++
    }
    
    if (selectedWorkflows.includes('pack_to_light')) {
      guide += `## 📋 DEMONSTRATION ${workflowCounter}: PACK-TO-LIGHT (P2L)\n`
      guide += `**Time:** 12 minutes | **Location:** Packing stations\n\n`
      guide += `### What to show:\n`
      guide += `- **Order picking process** - how orders are selected and routed\n`
      guide += `- **Light-guided packing** - lights indicate items and quantities\n`
      guide += `- **Quality control** - built-in verification steps\n`
      guide += `- **Shipping integration** - automatic label generation\n\n`
      guide += `### Key talking points:\n`
      guide += `- "Pack-to-Light reduces picking errors by up to 99.9%"\n`
      guide += `- "Workers can focus on speed while lights ensure accuracy"\n`
      guide += `- "Orders are automatically verified before shipping"\n\n`
      workflowCounter++
    }
    
    if (selectedWorkflows.includes('multi_item_batch')) {
      guide += `## 🛒 DEMONSTRATION ${workflowCounter}: MULTI-ITEM BATCH PICKING\n`
      guide += `**Time:** 10 minutes | **Location:** Pick zones\n\n`
      guide += `### What to show:\n`
      guide += `- **Batch optimization** - multiple orders picked simultaneously\n`
      guide += `- **Route efficiency** - optimal path through warehouse\n`
      guide += `- **Order consolidation** - how items are sorted by destination\n`
      guide += `- **Productivity metrics** - real-time performance tracking\n`
      guide += `- **Random demonstration orders** - use system-generated sample orders\n\n`
      guide += `### Key talking points:\n`
      guide += `- "Batch picking increases productivity by 3-5x"\n`
      guide += `- "Smart routing reduces travel time by up to 50%"\n`
      guide += `- "System optimizes batches based on item locations"\n`
      guide += `- "Demonstration orders show real-world batch scenarios"\n\n`
      workflowCounter++
    }
    
    if (selectedWorkflows.includes('single_item_batch')) {
      guide += `## 📦 DEMONSTRATION ${workflowCounter}: SINGLE-ITEM BATCH PICKING\n`
      guide += `**Time:** 8 minutes | **Location:** High-volume pick area\n\n`
      guide += `### What to show:\n`
      guide += `- **Single line-item orders** - one SKU per order, different products\n`
      guide += `- **Different SKUs per order** - variety of products being picked\n`
      guide += `- **Multiple customer addresses** - different shipping destinations\n`
      guide += `- **Batch picking efficiency** - grouping different single-item orders\n`
      guide += `- **Route optimization** - efficient path through different product locations\n\n`
      guide += `### Key talking points:\n`
      guide += `- "Single-item batch perfect for diverse product orders"\n`
      guide += `- "Different SKUs, different customers - optimized picking"\n`
      guide += `- "System batches single-item orders for efficiency"\n`
      guide += `- "Demonstrates handling variety in single-item scenarios"\n\n`
      workflowCounter++
    }
    
    if (selectedWorkflows.includes('bulk_shipping')) {
      guide += `## 🚛 DEMONSTRATION ${workflowCounter}: BULK SHIPPING\n`
      guide += `**Time:** 10 minutes | **Location:** Shipping dock\n\n`
      guide += `### What to show:\n`
      guide += `- **Identical orders processing** - same SKUs going to different customers\n`
      guide += `- **Bulk processing efficiency** - handling multiple identical orders simultaneously\n`
      guide += `- **Address differentiation** - same products, different shipping destinations\n`
      guide += `- **Batch consolidation** - grouping identical SKUs for efficient picking\n`
      guide += `- **Shipping optimization** - best methods for bulk identical orders\n\n`
      guide += `### Key talking points:\n`
      guide += `- "Bulk shipping perfect for identical products to multiple customers"\n`
      guide += `- "System groups identical SKUs for maximum efficiency"\n`
      guide += `- "Same products, different addresses - optimized routing"\n`
      guide += `- "Demonstrates bulk processing for high-volume scenarios"\n\n`
      workflowCounter++
    }
    
    guide += `## 💻 SHIPHERO DASHBOARD DEMO (8 minutes)\n`
    guide += `**Location:** Office area or mobile device\n\n`
    guide += `### What to show:\n`
    guide += `- **Real-time inventory** - live stock levels and locations\n`
    guide += `- **Order management** - from receipt to fulfillment\n`
    guide += `- **Analytics dashboard** - performance metrics and insights\n`
    guide += `- **Mobile integration** - warehouse operations on mobile devices\n\n`
    guide += `### Key talking points:\n`
    guide += `- "Complete visibility into all warehouse operations"\n`
    guide += `- "Data-driven decisions with real-time analytics"\n`
    guide += `- "Mobile-first design for modern workforce"\n\n`
    
    guide += `## 🤝 Q&A AND WRAP-UP (5-10 minutes)\n`
    guide += `1. **Open discussion** - answer specific questions\n`
    guide += `2. **Next steps** - how to get started with ShipHero\n`
    guide += `3. **Contact information** - provide follow-up resources\n`
    guide += `4. **Thank participants** - appreciate their time\n\n`
    
    guide += `## 📞 FOLLOW-UP ACTIONS\n`
    guide += `- [ ] Send thank you email with tour summary\n`
    guide += `- [ ] Provide pricing and implementation timeline\n`
    guide += `- [ ] Schedule follow-up demo if requested\n`
    guide += `- [ ] Connect with technical team for detailed questions\n\n`
    
    guide += `## 🎯 KEY SUCCESS METRICS TO HIGHLIGHT\n`
    guide += `- **99.9% accuracy** with light-guided systems\n`
    guide += `- **50% reduction** in training time for new workers\n`
    guide += `- **3-5x productivity** increase with batch picking\n`
    guide += `- **Real-time visibility** into all operations\n`
    guide += `- **Seamless integration** with existing systems\n\n`
    
    guide += `## 📦 PRODUCTS FOR DEMONSTRATION\n`
    guide += `**Selected SKUs:** ${tourData.selected_skus.join(', ')}\n`
    guide += `*Use these products throughout all demonstrations for consistency*\n\n`
    
    guide += `---\n`
    guide += `*Generated on: ${new Date().toLocaleString()}*\n`
    guide += `*Tour ID: ${tourData.id}*\n`
    
    console.log("📋 Host-friendly instruction guide generated successfully")
    return guide
  }

  /**
   * Create Multi-Item Batch sales orders with celebrity demo customers
   */
  private async createMultiItemBatchSOs(tourData: TourData): Promise<void> {
    console.log('🎯 Starting Multi-Item Batch workflow...')
    console.log(`Creating orders for ${tourData.participants.length} participants first...`)

    // Create participant orders first (if any)
    if (tourData.participants.length > 0) {
      await this.createParticipantOrders(tourData)
    } else {
      console.log('No participants found, skipping participant orders')
    }

    // Create demo orders with celebrity names for training variety
    const demoOrderCount = 5
    console.log(`Creating ${demoOrderCount} multi-item demo orders with celebrity names...`)
    
    if (tourData.selected_skus.length === 0) {
      throw new Error("No SKUs selected for orders. Please select SKUs when creating the tour.")
    }

    const warehouseAddress = this.getWarehouseShippingAddress(tourData)
    const standardMetadata = this.getStandardOrderMetadata(tourData)
    const orderPromises = []
    
    for (let i = 0; i < demoOrderCount; i++) {
      // Get celebrity name
      const celebrity = getCelebrityNames(1)[0]
      
      // Create multi-item line items (2-4 items per order)
      const itemCount = Math.floor(Math.random() * 3) + 2 // 2-4 items
      const lineItems = []
      
      for (let j = 0; j < itemCount; j++) {
        const skuIndex = (i + j) % tourData.selected_skus.length
        lineItems.push({
          sku: tourData.selected_skus[skuIndex],
          quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
          price: "15.00",
          product_name: `Product ${tourData.selected_skus[skuIndex]}`,
          partner_line_item_id: `mib-${Date.now()}-${i + 1}-${j + 1}`,
          fulfillment_status: "pending",
          quantity_pending_fulfillment: Math.floor(Math.random() * 3) + 1,
          warehouse_id: tourData.warehouse.shiphero_warehouse_id
        })
      }

      const orderData = {
        order_number: `DEMO-MIB-${Date.now()}-${i + 1}`,
        shop_name: "Touring App",
        ...standardMetadata,
        subtotal: (lineItems.reduce((sum, item) => sum + (item.quantity * 15), 0)).toString(),
        total_price: (lineItems.reduce((sum, item) => sum + (item.quantity * 15), 0)).toString(),
        shipping_address: {
          first_name: celebrity.firstName,
          last_name: celebrity.lastName,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country,
          phone: warehouseAddress.phone,
          email: `demo.mib${i + 1}@example.com`
        },
        billing_address: {
          first_name: celebrity.firstName,
          last_name: celebrity.lastName,
          company: "",
          address1: warehouseAddress.address1,
          address2: warehouseAddress.address2,
          city: warehouseAddress.city,
          state: warehouseAddress.state,
          state_code: warehouseAddress.state,
          zip: warehouseAddress.zip,
          country: warehouseAddress.country,
          country_code: warehouseAddress.country,
          phone: warehouseAddress.phone,
          email: `demo.mib${i + 1}@example.com`
        },
        line_items: lineItems
      }

      const promise = this.createSalesOrderViaAPI(orderData)
      orderPromises.push(promise)
    }

    const results = await Promise.all(orderPromises)
    const successfulOrders = results.filter(result => result.success).length
    
    console.log(`✅ Created ${successfulOrders} multi-item batch demo orders`)
    
    if (successfulOrders < demoOrderCount) {
      const failedCount = demoOrderCount - successfulOrders
      console.warn(`⚠️ ${failedCount} demo orders failed to create`)
    }
  }
}

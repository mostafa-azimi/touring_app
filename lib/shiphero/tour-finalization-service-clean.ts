import { createClient } from '@/lib/supabase/client'

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
  selected_skus: string[] // Legacy - aggregated from all workflows
  workflow_configs?: {[key: string]: {orderCount: number, selectedSkus: string[], skuQuantities?: {[sku: string]: number}}} // New per-workflow configuration
}

export interface ExtraCustomer {
  id: string
  first_name: string
  last_name: string
  email: string
  company: string
}

export type WorkflowOption = 
  | "standard_receiving" 
  | "bulk_shipping" 
  | "single_item_batch" 
  | "multi_item_batch"
  | "pack_to_light"

export class TourFinalizationService {
  private supabase
  private shipHero: any

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Fetch extra customers from database when more orders needed than real participants + host
   */
  private async getExtrasFromDatabase(count: number): Promise<ExtraCustomer[]> {
    console.log(`🔍 Fetching ${count} extra customers from database...`)
    
    const { data: extras, error } = await this.supabase
      .from('extras')
      .select('id, first_name, last_name, email, company')
      .limit(count)
    
    if (error) {
      console.error('❌ Error fetching extras:', error)
      throw new Error(`Failed to fetch extra customers: ${error.message}`)
    }
    
    if (!extras || extras.length === 0) {
      throw new Error('No extra customers available in database. Please check the extras table.')
    }
    
    console.log(`✅ Retrieved ${extras.length} extra customers`)
    return extras as ExtraCustomer[]
  }

  /**
   * Calculate total orders needed across all fulfillment workflows
   */
  private calculateTotalOrdersNeeded(tourData: TourData): number {
    const workflowConfigs = tourData.workflow_configs || {}
    
    const bulkCount = workflowConfigs['bulk_shipping']?.orderCount || 0
    const singleCount = workflowConfigs['single_item_batch']?.orderCount || 0  
    const multiCount = workflowConfigs['multi_item_batch']?.orderCount || 0
    const packCount = workflowConfigs['pack_to_light']?.orderCount || 0
    
    const total = bulkCount + singleCount + multiCount + packCount
    console.log(`📊 Total orders needed: ${total} (bulk: ${bulkCount}, single: ${singleCount}, multi: ${multiCount}, pack: ${packCount})`)
    
    return total
  }

  /**
   * Get all order recipients: participants + host + extras (if needed)
   */
  private async getAllOrderRecipients(tourData: TourData): Promise<Array<{
    first_name: string
    last_name: string
    email: string
    company: string
    type: 'participant' | 'host' | 'extra'
  }>> {
    const totalOrdersNeeded = this.calculateTotalOrdersNeeded(tourData)
    const realPeopleCount = (tourData.participants?.length || 0) + 1 // +1 for host
    
    console.log(`🎯 Orders needed: ${totalOrdersNeeded}, Real people: ${realPeopleCount}`)
    
    const recipients = []
    
    // Add participants
    if (tourData.participants) {
      for (const participant of tourData.participants) {
        recipients.push({
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          company: participant.company,
          type: 'participant' as const
        })
      }
    }
    
    // Add host
    recipients.push({
      first_name: tourData.host.first_name,
      last_name: tourData.host.last_name,
      email: `${tourData.host.first_name.toLowerCase()}.${tourData.host.last_name.toLowerCase()}@shiphero.com`,
      company: 'ShipHero',
      type: 'host' as const
    })
    
    // Add extras if needed
    if (totalOrdersNeeded > realPeopleCount) {
      const extrasNeeded = totalOrdersNeeded - realPeopleCount
      console.log(`🔄 Need ${extrasNeeded} extra customers to reach ${totalOrdersNeeded} total orders`)
      
      const extras = await this.getExtrasFromDatabase(extrasNeeded)
      for (const extra of extras) {
        recipients.push({
          first_name: extra.first_name,
          last_name: extra.last_name,
          email: extra.email,
          company: extra.company,
          type: 'extra' as const
        })
      }
    } else {
      console.log(`✅ Real people (${realPeopleCount}) sufficient for ${totalOrdersNeeded} orders - no extras needed`)
    }
    
    // Only return as many recipients as we need orders
    const finalRecipients = recipients.slice(0, totalOrdersNeeded)
    console.log(`🎯 Final recipients: ${finalRecipients.length} (${finalRecipients.filter(r => r.type === 'participant').length} participants, ${finalRecipients.filter(r => r.type === 'host').length} host, ${finalRecipients.filter(r => r.type === 'extra').length} extras)`)
    
    return finalRecipients
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
      const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('❌ ShipHero API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorBody,
        orderNumber: orderData.order_number,
        lineItems: orderData.line_items
      })
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorBody)}`)
    }

    const result = await response.json()
    
    // Extract order from GraphQL response structure
    const createdOrder = result?.data?.order_create?.order
    
    if (!createdOrder) {
      console.error('⚠️ Order API returned 200 but no order data:', result)
      console.error('⚠️ Check for GraphQL errors:', result?.errors)
    }
    
    console.log('✅ Order created successfully:', {
      orderNumber: createdOrder?.order_number || orderData.order_number,
      shipheroId: createdOrder?.id,
      legacyId: createdOrder?.legacy_id,
      status: createdOrder?.fulfillment_status
    })
    
    return createdOrder || result
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get tour details from database
   */
  private async getTourDetails(tourId: string): Promise<TourData> {
    console.log(`🔍 Fetching tour details for: ${tourId}`)

    const { data: tour, error } = await this.supabase
      .from('tours')
      .select(`
        id, date, time, tour_numeric_id, selected_workflows, selected_skus, workflow_configs,
        warehouse:warehouses(id, name, address, address2, city, state, zip, shiphero_warehouse_id, code),
        host:team_members(id, name, first_name, last_name),
        participants:tour_participants(
          id,
          first_name, last_name, email, company, title
        )
      `)
      .eq('id', tourId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch tour details: ${error.message}`)
    }

    if (!tour) {
      throw new Error(`Tour not found: ${tourId}`)
    }

    // Transform the data to match expected structure
    const tourData: TourData = {
      id: tour.id,
      date: tour.date,
      time: tour.time,
      tour_numeric_id: tour.tour_numeric_id,
      host: tour.host,
      participants: tour.participants || [],
      warehouse: tour.warehouse,
      selected_workflows: tour.selected_workflows || [],
      selected_skus: tour.selected_skus || [],
      workflow_configs: tour.workflow_configs || {}
    }

    console.log(`✅ Basic tour data:`, {
      id: tourData.id,
      warehouse_id: tourData.warehouse?.id,
      host_id: tourData.host?.id,
      selected_workflows: tourData.selected_workflows,
      selected_skus: tourData.selected_skus,
      participants_count: tourData.participants?.length || 0
    })
    console.log(`✅ Warehouse data:`, tourData.warehouse)
    console.log(`✅ Host data:`, tourData.host)

    return tourData
  }

  /**
   * Main finalization method - orchestrates all workflows
   */
  async finalizeTour(tourId: string, selectedOptions: WorkflowOption[]): Promise<{
    success: boolean
    message: string
    sales_orders: any[]
    purchase_orders: any[]
    instruction_guide?: string
  }> {
    try {
      console.log('🚀 DEPLOYMENT MARKER V8 - TourFinalizationService.finalizeTour called')
      console.log('📋 Tour ID:', tourId)
      console.log('🎯 Selected options:', selectedOptions)

      // Initialize ShipHero client
      console.log('🔌 Initializing ShipHero client...')
      await this.initializeShipHero()
      console.log('✅ ShipHero client initialized')

      // Get tour details
      const tourData = await this.getTourDetails(tourId)
      
      // Track all created orders
      const createdOrders: Array<{
        type: 'sales_order' | 'purchase_order'
        workflow: string
        shiphero_id: string
        order_number: string
        customer_name?: string
        items: Array<{ sku: string; quantity: number }>
      }> = []
      
      // Define instruction_guide early to avoid scoping issues
      let instruction_guide = "Instruction guide generation temporarily disabled."

      // Execute each selected workflow and collect created orders
      for (const option of selectedOptions) {
        console.log(`\n🔄 Executing workflow: ${option}`)
        
        try {
          let workflowOrders: any[] = []
          
          switch (option) {
            case "standard_receiving":
              console.log("Executing: Standard Receiving Workflow")
              await this.createStandardReceivingWorkflow(tourData)
              break
              
            case "bulk_shipping":
              console.log("Executing: Bulk Shipping Workflow")
              workflowOrders = await this.createBulkShippingSOs(tourData)
              break
              
            case "single_item_batch":
              console.log("Executing: Single-Item Batch Workflow")
              workflowOrders = await this.createSingleItemBatchSOs(tourData)
              break
              
            case "multi_item_batch":
              console.log("Executing: Multi-Item Batch Workflow")
              workflowOrders = await this.createMultiItemBatchSOs(tourData)
              break
              
            case "pack_to_light":
              console.log("Executing: Pack to Light Workflow")
              await this.createPackToLightSOs(tourData)
              break
              
            default:
              console.warn(`⚠️ Unknown workflow option: ${option}`)
          }
          
          // Add workflow orders to createdOrders array
          if (workflowOrders && workflowOrders.length > 0) {
            workflowOrders.forEach(order => {
              createdOrders.push({
                type: 'sales_order',
                workflow: option,
                shiphero_id: order?.id || 'unknown',
                order_number: order?.order_number || 'unknown',
                customer_name: order?.shipping_address?.first_name + ' ' + order?.shipping_address?.last_name,
                items: order?.line_items || []
              })
            })
            console.log(`✅ Added ${workflowOrders.length} orders from ${option} to tracking`)
          }
        } catch (workflowError: any) {
          console.error(`❌ Workflow ${option} failed:`, workflowError)
          // Continue with other workflows
        }
      }

      // instruction_guide already defined at the top of function
      console.log('✅ Tour finalization completed successfully!')
      console.log(`📊 Total participants: ${tourData.participants?.length || 0}`)

      // Return separate arrays for sales and purchase orders
      const sales_orders = createdOrders.filter(order => order.type === 'sales_order')
      const purchase_orders = createdOrders.filter(order => order.type === 'purchase_order')
      
      console.log(`📊 Final counts: ${sales_orders.length} sales orders, ${purchase_orders.length} purchase orders`)

      // Update tour status to finalized and save order summary
      console.log('🔄 Updating tour status to finalized for tour:', tourId)
      
      const orderSummary = {
        sales_orders: sales_orders.map(order => ({
          workflow: order.workflow,
          order_number: order.order_number,
          shiphero_id: order.shiphero_id,
          customer_name: order.customer_name
        })),
        purchase_orders: purchase_orders.map(order => ({
          workflow: order.workflow,
          order_number: order.order_number,
          shiphero_id: order.shiphero_id
        })),
        total_orders: sales_orders.length + purchase_orders.length,
        created_at: new Date().toISOString()
      }
      
      const { data: updatedTour, error: statusError } = await this.supabase
        .from('tours')
        .update({ 
          status: 'finalized',
          order_summary: orderSummary
        })
        .eq('id', tourId)
        .select('id, status, order_summary')

      if (statusError) {
        console.error('⚠️ Failed to update tour status:', statusError)
      } else {
        console.log('✅ Tour status updated to finalized:', updatedTour)
      }

      return {
        success: true,
        message: `Tour finalized successfully! Created ${sales_orders.length} sales orders and ${purchase_orders.length} purchase orders.`,
        sales_orders,
        purchase_orders,
        instruction_guide
      }

    } catch (error: any) {
      console.error('❌ Tour finalization failed:', error)
      return {
        success: false,
        message: `Tour finalization failed: ${error.message}`,
        sales_orders: [],
        purchase_orders: [],
        instruction_guide: "Finalization failed"
      }
    }
  }

  /**
   * MODULE 1: Creates a Purchase Order for "Standard Receiving" workflow
   */
  private async createStandardReceivingWorkflow(tourData: TourData): Promise<void> {
    console.log("🎯 Creating Standard Receiving Purchase Order...")
    
    const workflowConfig = tourData.workflow_configs?.['standard_receiving']
    const skuQuantities = workflowConfig?.skuQuantities || {}
    
    if (Object.keys(skuQuantities).length === 0) {
      console.warn("No SKU quantities configured for Standard Receiving, using selected_skus with quantity 1")
      // Fallback to legacy selected_skus
      tourData.selected_skus.forEach(sku => {
        skuQuantities[sku] = 1
      })
    }

    console.log("📦 Using SKU quantities:", skuQuantities)

    const poLineItems = Object.entries(skuQuantities).map(([sku, quantity]) => ({
      sku: sku,
      quantity: quantity,
      expected_weight_in_lbs: "1.00",
      vendor_id: "1076735",
      quantity_received: 0,
      quantity_rejected: 0,
      price: "0.00",
      product_name: sku,
      fulfillment_status: "pending",
      sell_ahead: 0
    }))

    const poData = {
      po_number: `STANDARD-RECEIVING-${tourData.tour_numeric_id}-${Date.now()}`,
      po_date: new Date().toISOString().slice(0, 10),
      vendor_id: "1076735",
      warehouse_id: tourData.warehouse.shiphero_warehouse_id,
      subtotal: "0.00",
      tax: "0.00",
      shipping_price: "0.00", 
      total_price: "0.00",
      fulfillment_status: "pending",
      discount: "0.00",
      line_items: poLineItems
    }

    console.log("🔄 Creating Standard Receiving PO...")
    const result = await this.createPurchaseOrderViaAPI(poData)

    if (result.data?.purchase_order_create?.purchase_order) {
      console.log("✅ Standard Receiving PO created successfully")
    } else {
      throw new Error(`Standard Receiving PO creation failed: ${result.errors?.[0]?.message || 'Unknown error'}`)
    }
  }

  /**
   * MODULE 2: Creates Sales Orders for "Bulk Shipping"
   */
  private async createBulkShippingSOs(tourData: TourData): Promise<any[]> {
    const workflowConfig = tourData.workflow_configs?.['bulk_shipping']
    const orderCount = workflowConfig?.orderCount || 5 // Default to 5 if no config
    const skuQuantities = workflowConfig?.skuQuantities || {}
    const workflowSkus = Object.keys(skuQuantities).length > 0 
      ? Object.keys(skuQuantities)
      : tourData.selected_skus // Fallback to legacy
    
    console.log(`Creating ${orderCount} bulk shipping orders...`)
    console.log(`🎯 Using SKUs for Bulk Shipping:`, workflowSkus)
    console.log(`🔍 DEBUG - workflowConfig:`, workflowConfig)
    console.log(`🔍 DEBUG - skuQuantities:`, skuQuantities)
    console.log(`🔍 DEBUG - tourData.selected_skus:`, tourData.selected_skus)
    
    // Create all orders using the new recipient system (participants + host + extras as needed)
    const allOrders = await this.createOrdersForWorkflow(tourData, "BULK", orderCount, workflowSkus)
    
    console.log(`✅ Bulk Shipping completed: ${allOrders.length} orders using new recipient system`)
    return allOrders
  }

  /**
   * MODULE 3: Creates Sales Orders for "Single-Item Batch Picking"
   * Each order gets 1 unit of 1 randomly selected SKU from the pool
   */
  private async createSingleItemBatchSOs(tourData: TourData): Promise<any[]> {
    console.log('🎯 === SINGLE-ITEM BATCH WORKFLOW STARTING ===')
    const workflowConfig = tourData.workflow_configs?.['single_item_batch']
    const orderCount = workflowConfig?.orderCount || 5 // Default to 5 if no config
    const workflowSkus = workflowConfig?.skuQuantities 
      ? Object.keys(workflowConfig.skuQuantities).filter(sku => workflowConfig.skuQuantities[sku] > 0)
      : tourData.selected_skus // Fallback to legacy
    
    console.log(`📦 Creating ${orderCount} SINGLE-item batch orders...`)
    console.log(`🎯 SKU Pool for Single-Item Batch (${workflowSkus.length} SKUs):`, workflowSkus)
    console.log(`⚠️ IMPORTANT: Each order should get 1 unit of 1 randomly selected SKU`)
    
    // Create all orders using the new recipient system (participants + host + extras as needed)
    const allOrders = await this.createOrdersForWorkflow(tourData, "SINGLE", orderCount, workflowSkus)
    
    console.log(`✅ Single-Item Batch completed: ${allOrders.length} orders created`)
    console.log('🎯 === SINGLE-ITEM BATCH WORKFLOW COMPLETE ===')
    return allOrders
  }

  /**
   * MODULE 4: Creates Sales Orders for "Multi-Item Batch Picking"
   * Uses randomized subset of SKUs with weighted random quantities for variety
   * Each order gets exactly 2 randomly selected SKUs with 1-2 units each
   */
  private async createMultiItemBatchSOs(tourData: TourData): Promise<any[]> {
    console.log('🎯 === MULTI-ITEM BATCH WORKFLOW STARTING ===')
    const workflowConfig = tourData.workflow_configs?.['multi_item_batch']
    const orderCount = workflowConfig?.orderCount || 5 // Default to 5 if no config
    const availableSkus = workflowConfig?.skuQuantities 
      ? Object.keys(workflowConfig.skuQuantities).filter(sku => workflowConfig.skuQuantities[sku] > 0)
      : tourData.selected_skus // Fallback to legacy
    
    if (availableSkus.length === 0) {
      console.log('⚠️ No SKUs selected for Multi-Item Batch workflow')
      return
    }
    
    if (availableSkus.length < 2) {
      console.log('⚠️ Multi-Item Batch requires at least 2 SKUs. Please select more SKUs.')
      return
    }
    
    console.log(`📦 Creating ${orderCount} MULTI-item batch orders from ${availableSkus.length} available SKUs:`, availableSkus)
    console.log(`⚠️ IMPORTANT: Each order should get exactly 2 randomly selected SKUs with 1-2 units each`)
    
    // Create randomized orders using new recipient system
    const allOrders = await this.createRandomizedOrdersForWorkflow(tourData, "MULTI", orderCount, availableSkus)
    
    console.log(`✅ Multi-Item Batch completed: ${allOrders.length} randomized orders created`)
    console.log('🎯 === MULTI-ITEM BATCH WORKFLOW COMPLETE ===')
    return allOrders
  }

  /**
   * MODULE 5: Creates Sales Orders for "Pack to Light"
   * Creates orders with all selected SKUs (1 unit each)
   */
  private async createPackToLightSOs(tourData: TourData): Promise<void> {
    const workflowConfig = tourData.workflow_configs?.['pack_to_light']
    const orderCount = workflowConfig?.orderCount || 5 // Default to 5 if no config
    const workflowSkus = workflowConfig?.skuQuantities 
      ? Object.keys(workflowConfig.skuQuantities).filter(sku => workflowConfig.skuQuantities[sku] > 0)
      : tourData.selected_skus // Fallback to legacy
    
    console.log(`Creating ${orderCount} pack-to-light orders...`)
    console.log(`🎯 Using SKUs for Pack to Light:`, workflowSkus)
    
    // Create all orders using the new recipient system with all SKUs (1 unit each)
    const allOrders = await this.createPackToLightOrdersForWorkflow(tourData, "PACK", orderCount, workflowSkus)
    
    console.log(`✅ Pack to Light completed: ${allOrders.length} orders`)
  }

  /**
   * Helper method to create orders using the new recipient system (participants + host + extras)
   */
  private async createOrdersForWorkflow(tourData: TourData, orderPrefix: string, orderCount: number, workflowSkus: string[]): Promise<any[]> {
    console.log(`Creating ${orderCount} orders using new recipient system for ${orderPrefix}...`)
    
    if (workflowSkus.length === 0) {
      throw new Error(`No SKUs selected for ${orderPrefix}. Please select SKUs when creating the tour.`)
    }

    const allRecipients = await this.getAllOrderRecipients(tourData)
    const orderPromises = []

    for (let i = 0; i < Math.min(orderCount, allRecipients.length); i++) {
      const recipient = allRecipients[i]
      
      // Create line items - for single-item batch, randomly select one SKU from pool
      const randomSkuIndex = Math.floor(Math.random() * workflowSkus.length)
      const selectedSku = workflowSkus[randomSkuIndex]
      const orderNumber = `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      const lineItems = [{
        sku: selectedSku,
        partner_line_item_id: `${orderNumber}-1`,
        quantity: 1,
        price: "0.00",
        product_name: selectedSku,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }]
      
      console.log(`   📦 SINGLE Order ${i + 1}: 1 SKU - ${selectedSku} (qty: 1)`)

      const orderData = {
        order_number: `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`,
        shop_name: "ShipHero Tour Demo",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: "10.00", 
        total_discounts: "0.00",
        total_price: "10.00",
        auto_print_return_label: false,
        
        shipping_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        line_items: lineItems,
        
        shipping_lines: {
          title: "Tour Demo Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        
        required_ship_date: tourData.date,
        tags: [`tour-${tourData.tour_numeric_id}`, `workflow-${orderPrefix.toLowerCase()}`, `recipient-${recipient.type}`, tourData.warehouse.code].filter(Boolean)
      }

      console.log(`📦 Creating order ${i + 1}/${orderCount} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name}`)
      orderPromises.push(this.createSalesOrderViaAPI(orderData))
    }

    const results = await Promise.allSettled(orderPromises)
    const successfulOrders = results.filter(result => result.status === 'fulfilled').length
    
    console.log(`✅ ${orderPrefix} orders created: ${successfulOrders}/${orderCount}`)
    
    if (successfulOrders < orderCount) {
      const failedCount = orderCount - successfulOrders
      console.warn(`⚠️ ${failedCount} ${orderPrefix} orders failed to create`)
    }
    
    return results.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean)
  }

  /**
   * Helper method to create orders with randomized SKU selection (for multi-item batch)
   */
  private async createRandomizedOrdersForWorkflow(tourData: TourData, orderPrefix: string, orderCount: number, availableSkus: string[]): Promise<any[]> {
    console.log(`Creating ${orderCount} randomized orders from ${availableSkus.length} available SKUs...`)
    
    if (availableSkus.length === 0) {
      throw new Error(`No SKUs selected for ${orderPrefix}. Please select SKUs when creating the tour.`)
    }

    const allRecipients = await this.getAllOrderRecipients(tourData)
    const orderPromises = []

    for (let i = 0; i < Math.min(orderCount, allRecipients.length); i++) {
      const recipient = allRecipients[i]
      
      // Multi-item batch: Always use exactly 2 SKUs per order
      const numSkus = 2
      const shuffled = [...availableSkus]
      
      // Fisher-Yates shuffle with better randomization
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
      }
      
      const selectedSkus = shuffled.slice(0, Math.min(numSkus, availableSkus.length))
      const orderNumber = `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      // Create line items with random quantities (1-2 units each) and all required fields
      const lineItems = selectedSkus.map((sku, index) => {
        const quantity = Math.floor(Math.random() * 2) + 1 // Random 1 or 2
        return {
          sku: sku,
          partner_line_item_id: `${orderNumber}-${index + 1}`,
          quantity: quantity,
          price: "0.00",
          product_name: sku,
          fulfillment_status: "pending",
          quantity_pending_fulfillment: quantity,
          warehouse_id: tourData.warehouse.shiphero_warehouse_id
        }
      })
      
      console.log(`🎲 Order ${i + 1}/${orderCount}: ${selectedSkus.length} SKUs selected - [${selectedSkus.join(', ')}]`)
      console.log(`   Quantities: ${lineItems.map(li => `${li.sku}:${li.quantity}`).join(', ')}`)

      const orderData = {
        order_number: `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`,
        shop_name: "ShipHero Tour Demo",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: "10.00", 
        total_discounts: "0.00",
        total_price: "10.00",
        auto_print_return_label: false,
        
        shipping_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        line_items: lineItems,
        
        shipping_lines: {
          title: "Tour Demo Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        
        required_ship_date: tourData.date,
        tags: [`tour-${tourData.tour_numeric_id}`, `workflow-${orderPrefix.toLowerCase()}`, `recipient-${recipient.type}`, tourData.warehouse.code].filter(Boolean)
      }

      console.log(`📦 Creating randomized order ${i + 1}/${orderCount} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name} (${lineItems.length} SKUs)`)
      orderPromises.push(this.createSalesOrderViaAPI(orderData))
    }

    const results = await Promise.allSettled(orderPromises)
    const successfulOrders = results.filter(result => result.status === 'fulfilled').length
    
    console.log(`✅ ${orderPrefix} randomized orders created: ${successfulOrders}/${orderCount}`)
    
    if (successfulOrders < orderCount) {
      const failedCount = orderCount - successfulOrders
      console.warn(`⚠️ ${failedCount} ${orderPrefix} orders failed to create`)
    }
    
    return results.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean)
  }

  /**
   * Helper method to create pack-to-light orders with all selected SKUs (1 unit each)
   */
  private async createPackToLightOrdersForWorkflow(tourData: TourData, orderPrefix: string, orderCount: number, workflowSkus: string[]): Promise<any[]> {
    console.log(`Creating ${orderCount} pack-to-light orders with ${workflowSkus.length} SKUs each...`)
    
    if (workflowSkus.length === 0) {
      throw new Error(`No SKUs selected for ${orderPrefix}. Please select SKUs when creating the tour.`)
    }

    const allRecipients = await this.getAllOrderRecipients(tourData)
    const orderPromises = []

    for (let i = 0; i < Math.min(orderCount, allRecipients.length); i++) {
      const recipient = allRecipients[i]
      
      // Pack to light: Include all selected SKUs with 1 unit each and all required fields
      const orderNumber = `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      const lineItems = workflowSkus.map((sku, index) => ({
        sku: sku,
        partner_line_item_id: `${orderNumber}-${index + 1}`,
        quantity: 1,
        price: "0.00",
        product_name: sku,
        fulfillment_status: "pending",
        quantity_pending_fulfillment: 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }))

      const orderData = {
        order_number: `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`,
        shop_name: "ShipHero Tour Demo",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: "10.00", 
        total_discounts: "0.00",
        total_price: "10.00",
        auto_print_return_label: false,
        
        shipping_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "555-0123"
        },
        
        line_items: lineItems,
        
        shipping_lines: {
          title: "Tour Demo Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        
        required_ship_date: tourData.date,
        tags: [`tour-${tourData.tour_numeric_id}`, `workflow-${orderPrefix.toLowerCase()}`, `recipient-${recipient.type}`, tourData.warehouse.code].filter(Boolean)
      }

      console.log(`📦 Creating pack-to-light order ${i + 1}/${orderCount} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name} (${lineItems.length} SKUs)`)
      orderPromises.push(this.createSalesOrderViaAPI(orderData))
    }

    const results = await Promise.allSettled(orderPromises)
    const successfulOrders = results.filter(result => result.status === 'fulfilled').length
    
    console.log(`✅ ${orderPrefix} orders created: ${successfulOrders}/${orderCount}`)
    
    if (successfulOrders < orderCount) {
      const failedCount = orderCount - successfulOrders
      console.warn(`⚠️ ${failedCount} ${orderPrefix} orders failed to create`)
    }
    
    return results.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean)
  }

  /**
   * Get warehouse shipping address for order creation
   */
  private getWarehouseShippingAddress(tourData: TourData) {
    return {
      address1: tourData.warehouse.address,
      address2: tourData.warehouse.address2 || "",
      city: tourData.warehouse.city,
      state: tourData.warehouse.state,
      zip: tourData.warehouse.zip,
      country: "US"
    }
  }
}

import { createClient } from '@/lib/supabase/client'
import { tenantConfigService } from '@/lib/tenant-config-service'

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
  private createdOrders: Array<{
    workflow: string
    order_number: string
    shiphero_id: string
    legacy_id: string
    recipient: string
  }> = []

  private createdPurchaseOrders: Array<{
    workflow: string
    po_number: string
    shiphero_id: string
    legacy_id: string
  }> = []

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Calculate one business day before the tour date with current Eastern time
   * Skips weekends (Saturday = 6, Sunday = 0)
   */
  private getOrderDate(tourDate: string): string {
    console.log(`📅 Calculating order date for tour date: ${tourDate}`)
    
    const tour = new Date(tourDate + 'T00:00:00')
    let orderDate = new Date(tour)
    
    // Go back one day
    orderDate.setDate(orderDate.getDate() - 1)
    
    // If it's a weekend, go back to Friday
    const dayOfWeek = orderDate.getDay()
    if (dayOfWeek === 0) { // Sunday
      orderDate.setDate(orderDate.getDate() - 2) // Go to Friday
      console.log(`📅 Tour is on Monday, moving order date back to Friday`)
    } else if (dayOfWeek === 6) { // Saturday
      orderDate.setDate(orderDate.getDate() - 1) // Go to Friday
      console.log(`📅 Tour is on Sunday, moving order date back to Friday`)
    }
    
    // Get current time in Eastern timezone
    const now = new Date()
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    
    // Combine the order date with current Eastern time
    const orderDateStr = orderDate.toISOString().split('T')[0]
    const easternTimeStr = easternTime.toISOString().split('T')[1]
    const fullOrderDateTime = `${orderDateStr}T${easternTimeStr}`
    
    console.log(`📅 Final order date/time: ${fullOrderDateTime} (${orderDateStr} with Eastern time)`)
    
    return fullOrderDateTime
  }

  /**
   * Calculate the hold until date/time (tour date at 1:00 AM Eastern - 5 hours earlier than before)
   * Returns null if hold until is disabled in settings
   */
  private async getHoldUntilDate(tourDate: string, tourTime: string): Promise<string | null> {
    console.log(`⏳ Calculating hold until date for tour: ${tourDate} at ${tourTime}`)
    
    // Check if hold until is enabled in tenant config
    const { tenantConfigService } = await import('@/lib/tenant-config-service')
    const isHoldUntilEnabled = await tenantConfigService.isHoldUntilEnabled()
    
    if (!isHoldUntilEnabled) {
      console.log(`🔒 Hold Until is DISABLED in settings - not setting hold_until date`)
      return null
    }
    
    console.log(`🔒 Hold Until is ENABLED in settings - calculating hold_until date`)
    
    // Create 1:00 AM Eastern time on the tour date (5 hours earlier than 6:00 AM)
    // We'll create a date string for 1:00 AM and let JavaScript handle the timezone conversion
    const easternTime1AM = new Date(`${tourDate}T01:00:00-05:00`) // EST (Eastern Standard Time)
    
    // Convert to UTC for ShipHero API
    const holdUntilDateTime = easternTime1AM.toISOString()
    
    console.log(`⏳ Hold until date/time: ${holdUntilDateTime} (release orders at 1:00 AM Eastern on tour date)`)
    
    return holdUntilDateTime
  }

  /**
   * Get the required ship date (tour date)
   */
  private getRequiredShipDate(tourDate: string): string {
    console.log(`📅 Setting required ship date to tour date: ${tourDate}`)
    return tourDate
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
    
    const total = bulkCount + singleCount + multiCount
    console.log(`📊 Total orders needed: ${total} (bulk: ${bulkCount}, single: ${singleCount}, multi: ${multiCount})`)
    
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
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

      // Calculate total fulfillment orders needed across ALL workflows
      const fulfillmentWorkflows = selectedOptions.filter(option => 
        ['bulk_shipping', 'single_item_batch', 'multi_item_batch', 'pack_to_light'].includes(option)
      )
      
      let totalFulfillmentOrders = 0
      const workflowOrderCounts: {[key: string]: number} = {}
      
      for (const workflow of fulfillmentWorkflows) {
        const workflowConfig = tourData.workflow_configs?.[workflow]
        const orderCount = workflowConfig?.orderCount || 5
        workflowOrderCounts[workflow] = orderCount
        totalFulfillmentOrders += orderCount
      }
      
      console.log(`\n📊 FULFILLMENT ORDER DISTRIBUTION:`)
      console.log(`Total fulfillment orders needed: ${totalFulfillmentOrders}`)
      console.log(`Workflow breakdown:`, workflowOrderCounts)
      
      // Create ONE master recipient list for ALL fulfillment workflows
      let masterRecipients: any[] = []
      if (totalFulfillmentOrders > 0) {
        console.log(`\n👥 Creating master recipient list for ${totalFulfillmentOrders} total fulfillment orders...`)
        masterRecipients = await this.getFulfillmentRecipients(tourData, totalFulfillmentOrders)
        console.log(`✅ Master recipients: ${masterRecipients.length} (${masterRecipients.filter(r => r.type === 'participant').length} participants, ${masterRecipients.filter(r => r.type === 'host').length} host, ${masterRecipients.filter(r => r.type === 'extra').length} extras)`)
      }
      
      // Track recipient index across all workflows
      let recipientIndex = 0
      const workflowErrors: string[] = []

      // Execute each selected workflow with individual error handling
      for (const option of selectedOptions) {
        console.log(`\n🔄 Executing workflow: ${option}`)
        
        try {
          switch (option) {
            case "standard_receiving":
              console.log("Executing: Standard Receiving Workflow")
              await this.createStandardReceivingWorkflow(tourData)
              console.log("✅ Standard Receiving Workflow completed successfully")
              break
              
            case "bulk_shipping":
              console.log("Executing: Bulk Shipping Workflow")
              const bshipOrderCount = workflowOrderCounts[option] || 5
              const bshipRecipients = masterRecipients.slice(recipientIndex, recipientIndex + bshipOrderCount)
              await this.createBulkShippingSOs(tourData, bshipRecipients)
              recipientIndex += bshipOrderCount
              console.log("✅ Bulk Shipping Workflow completed successfully")
              break
              
            case "single_item_batch":
              console.log("Executing: Single-Item Batch Workflow")
              const sibOrderCount = workflowOrderCounts[option] || 5
              const sibRecipients = masterRecipients.slice(recipientIndex, recipientIndex + sibOrderCount)
              await this.createSingleItemBatchSOs(tourData, sibRecipients)
              recipientIndex += sibOrderCount
              console.log("✅ Single-Item Batch Workflow completed successfully")
              break
              
            case "multi_item_batch":
              console.log("Executing: Multi-Item Batch Workflow")
              const mibOrderCount = workflowOrderCounts[option] || 5
              const mibRecipients = masterRecipients.slice(recipientIndex, recipientIndex + mibOrderCount)
              await this.createMultiItemBatchSOs(tourData, mibRecipients)
              recipientIndex += mibOrderCount
              console.log("✅ Multi-Item Batch Workflow completed successfully")
              break
              
            case "pack_to_light":
              console.log("Executing: Pack to Light Workflow")
              const p2lOrderCount = workflowOrderCounts[option] || 5
              const p2lRecipients = masterRecipients.slice(recipientIndex, recipientIndex + p2lOrderCount)
              await this.createPackToLightSOs(tourData, p2lRecipients)
              recipientIndex += p2lOrderCount
              console.log("✅ Pack to Light Workflow completed successfully")
              break
              
            default:
              console.warn(`⚠️ Unknown workflow option: ${option}`)
          }
        } catch (workflowError: any) {
          const errorMessage = `${option} workflow failed: ${workflowError.message}`
          console.error(`❌ ${errorMessage}`)
          workflowErrors.push(errorMessage)
          
          // For fulfillment workflows, still increment recipient index to keep distribution consistent
          if (['bulk_shipping', 'single_item_batch', 'multi_item_batch'].includes(option)) {
            const orderCount = workflowOrderCounts[option] || 5
            recipientIndex += orderCount
            console.log(`⚠️ Skipping ${orderCount} recipients due to ${option} failure`)
          }
        }
      }

      // Generate instruction guide (disabled for now)
      // const instructionGuide = await this.generateInstructionGuide(tourId, createdOrders)
      // await this.saveInstructionGuide(tourId, instructionGuide)
      const instructionGuide = "Instruction guide generation temporarily disabled."

      // Determine overall success status
      const hasErrors = workflowErrors.length > 0
      const successfulWorkflows = selectedOptions.length - workflowErrors.length
      
      if (hasErrors) {
        console.log(`⚠️ Tour finalization completed with ${workflowErrors.length} workflow error(s)`)
        console.log(`✅ ${successfulWorkflows}/${selectedOptions.length} workflows completed successfully`)
        workflowErrors.forEach(error => console.error(`  - ${error}`))
      } else {
        console.log('✅ Tour finalization completed successfully!')
      }
      
      console.log(`📊 Total participants: ${tourData.participants?.length || 0}`)

      // Return separate arrays for sales and purchase orders
      const sales_orders = this.createdOrders // Sales orders from fulfillment workflows
      const purchase_orders = this.createdPurchaseOrders // Purchase orders from inbound workflows

      // Prepare comprehensive order summary for storage
      const orderSummary = {
        sales_orders: this.createdOrders.map(order => ({
          workflow: order.workflow,
          order_number: order.order_number,
          shiphero_id: order.shiphero_id,
          legacy_id: order.legacy_id,
          recipient: order.recipient
        })),
        purchase_orders: this.createdPurchaseOrders.map(po => ({
          workflow: po.workflow,
          po_number: po.po_number,
          shiphero_id: po.shiphero_id,
          legacy_id: po.legacy_id
        })),
        summary: {
          total_orders: this.createdOrders.length + this.createdPurchaseOrders.length,
          total_sales_orders: this.createdOrders.length,
          total_purchase_orders: this.createdPurchaseOrders.length,
          created_at: new Date().toISOString(),
          workflow_errors: workflowErrors
        }
      }

      // Update tour status to finalized and store order summary in database
      console.log('🔄 Updating tour status to finalized and storing order summary...')
      const { error: statusError } = await this.supabase
        .from('tours')
        .update({ 
          status: 'finalized',
          order_summary: orderSummary
        })
        .eq('id', tourId)

      if (statusError) {
        console.error('⚠️ Failed to update tour status:', statusError)
        // Don't fail the entire operation for a status update error
      } else {
        console.log('✅ Tour status updated to finalized and order summary stored')
      }

      // Print final summary of all created orders
      this.printFinalOrderSummary()

      // Generate instruction guide (disabled as requested)
      const instruction_guide = "Instruction guide generation disabled."
      
      const message = hasErrors 
        ? `Tour finalized with ${workflowErrors.length} workflow error(s). ${successfulWorkflows} workflows completed successfully. Created ${sales_orders.length} sales orders and ${purchase_orders.length} purchase orders.`
        : `Tour finalized successfully! Created ${sales_orders.length} sales orders and ${purchase_orders.length} purchase orders.`

      return {
        success: !hasErrors || (sales_orders.length > 0 || purchase_orders.length > 0), // Success if no errors OR if some orders were created
        message,
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
        purchase_orders: []
      }
    }
  }

  /**
   * MODULE 1: Creates a Purchase Order for "Standard Receiving" workflow
   */
  private async createStandardReceivingWorkflow(tourData: TourData): Promise<void> {
    console.log("🎯 Creating Standard Receiving Purchase Order...")
    
    // Get tenant configuration
    const config = await tenantConfigService.getConfig()
    
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

    // Purchase orders require specific fulfillment status
    const purchaseOrderFulfillmentStatus = await tenantConfigService.getPurchaseOrderFulfillmentStatus()
    
    console.log(`🔍 PURCHASE ORDER DEBUG:`)
    console.log(`  📊 PO Fulfillment Status: "${purchaseOrderFulfillmentStatus}" (from getPurchaseOrderFulfillmentStatus)`)
    console.log(`  🏭 Vendor ID: "${config.shiphero_vendor_id}"`)
    console.log(`  🏢 Warehouse ID: "${tourData.warehouse.shiphero_warehouse_id}"`)
    
    const poLineItems = Object.entries(skuQuantities).map(([sku, quantity]) => ({
      sku: sku,
      quantity: quantity,
      expected_weight_in_lbs: "1.00",
      vendor_id: config.shiphero_vendor_id,
      quantity_received: 0,
      quantity_rejected: 0,
      price: "0.00",
      product_name: sku,
      fulfillment_status: purchaseOrderFulfillmentStatus, // Always "pending" for purchase orders
      sell_ahead: 0
    }))

    const poData = {
      po_number: `STD_REC-${tourData.tour_numeric_id}-${Date.now()}`,
      po_date: this.getOrderDate(tourData.date),
      vendor_id: config.shiphero_vendor_id,
      warehouse_id: tourData.warehouse.shiphero_warehouse_id,
      subtotal: "0.00",
      tax: "0.00",
      shipping_price: "0.00", 
      total_price: "0.00",
      fulfillment_status: purchaseOrderFulfillmentStatus, // Always "pending" for purchase orders
      discount: "0.00",
      line_items: poLineItems
    }

    console.log(`📋 COMPLETE PO DATA BEING SENT:`)
    console.log(JSON.stringify(poData, null, 2))
    console.log("🔄 Creating Standard Receiving PO...")
    
    const result = await this.createPurchaseOrderViaAPI(poData)

    if (result.data?.purchase_order_create?.purchase_order) {
      const poInfo = result.data.purchase_order_create.purchase_order
      console.log("✅ Standard Receiving PO created successfully")
      console.log(`   📋 PO Number: ${poInfo.po_number}`)
      console.log(`   🆔 ShipHero ID: ${poInfo.id}`)
      console.log(`   🆔 Legacy ID: ${poInfo.legacy_id}`)
      console.log(`   💰 Total Price: ${poInfo.total_price}`)
      
      // Store for final summary
      this.createdPurchaseOrders.push({
        workflow: "STD_REC",
        po_number: poInfo.po_number,
        shiphero_id: poInfo.id,
        legacy_id: poInfo.legacy_id
      })
    } else {
      console.error("❌ Failed to create Standard Receiving PO")
      console.error("🔍 DETAILED PO API ERROR:")
      console.error("  📊 Full API Response:", JSON.stringify(result, null, 2))
      if (result.errors) {
        console.error("  ⚠️ GraphQL Errors:", result.errors)
      }
      if (result.data?.purchase_order_create?.user_errors) {
        console.error("  🚨 User Errors:", result.data.purchase_order_create.user_errors)
      }
      throw new Error(`Standard Receiving PO creation failed: ${JSON.stringify(result.errors || result.data?.purchase_order_create?.user_errors || 'Unknown error')}`)
    }
  }

  /**
   * MODULE 2: Creates Sales Orders for "Bulk Shipping"
   * Uses exact same format as adhoc sales orders with bship prefix
   */
  private async createBulkShippingSOs(tourData: TourData, recipients: any[]): Promise<void> {
    const workflowConfig = tourData.workflow_configs?.['bulk_shipping']
    const orderCount = recipients.length
    const skuQuantities = workflowConfig?.skuQuantities || {}
    const workflowSkus = Object.keys(skuQuantities).filter(sku => skuQuantities[sku] > 0)
    
    if (workflowSkus.length === 0) {
      console.log('⚠️ No SKUs selected for Bulk Shipping workflow')
      return
    }
    
    console.log(`Creating ${orderCount} bulk shipping orders with SKUs:`, workflowSkus)
    console.log(`Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    // Create orders using adhoc format with bship prefix and provided recipients
    await this.createFulfillmentOrdersWithRecipients(tourData, "bship", recipients, workflowSkus, skuQuantities)
    
    console.log(`✅ Bulk Shipping completed: ${orderCount} orders created`)
  }

  /**
   * MODULE 3: Creates Sales Orders for "Single-Item Batch Picking"  
   * Uses exact same format as adhoc sales orders with sib prefix
   */
  private async createSingleItemBatchSOs(tourData: TourData, recipients: any[]): Promise<void> {
    const workflowConfig = tourData.workflow_configs?.['single_item_batch']
    const orderCount = recipients.length
    const skuQuantities = workflowConfig?.skuQuantities || {}
    const workflowSkus = Object.keys(skuQuantities).filter(sku => skuQuantities[sku] > 0)
    
    if (workflowSkus.length === 0) {
      console.log('⚠️ No SKUs selected for Single-Item Batch workflow')
      return
    }
    
    console.log(`Creating ${orderCount} single-item batch orders with SKUs:`, workflowSkus)
    console.log(`Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    // Create orders using adhoc format with sib prefix and provided recipients
    await this.createFulfillmentOrdersWithRecipients(tourData, "sib", recipients, workflowSkus, skuQuantities)
    
    console.log(`✅ Single-Item Batch completed: ${orderCount} orders created`)
  }

  /**
   * MODULE 4: Creates Sales Orders for "Multi-Item Batch Picking"
   * Uses randomized subset of SKUs with weighted random quantities for variety
   */
  private async createMultiItemBatchSOs(tourData: TourData, recipients: any[]): Promise<void> {
    console.log(`🔍 MIB DEBUG - createMultiItemBatchSOs called with:`, {
      tourData: !!tourData,
      recipients: recipients ? recipients.length : 'undefined',
      recipientsType: typeof recipients,
      recipientsIsArray: Array.isArray(recipients)
    })
    
    if (!recipients || !Array.isArray(recipients)) {
      throw new Error(`Multi-Item Batch: Invalid recipients parameter: ${recipients}`)
    }
    
    const orderCount = recipients.length
    
    console.log(`🎲 Creating ${orderCount} RANDOMIZED multi-item batch orders`)
    console.log(`👥 Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    try {
      // Get all available SKUs from the system
      console.log(`🔍 Loading all products from ShipHero...`)
      const { shipHeroDataService } = await import('@/lib/shiphero/data-service')
      const allProducts = await shipHeroDataService.getActiveProducts()
      console.log(`📦 Loaded ${allProducts.length} total products`)
      
      // Get Pack to Light SKUs to exclude them
      const packToLightConfig = tourData.workflow_configs?.['pack_to_light']
      const packToLightSkus = packToLightConfig?.skuQuantities ? 
        Object.keys(packToLightConfig.skuQuantities).filter(sku => packToLightConfig.skuQuantities[sku] > 0) : 
        []
      
      console.log(`🚫 Pack to Light SKUs to exclude:`, packToLightSkus)
      
      // Filter available SKUs (exclude Pack to Light SKUs and ensure inventory > 0)
      const availableSkus = allProducts
        .filter(product => 
          product.inventory?.available > 0 && // Has inventory
          !packToLightSkus.includes(product.sku) // Not used in Pack to Light
        )
        .map(product => product.sku)
      
      console.log(`📦 Found ${availableSkus.length} available SKUs after filtering`)
      
      if (availableSkus.length < 3) {
        console.log(`⚠️ Not enough SKUs for randomization. Using fallback method.`)
        // Fallback to old method
        const workflowConfig = tourData.workflow_configs?.['multi_item_batch']
        const skuQuantities = workflowConfig?.skuQuantities || {}
        const configuredSkus = Object.keys(skuQuantities).filter(sku => skuQuantities[sku] > 0)
        
        await this.createFulfillmentOrdersWithRecipients(
          tourData, 
          "mib", 
          recipients, 
          configuredSkus, 
          skuQuantities
        )
        return
      }
      
      console.log(`🎲 Proceeding with randomization using ${availableSkus.length} SKUs`)
      
      // Create randomized orders one by one (safer approach)
      await this.createRandomizedMultiItemOrdersSafe(tourData, recipients, availableSkus)
      
    } catch (error: any) {
      console.error(`❌ Error in randomization:`, error.message)
      // Don't fallback to avoid duplicate order numbers
      throw error
    }
    
    console.log(`✅ Multi-Item Batch completed: ${orderCount} orders created`)
  }

  /**
   * Safer method to create randomized multi-item batch orders
   * Each order gets different SKUs and quantities
   */
  private async createRandomizedMultiItemOrdersSafe(tourData: TourData, recipients: any[], availableSkus: string[]): Promise<void> {
    console.log(`🚀 STARTING SAFE RANDOMIZED MIB - Creating ${recipients.length} orders`)
    console.log(`📦 Available SKUs pool: ${availableSkus.length} SKUs`)
    
    // Create each order individually with different random SKUs
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      
      // Randomly select 2 SKUs (most common case) with 1 unit each for simplicity
      const shuffledSkus = [...availableSkus].sort(() => 0.5 - Math.random())
      const selectedSkus = shuffledSkus.slice(0, 2) // Always 2 SKUs for now
      
      // Create a simple SKU quantities object for this order
      const skuQuantities: {[sku: string]: number} = {}
      selectedSkus.forEach(sku => {
        skuQuantities[sku] = 1 // Always 1 unit for simplicity
      })
      
      console.log(`🎲 Order ${i + 1}: SKUs [${selectedSkus.join(', ')}] with 1 unit each`)
      
      // Use the working method but with randomized SKUs for just this recipient
      // Use unique prefix to avoid conflicts
      await this.createFulfillmentOrdersWithRecipients(
        tourData, 
        `mib-r${i+1}`, // Unique prefix for each randomized order
        [recipient], // Single recipient
        selectedSkus, // Random SKUs for this order
        skuQuantities // 1 unit each
      )
    }
    
    console.log(`✅ All ${recipients.length} randomized multi-item batch orders created`)
  }

  /**
   * MODULE 5: Creates Sales Orders for "Pack to Light"
   * Uses same logic as bulk shipping but with p2l prefix and ps01 tag
   */
  private async createPackToLightSOs(tourData: TourData, recipients: any[]): Promise<void> {
    const workflowConfig = tourData.workflow_configs?.['pack_to_light']
    const orderCount = recipients.length
    const skuQuantities = workflowConfig?.skuQuantities || {}
    const availableSkus = Object.keys(skuQuantities).filter(sku => skuQuantities[sku] > 0)
    
    if (availableSkus.length === 0) {
      console.log('⚠️ No SKUs selected for Pack to Light workflow. Please configure SKUs in Settings > Configuration.')
      return
    }
    
    console.log(`Creating ${orderCount} pack to light orders with SKUs:`, availableSkus)
    console.log(`Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    console.log(`🚀 STARTING P2L WORKFLOW - Creating ${orderCount} orders`)
    console.log(`📋 Tour ID: ${tourData.id}, Tour Numeric ID: ${tourData.tour_numeric_id}`)
    console.log(`🏢 Warehouse: ${tourData.warehouse.name} (${tourData.warehouse.code})`)
    console.log(`🏷️ Warehouse code for tagging: ${tourData.warehouse.code}`)
    console.log(`📦 Selected SKUs:`, availableSkus)
    console.log(`🔢 SKU Quantities:`, skuQuantities)
    console.log(`👥 Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))

    // Use the existing createFulfillmentOrdersWithRecipients method with custom fulfillment status
    await this.createFulfillmentOrdersWithRecipients(
      tourData, 
      "p2l", 
      recipients, 
      availableSkus, // Just the SKU strings
      skuQuantities, // Separate quantities object
      ['ps01'], // Special tag for pack to light
      "Pack to Light" // Custom fulfillment status for Pack to Light orders
    )
    
    console.log(`✅ Pack to Light completed: ${orderCount} orders created`)
  }

  /**
   * Create fulfillment orders using exact adhoc sales order format with pre-calculated recipients
   */
  private async createFulfillmentOrdersWithRecipients(
    tourData: TourData, 
    prefix: string, 
    recipients: any[],
    workflowSkus: string[], 
    skuQuantities: {[sku: string]: number},
    extraTags: string[] = [],
    customFulfillmentStatus?: string
  ): Promise<void> {
    console.log(`🚀 STARTING ${prefix.toUpperCase()} WORKFLOW - Creating ${recipients.length} orders`)
    console.log(`📋 Tour ID: ${tourData.id}, Tour Numeric ID: ${tourData.tour_numeric_id}`)
    console.log(`🏢 Warehouse: ${tourData.warehouse.name} (${tourData.warehouse.code})`)
    console.log(`🏷️ Warehouse code for tagging:`, tourData.warehouse.code)
    console.log(`📦 Selected SKUs:`, workflowSkus)
    if (customFulfillmentStatus) {
      console.log(`🎯 Using CUSTOM fulfillment status: "${customFulfillmentStatus}"`)
    }
    console.log(`🔢 SKU Quantities:`, skuQuantities)
    console.log(`👥 Recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    // Create each order using exact adhoc format
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      
      // Generate order number with prefix first
      const orderNumber = `${prefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      // Create line items - all selected SKUs with their quantities
      const lineItems = workflowSkus.map((sku, index) => ({
        sku: sku,
        partner_line_item_id: `${orderNumber}-item-${index + 1}`,
        quantity: skuQuantities[sku] || 1,
        price: "0.00",
        product_name: sku, // Use SKU as product name
        fulfillment_status: customFulfillmentStatus || "Tour_Orders",
        quantity_pending_fulfillment: skuQuantities[sku] || 1,
        warehouse_id: tourData.warehouse.shiphero_warehouse_id
      }))
      
      // Create order data - EXACTLY like adhoc sales order
      // Get tenant configuration
      const config = await tenantConfigService.getConfig()
      
      const orderData = {
        order_number: orderNumber,
        shop_name: await tenantConfigService.getShopName(),
        fulfillment_status: customFulfillmentStatus || await tenantConfigService.getDefaultFulfillmentStatus(),
        order_date: this.getOrderDate(tourData.date), // One business day before tour date
        total_tax: "0.00",
        subtotal: "0.00",
        total_discounts: "0.00", 
        total_price: "0.00",
        
        shipping_lines: {
          title: "Generic Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Standard"
        },
        
        shipping_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company || config.company_name,
          address1: tourData.warehouse.address,
          address2: "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: tourData.warehouse.country || "US",
          country_code: tourData.warehouse.country || "US",
          email: recipient.email,
          phone: ""
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company || config.company_name,
          address1: tourData.warehouse.address,
          address2: "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state,
          state_code: tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: tourData.warehouse.country || "US",
          country_code: tourData.warehouse.country || "US",
          email: recipient.email,
          phone: ""
        },
        
        required_ship_date: this.getRequiredShipDate(tourData.date),
        tags: [`tour-${tourData.tour_numeric_id}`, tourData.warehouse.code, ...extraTags].filter(Boolean),
        line_items: lineItems
      }

      // Add hold_until_date only if enabled in settings
      const holdUntilDate = await this.getHoldUntilDate(tourData.date, tourData.time)
      if (holdUntilDate) {
        orderData.hold_until_date = holdUntilDate
      }
      
      console.log(`📦 Creating order ${i + 1}/${recipients.length} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name}`)
      
      try {
        const result = await this.createSalesOrderViaAPI(orderData)
        
        // Check for GraphQL errors first
        if (result?.errors && result.errors.length > 0) {
          console.error(`❌ ShipHero GraphQL errors for ${orderNumber}:`, result.errors)
          throw new Error(`ShipHero API error: ${result.errors[0].message}`)
        }
        
        if (result?.data?.order_create?.order) {
          const createdOrder = result.data.order_create.order
          console.log(`✅ Order created: ${orderNumber} (ShipHero ID: ${createdOrder.legacy_id})`)
          
          // Store created order for summary
          this.createdOrders.push({
            workflow: prefix.startsWith('mib-r') ? 'multi_item_batch' : prefix, // Group all MIB orders under same workflow
            order_number: orderNumber,
            shiphero_id: createdOrder.id,
            legacy_id: createdOrder.legacy_id,
            recipient: recipient.type === 'extra' ? `${recipient.first_name} ${recipient.last_name} (extra)` : `${recipient.first_name} ${recipient.last_name}`
          })
        } else {
          console.error(`❌ Unexpected API response structure for ${orderNumber}`)
          console.error(`   result.data:`, result?.data)
          throw new Error('Invalid response structure from ShipHero API')
        }
      } catch (error) {
        console.error(`❌ Failed to create order ${orderNumber}:`, error)
        throw error
      }
    }
  }

  /**
   * Create randomized multi-item orders with variety in SKU selection and quantities
   */
  private async createRandomizedMultiItemOrders(
    tourData: TourData, 
    prefix: string, 
    recipients: any[],
    availableSkus: string[]
  ): Promise<void> {
    console.log(`🎲 CREATING RANDOMIZED MULTI-ITEM ORDERS`)
    console.log(`📋 Available SKUs: ${availableSkus.length} (${availableSkus.join(', ')})`)
    console.log(`👥 Recipients: ${recipients.length}`)
    
    // Helper function to get weighted random quantity (1=70%, 2=25%, 3=5%)
    const getRandomQuantity = (): number => {
      const rand = Math.random()
      if (rand < 0.70) return 1      // 70% chance
      if (rand < 0.95) return 2      // 25% chance  
      return 3                       // 5% chance
    }
    
    // Helper function to get random subset of SKUs (2-4 SKUs per order)
    const getRandomSkuSubset = (skus: string[]): string[] => {
      const minSkus = 2
      const maxSkus = Math.min(4, skus.length) // Max 4 SKUs or all available if less
      const skuCount = Math.floor(Math.random() * (maxSkus - minSkus + 1)) + minSkus
      
      // Shuffle and take first N SKUs
      const shuffled = [...skus].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, skuCount)
    }
    
    // Create each order with randomized SKUs and quantities
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const orderNumber = `${prefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      // Get random subset of SKUs for this order
      const orderSkus = getRandomSkuSubset(availableSkus)
      
      console.log(`🎲 Order ${i + 1}/${recipients.length}: ${orderNumber}`)
      console.log(`   📦 Selected SKUs: ${orderSkus.join(', ')}`)
      
      // Create line items with random quantities
      const lineItems = orderSkus.map((sku, index) => {
        const quantity = getRandomQuantity()
        console.log(`   🔢 ${sku}: ${quantity} unit${quantity > 1 ? 's' : ''}`)
        
        return {
          sku: sku,
          partner_line_item_id: `${orderNumber}-item-${index + 1}`,
          quantity: quantity,
          price: "0.00",
          product_name: sku,
          fulfillment_status: "Tour_Orders",
          quantity_pending_fulfillment: quantity,
          warehouse_id: tourData.warehouse.shiphero_warehouse_id
        }
      })
      
      // Get tenant configuration
      const config = await tenantConfigService.getConfig()
      
      // Create order data - EXACT same format as bulk shipping orders
      const orderData = {
        order_number: orderNumber,
        shop_name: await tenantConfigService.getShopName(),
        fulfillment_status: await tenantConfigService.getDefaultFulfillmentStatus(),
        order_date: this.getOrderDate(tourData.date),
        total_tax: "0.00",
        subtotal: "0.00",
        total_discounts: "0.00",
        total_price: "0.00",
        required_ship_date: tourData.date,
        shipping_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          address1: recipient.address || tourData.warehouse.address,
          address2: recipient.address2 || "",
          city: recipient.city || tourData.warehouse.city,
          state: recipient.state || tourData.warehouse.state,
          state_code: recipient.state || tourData.warehouse.state,
          zip: recipient.zip || tourData.warehouse.zip,
          country: recipient.country || "US",
          country_code: recipient.country || "US"
        },
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          address1: recipient.address || tourData.warehouse.address,
          address2: recipient.address2 || "",
          city: recipient.city || tourData.warehouse.city,
          state: recipient.state || tourData.warehouse.state,
          state_code: recipient.state || tourData.warehouse.state,
          zip: recipient.zip || tourData.warehouse.zip,
          country: recipient.country || "US",
          country_code: recipient.country || "US"
        },
        shipping_lines: [{
          title: "Standard Shipping",
          price: "0.00"
        }],
        line_items: lineItems,
        tags: [
          `tour-${tourData.tour_numeric_id}`,
          `warehouse-${tourData.warehouse.code}`,
          `workflow-multi-item-batch`,
          `randomized-order`
        ]
      }

      // Add hold_until only if enabled in settings
      const holdUntilDate = await this.getHoldUntilDate(tourData.date, tourData.time)
      if (holdUntilDate) {
        orderData.hold_until = holdUntilDate
      }
      
      try {
        console.log(`🔄 Creating randomized order ${orderNumber}...`)
        const result = await this.createSalesOrderViaAPI(orderData)
        
        if (result.data?.order_create?.order) {
          const createdOrder = result.data.order_create.order
          console.log(`✅ Order ${orderNumber} created successfully`)
          console.log(`   🆔 ShipHero ID: ${createdOrder.id}`)
          console.log(`   🆔 Legacy ID: ${createdOrder.legacy_id}`)
          console.log(`   📦 Line Items: ${lineItems.length}`)
          console.log(`   🔢 Total Units: ${lineItems.reduce((sum, item) => sum + item.quantity, 0)}`)
          
          // Store for final summary
          this.createdOrders.push({
            workflow: prefix,
            order_number: orderNumber,
            shiphero_id: createdOrder.id,
            legacy_id: createdOrder.legacy_id,
            recipient: recipient.type === 'extra' ? `${recipient.first_name} ${recipient.last_name} (extra)` : `${recipient.first_name} ${recipient.last_name}`,
            line_items: lineItems.length,
            total_units: lineItems.reduce((sum, item) => sum + item.quantity, 0)
          })
        } else {
          console.error(`❌ Unexpected API response structure for ${orderNumber}`)
          throw new Error('Invalid response structure from ShipHero API')
        }
      } catch (error: any) {
        console.error(`❌ DETAILED ERROR for randomized order ${orderNumber}:`)
        console.error(`   🔍 Error Type: ${error.constructor.name}`)
        console.error(`   📝 Error Message: ${error.message}`)
        console.error(`   📊 HTTP Status: ${error.status || 'Unknown'}`)
        console.error(`   🔗 Request URL: ${error.url || 'Unknown'}`)
        console.error(`   📋 Order Data:`, JSON.stringify(orderData, null, 2))
        console.error(`   👤 Recipient:`, recipient)
        console.error(`   📦 Line Items:`, lineItems)
        console.error(`   🏢 Warehouse:`, tourData.warehouse)
        console.error(`   ⏰ Timestamp: ${new Date().toISOString()}`)
        
        if (error.response) {
          console.error(`   📡 Response Status: ${error.response.status}`)
          console.error(`   📡 Response Headers:`, error.response.headers)
          console.error(`   📡 Response Data:`, error.response.data)
        }
        
        if (error.stack) {
          console.error(`   📚 Stack Trace:`, error.stack)
        }
        
        throw error
      }
    }
    
    console.log(`🎲 Randomized Multi-Item Batch Summary:`)
    console.log(`   📦 Orders Created: ${recipients.length}`)
    console.log(`   🎯 Each order has 2-4 random SKUs`)
    console.log(`   🔢 Quantities: 1 unit (70%), 2 units (25%), 3 units (5%)`)
  }

  /**
   * Create fulfillment orders using exact adhoc sales order format
   * Priority: Host -> Participants -> Extras from database
   * @deprecated Use createFulfillmentOrdersWithRecipients instead
   */
  private async createFulfillmentOrders(
    tourData: TourData, 
    prefix: string, 
    orderCount: number, 
    workflowSkus: string[], 
    skuQuantities: {[sku: string]: number}
  ): Promise<void> {
    console.log(`🚀 STARTING ${prefix.toUpperCase()} WORKFLOW - Creating ${orderCount} orders`)
    console.log(`📋 Tour ID: ${tourData.id}, Tour Numeric ID: ${tourData.tour_numeric_id}`)
    console.log(`🏢 Warehouse: ${tourData.warehouse.name} (${tourData.warehouse.code})`)
    console.log(`🏷️ Warehouse code for tagging:`, tourData.warehouse.code)
    console.log(`📦 Selected SKUs:`, workflowSkus)
    console.log(`🔢 SKU Quantities:`, skuQuantities)
    
    // Get recipients in priority order: host -> participants -> extras
    console.log(`👥 Getting recipients for ${orderCount} orders...`)
    const recipients = await this.getFulfillmentRecipients(tourData, orderCount)
    console.log(`✅ Got ${recipients.length} recipients:`, recipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`).join(', '))
    
    // Create each order using exact adhoc format
    for (let i = 0; i < Math.min(orderCount, recipients.length); i++) {
      const recipient = recipients[i]
      
      // Create line items - all selected SKUs with their quantities
      const lineItems = workflowSkus.map(sku => ({
        sku: sku,
        quantity: skuQuantities[sku] || 1,
        price: "0.00"
      }))
      
      // Generate order number with prefix
      const orderNumber = `${prefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      // Create order data - EXACTLY like adhoc sales order
      const orderData = {
        order_number: orderNumber,
        shop_name: "ShipHero Tour Demo",
        fulfillment_status: "Tour_Orders",
        order_date: this.getOrderDate(tourData.date), // One business day before tour date
        total_tax: "0.00",
        subtotal: "0.00",
        total_discounts: "0.00", 
        total_price: "0.00",
        
        shipping_lines: {
          title: "Generic Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        
        shipping_address: {
          first_name: tourData.warehouse.name,
          last_name: "Warehouse", 
          company: tourData.warehouse.name,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          state_code: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "5555555555"
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          state_code: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "5555555555"
        },
        
        line_items: lineItems.map((item, index) => ({
          sku: item.sku,
          partner_line_item_id: `${orderNumber}-${index + 1}`,
          quantity: item.quantity,
          price: item.price,
          product_name: item.sku,
          fulfillment_status: "Tour_Orders",
          quantity_pending_fulfillment: item.quantity,
          warehouse_id: tourData.warehouse.shiphero_warehouse_id
        })),
        
        required_ship_date: this.getRequiredShipDate(tourData.date),
        tags: [`tour-${tourData.tour_numeric_id}`, tourData.warehouse.code].filter(Boolean)
      }

      // Add hold_until_date only if enabled in settings
      const holdUntilDate = await this.getHoldUntilDate(tourData.date, tourData.time)
      if (holdUntilDate) {
        orderData.hold_until_date = holdUntilDate
      }
      
      console.log(`📦 Creating ${prefix} order ${i + 1}/${orderCount} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name}`)
      console.log(`🔗 Order Number: ${orderNumber}`)
      console.log(`📧 Recipient Email: ${recipient.email}`)
      console.log(`🏷️ Order Tags:`, orderData.tags)
      console.log(`🏷️ Warehouse code in tags:`, tourData.warehouse.code)
      console.log(`📋 Line Items:`, orderData.line_items.map(item => `${item.sku} x${item.quantity}`).join(', '))
      
      try {
        console.log(`🌐 Sending API request to create ${prefix} order...`)
        const result = await this.createSalesOrderViaAPI(orderData)
        
        if (result?.data?.order_create?.order) {
          const orderInfo = result.data.order_create.order
          console.log(`✅ ${prefix} order ${i + 1} created successfully!`)
          console.log(`   📋 Order Number: ${orderInfo.order_number}`)
          console.log(`   🆔 ShipHero ID: ${orderInfo.id}`)
          console.log(`   🆔 Legacy ID: ${orderInfo.legacy_id}`)
          console.log(`   💰 Total Price: ${orderInfo.total_price}`)
          console.log(`   📊 Status: ${orderInfo.fulfillment_status}`)
          
          // Store for final summary
          this.createdOrders = this.createdOrders || []
          this.createdOrders.push({
            workflow: prefix,
            order_number: orderInfo.order_number,
            shiphero_id: orderInfo.id,
            legacy_id: orderInfo.legacy_id,
            recipient: `${recipient.first_name} ${recipient.last_name} (${recipient.type})`
          })
        } else {
          console.error(`⚠️ ${prefix} order ${i + 1} API response missing order data:`, result)
        }
        
        if (result?.errors && result.errors.length > 0) {
          console.error(`🚨 GraphQL errors for ${prefix} order ${i + 1}:`, result.errors)
        }
        
      } catch (error) {
        console.error(`❌ CRITICAL ERROR creating ${prefix} order ${i + 1}:`)
        console.error(`   👤 Recipient: ${recipient.first_name} ${recipient.last_name} (${recipient.type})`)
        console.error(`   📋 Order Number: ${orderNumber}`)
        console.error(`   🔥 Error Details:`, error)
        console.error(`   📦 Order Data:`, JSON.stringify(orderData, null, 2))
      }
    }
  }

  /**
   * Get recipients for fulfillment orders: host -> participants -> extras
   */
  private async getFulfillmentRecipients(tourData: TourData, orderCount: number) {
    const recipients = []
    
    console.log(`🔍 Building recipient list for ${orderCount} orders...`)
    console.log(`👤 Host available: ${tourData.host ? 'YES' : 'NO'}`)
    console.log(`👥 Participants available: ${tourData.participants?.length || 0}`)
    
    // Add host first
    if (tourData.host) {
      const hostEmail = `${tourData.host.first_name.toLowerCase()}.${tourData.host.last_name.toLowerCase()}@shiphero.com`
      recipients.push({
        first_name: tourData.host.first_name,
        last_name: tourData.host.last_name,
        email: hostEmail,
        company: 'ShipHero',
        type: 'host'
      })
      console.log(`✅ Added host: ${tourData.host.first_name} ${tourData.host.last_name} (${hostEmail})`)
    }
    
    // Add participants
    if (tourData.participants) {
      for (const participant of tourData.participants) {
        recipients.push({
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          company: participant.company,
          type: 'participant'
        })
        console.log(`✅ Added participant: ${participant.first_name} ${participant.last_name} (${participant.email})`)
      }
    }
    
    console.log(`📊 Real people count: ${recipients.length}, Orders needed: ${orderCount}`)
    
    // Add extras if needed
    if (recipients.length < orderCount) {
      const extrasNeeded = orderCount - recipients.length
      console.log(`🔄 Need ${extrasNeeded} extra customers from database`)
      
      try {
        const extras = await this.getExtrasFromDatabase(extrasNeeded)
        console.log(`📥 Retrieved ${extras.length} extras from database`)
        
        for (const extra of extras) {
          recipients.push({
            first_name: extra.first_name,
            last_name: extra.last_name,
            email: extra.email,
            company: extra.company,
            type: 'extra'
          })
          console.log(`✅ Added extra: ${extra.first_name} ${extra.last_name} (${extra.email})`)
        }
      } catch (error) {
        console.error(`❌ Failed to get extras from database:`, error)
      }
    } else {
      console.log(`✅ Real people sufficient - no extras needed`)
    }
    
    const finalRecipients = recipients.slice(0, orderCount)
    console.log(`🎯 Final recipient list (${finalRecipients.length}):`, finalRecipients.map(r => `${r.first_name} ${r.last_name} (${r.type})`))
    
    return finalRecipients
  }

  /**
   * Print final summary of all created orders
   */
  private printFinalOrderSummary() {
    console.log('\n🎉 ========== FINAL ORDER SUMMARY ==========')
    
    const totalOrders = this.createdOrders.length + this.createdPurchaseOrders.length
    
    if (totalOrders === 0) {
      console.log('❌ No orders were created')
      return
    }
    
    console.log(`✅ Successfully created ${totalOrders} total orders:`)
    console.log(`   📦 ${this.createdOrders.length} Sales Orders`)
    console.log(`   📋 ${this.createdPurchaseOrders.length} Purchase Orders`)
    
    // Print Purchase Orders first (inbound workflows)
    if (this.createdPurchaseOrders.length > 0) {
      console.log('\n📋 ========== PURCHASE ORDERS ==========')
      
      // Group POs by workflow
      const posByWorkflow = this.createdPurchaseOrders.reduce((acc, po) => {
        if (!acc[po.workflow]) {
          acc[po.workflow] = []
        }
        acc[po.workflow].push(po)
        return acc
      }, {} as {[key: string]: typeof this.createdPurchaseOrders})
      
      Object.entries(posByWorkflow).forEach(([workflow, pos]) => {
        console.log(`\n📦 ${workflow.toUpperCase()} WORKFLOW (${pos.length} POs):`)
        pos.forEach((po, index) => {
          console.log(`   ${index + 1}. ${po.po_number}`)
          console.log(`      🆔 ShipHero ID: ${po.shiphero_id}`)
          console.log(`      🆔 Legacy ID: ${po.legacy_id}`)
        })
      })
    }
    
    // Print Sales Orders (fulfillment workflows)
    if (this.createdOrders.length > 0) {
      console.log('\n📦 ========== SALES ORDERS ==========')
      
      // Group orders by workflow
      const ordersByWorkflow = this.createdOrders.reduce((acc, order) => {
        if (!acc[order.workflow]) {
          acc[order.workflow] = []
        }
        acc[order.workflow].push(order)
        return acc
      }, {} as {[key: string]: typeof this.createdOrders})
      
      Object.entries(ordersByWorkflow).forEach(([workflow, orders]) => {
        console.log(`\n📦 ${workflow.toUpperCase()} WORKFLOW (${orders.length} orders):`)
        orders.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.order_number}`)
          console.log(`      🆔 ShipHero ID: ${order.shiphero_id}`)
          console.log(`      🆔 Legacy ID: ${order.legacy_id}`)
          console.log(`      👤 Recipient: ${order.recipient}`)
        })
      })
    }
    
    console.log('\n🎯 All orders created successfully! Check ShipHero dashboard for details.')
    console.log('========================================\n')
  }

  /**
   * Helper method to create orders using the new recipient system (participants + host + extras)
   * DEPRECATED - keeping for backward compatibility but should use createFulfillmentOrders
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
      
      // Create line items using the same format as adhoc sales orders
      const skuIndex = i % workflowSkus.length
      const selectedSku = workflowSkus[skuIndex]
      const lineItems = [{
        sku: selectedSku,
        quantity: 1,
        price: "0.00"
      }]

      const orderNumber = `${orderPrefix}-${tourData.tour_numeric_id}-${String(i + 1).padStart(3, '0')}`
      
      const orderData = {
        order_number: orderNumber,
        shop_name: "ShipHero Tour Demo",
        fulfillment_status: "pending",
        order_date: new Date().toISOString().split('T')[0], // Date only format like adhoc
        total_tax: "0.00",
        subtotal: "0.00", 
        total_discounts: "0.00",
        total_price: "0.00",
        
        shipping_lines: {
          title: "Generic Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        
        shipping_address: {
          first_name: tourData.warehouse.name,
          last_name: "Warehouse",
          company: tourData.warehouse.name,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          state_code: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "5555555555"
        },
        
        billing_address: {
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          company: recipient.company,
          address1: tourData.warehouse.address,
          address2: tourData.warehouse.address2 || "",
          city: tourData.warehouse.city,
          state: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          state_code: tourData.warehouse.state === 'Georgia' ? 'GA' : tourData.warehouse.state,
          zip: tourData.warehouse.zip,
          country: "US",
          country_code: "US",
          email: recipient.email,
          phone: "5555555555"
        },
        
        line_items: lineItems.map((item, index) => ({
          sku: item.sku,
          partner_line_item_id: `${orderNumber}-${index + 1}`,
          quantity: item.quantity,
          price: item.price,
          product_name: item.sku,
          fulfillment_status: "pending",
          quantity_pending_fulfillment: item.quantity,
          warehouse_id: item.warehouse_id
        })),
        
        required_ship_date: this.getRequiredShipDate(tourData.date),
        tags: [`tour-${tourData.tour_numeric_id}`, `workflow-${orderPrefix.toLowerCase()}`, `recipient-${recipient.type}`, tourData.warehouse.code].filter(Boolean)
      }

      console.log(`📦 Creating order ${i + 1}/${orderCount} for ${recipient.type}: ${recipient.first_name} ${recipient.last_name}`)
      console.log(`🏷️ Order Tags:`, orderData.tags)
      console.log(`🏷️ Warehouse code in tags:`, tourData.warehouse.code)
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

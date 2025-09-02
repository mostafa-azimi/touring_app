import { createShipHeroClient } from './client'
import { createClient } from '@/lib/supabase/client'
import { 
  generateSalesOrderName, 
  generatePurchaseOrderName, 
  generateSalesOrderNumber, 
  generatePurchaseOrderNumber 
} from './naming-utils'

export class ShipHeroOrderService {
  private shipHero
  private supabase

  constructor() {
    this.shipHero = createShipHeroClient()
    this.supabase = createClient()
  }

  /**
   * Create sales orders in ShipHero for each participant in a tour
   */
  async createSalesOrdersForTour(tourId: string): Promise<{
    success: boolean
    message: string
    ordersCreated: number
    errors: string[]
  }> {
    try {
      // Get tour details with participants, swag allocations, and host
      const { data: tour, error: tourError } = await this.supabase
        .from('tours')
        .select(`
          id,
          date,
          warehouse:warehouses(
            id,
            name,
            shiphero_warehouse_id,
            address,
            address2,
            city,
            state,
            zip,
            country
          ),
          host:team_members(
            id,
            first_name,
            last_name,
            email
          ),
          participants:tour_participants(
            id,
            first_name,
            last_name,
            email,
            company,
            title
          ),
          swag_allocations:tour_swag_allocations(
            id,
            qty,
            swag_item:swag_items(
              id,
              name,
              sku
            ),
            participant:tour_participants(
              id,
              first_name,
              last_name,
              email,
              company
            )
          )
        `)
        .eq('id', tourId)
        .single()

      if (tourError || !tour) {
        return {
          success: false,
          message: 'Tour not found',
          ordersCreated: 0,
          errors: [tourError?.message || 'Tour not found']
        }
      }

      const warehouse = Array.isArray(tour.warehouse) ? tour.warehouse[0] : tour.warehouse
      if (!warehouse?.shiphero_warehouse_id) {
        return {
          success: false,
          message: 'Warehouse does not have a ShipHero ID configured',
          ordersCreated: 0,
          errors: ['Missing warehouse ShipHero ID']
        }
      }

      const participants = Array.isArray(tour.participants) ? tour.participants : []
      const host = Array.isArray(tour.host) ? tour.host[0] : tour.host

      let ordersCreated = 0
      const errors: string[] = []

      // Get all swag items for the tour (not participant-specific allocations)
      const { data: tourSwagItems, error: swagError } = await this.supabase
        .from('tour_swag_items')
        .select(`
          qty,
          swag_item:swag_items(
            id,
            name,
            sku
          )
        `)
        .eq('tour_id', tourId)

      if (swagError) {
        return {
          success: false,
          message: 'Failed to fetch swag items',
          ordersCreated: 0,
          errors: [swagError.message]
        }
      }

      // Create orders for each participant AND the host with ALL swag items
      const participantOrders = new Map()
      
      // Add all participants
      for (const participant of participants) {
        participantOrders.set(participant.id, {
          participant,
          lineItems: []
        })

        // Add ALL swag items to each participant
        for (const tourSwagItem of tourSwagItems || []) {
          const swagItem = Array.isArray(tourSwagItem.swag_item) ? tourSwagItem.swag_item[0] : tourSwagItem.swag_item
          
          if (!swagItem || !swagItem.sku) continue

          participantOrders.get(participant.id).lineItems.push({
            sku: swagItem.sku,
            quantity: tourSwagItem.qty,
            price: "0.00" // Free swag
          })
        }
      }

      // Add host as a participant if host exists
      if (host) {
        participantOrders.set(`host-${host.id}`, {
          participant: {
            id: `host-${host.id}`,
            first_name: host.first_name,
            last_name: host.last_name,
            email: host.email,
            company: null,
            title: null
          },
          lineItems: []
        })

        // Add ALL swag items to the host
        for (const tourSwagItem of tourSwagItems || []) {
          const swagItem = Array.isArray(tourSwagItem.swag_item) ? tourSwagItem.swag_item[0] : tourSwagItem.swag_item
          
          if (!swagItem || !swagItem.sku) continue

          participantOrders.get(`host-${host.id}`).lineItems.push({
            sku: swagItem.sku,
            quantity: tourSwagItem.qty,
            price: "0.00" // Free swag
          })
        }
      }

      // Create sales order for each participant
      const tourDate = new Date(tour.date)
      
      for (const [participantId, orderData] of participantOrders) {
        try {
          const participant = orderData.participant
          const lineItems = orderData.lineItems

          if (lineItems.length === 0) continue

          // Generate custom order name and number
          const orderName = generateSalesOrderName(
            participant.first_name,
            participant.last_name,
            (warehouse as any).code || "",
            tourDate.toISOString()
          )
          const orderNumber = generateSalesOrderNumber()

          const salesOrderResult = await fetch('/api/shiphero/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('shiphero_access_token')}`
            },
            body: JSON.stringify({
              type: 'sales_order',
              data: {
                order_number: orderNumber,
                shop_name: "Warehouse Tours",
                fulfillment_status: "pending",
                order_date: tourDate.toISOString(),
                total_tax: "0.00",
                subtotal: "0.00",
                total_discounts: "0.00",
                total_price: "0.00",
                email: participant.email,
                phone: "",
                tags: (warehouse as any).code ? [`Airport:${(warehouse as any).code}`] : [],
                shipping_lines: {
                  title: "Generic Shipping",
                  price: "0.00",
                  carrier: "Generic Carrier",
                  method: "Generic Label"
                },
                shipping_address: {
                  first_name: warehouse.name,
                  last_name: "Warehouse",
                  company: warehouse.name,
                  address1: warehouse.address,
                  address2: warehouse.address2 || '',
                  city: warehouse.city,
                  state: warehouse.state,
                  zip: warehouse.zip,
                  country: warehouse.country || 'US',
                  email: participant.email
                },
                billing_address: {
                  first_name: participant.first_name,
                  last_name: participant.last_name,
                  company: participant.company || '',
                  address1: warehouse.address,
                  address2: warehouse.address2 || '',
                  city: warehouse.city,
                  state: warehouse.state,
                  zip: warehouse.zip,
                  country: warehouse.country || 'US',
                  email: participant.email
                },
                line_items: lineItems
              }
            })
          })

          const salesOrderData = await salesOrderResult.json()

          if (salesOrderData.order_create?.order) {
            ordersCreated++
            const order = salesOrderData.order_create.order
            console.log(`Created sales order for ${participant.first_name} ${participant.last_name}: ${order.order_number} (ID: ${order.id})`)
            
            // Store ShipHero order details in database
            const shipheroOrderUrl = `https://app.shiphero.com/orders/${order.id}`
            const { error: updateError } = await this.supabase
              .from('tour_participants')
              .update({
                shiphero_sales_order_id: order.id,
                shiphero_sales_order_number: order.order_number,
                shiphero_sales_order_url: shipheroOrderUrl
              })
              .eq('id', participantId)
            
            if (updateError) {
              console.error('Failed to update participant with ShipHero order ID:', updateError)
              errors.push(`Order created but failed to save tracking info for ${participant.first_name} ${participant.last_name}`)
            } else {
              console.log(`Successfully stored order tracking info for ${participant.first_name} ${participant.last_name}`)
            }
          } else {
            const errorMsg = salesOrderData.errors?.[0]?.message || 'Unknown error'
            errors.push(`Failed to create order for ${participant.first_name} ${participant.last_name}: ${errorMsg}`)
            console.error('Sales order creation failed:', salesOrderData)
          }

        } catch (error) {
          errors.push(`Error creating order for participant ${participantId}: ${error}`)
          console.error('Error creating sales order:', error)
        }
      }

      return {
        success: ordersCreated > 0,
        message: `Created ${ordersCreated} sales orders in ShipHero`,
        ordersCreated,
        errors
      }

    } catch (error) {
      console.error('Error creating sales orders:', error)
      return {
        success: false,
        message: `Failed to create sales orders: ${error}`,
        ordersCreated: 0,
        errors: [String(error)]
      }
    }
  }

  /**
   * Create purchase order in ShipHero for all swag items needed for a tour
   */
  async createPurchaseOrderForTour(tourId: string): Promise<{
    success: boolean
    message: string
    poNumber?: string
    errors: string[]
  }> {
    try {
      // Get tour with swag allocations and host
      const { data: tour, error: tourError } = await this.supabase
        .from('tours')
        .select(`
          id,
          date,
          warehouse:warehouses(
            id,
            name,
            shiphero_warehouse_id
          ),
          host:team_members(
            id,
            first_name,
            last_name,
            email
          ),
          swag_allocations:tour_swag_allocations(
            qty,
            swag_item:swag_items(
              id,
              name,
              sku
            )
          )
        `)
        .eq('id', tourId)
        .single()

      if (tourError || !tour) {
        return {
          success: false,
          message: 'Tour not found',
          errors: [tourError?.message || 'Tour not found']
        }
      }

      const warehouse = Array.isArray(tour.warehouse) ? tour.warehouse[0] : tour.warehouse
      if (!warehouse?.shiphero_warehouse_id) {
        return {
          success: false,
          message: 'Warehouse does not have a ShipHero ID configured',
          errors: ['Missing warehouse ShipHero ID']
        }
      }

      // Get all swag items for the tour
      const { data: tourSwagItems, error: swagError } = await this.supabase
        .from('tour_swag_items')
        .select(`
          qty,
          swag_item:swag_items(
            id,
            name,
            sku
          )
        `)
        .eq('tour_id', tourId)

      if (swagError) {
        return {
          success: false,
          message: 'Failed to fetch swag items',
          errors: [swagError.message]
        }
      }

      // Get participant count to calculate total quantities needed (including host)
      const { data: participants, error: participantsError } = await this.supabase
        .from('tour_participants')
        .select('id')
        .eq('tour_id', tourId)

      if (participantsError) {
        return {
          success: false,
          message: 'Failed to fetch participants',
          errors: [participantsError.message]
        }
      }

      const participantCount = (participants?.length || 0) + 1 // +1 for the host

      // Calculate total quantities needed (qty per item × number of participants)
      const skuTotals = new Map()
      
      for (const tourSwagItem of tourSwagItems || []) {
        const swagItem = Array.isArray(tourSwagItem.swag_item) ? tourSwagItem.swag_item[0] : tourSwagItem.swag_item
        if (!swagItem?.sku) continue

        const sku = swagItem.sku
        const totalQty = tourSwagItem.qty * participantCount
        skuTotals.set(sku, totalQty)
      }

      if (skuTotals.size === 0) {
        return {
          success: false,
          message: 'No swag items found for this tour',
          errors: ['No swag allocations']
        }
      }

      // Create line items for purchase order
      const lineItems = Array.from(skuTotals.entries()).map(([sku, quantity]) => ({
        sku,
        quantity,
        price: "0.00" // Set appropriate cost
      }))

      const tourDate = new Date(tour.date)
      const host = Array.isArray(tour.host) ? tour.host[0] : tour.host
      
      if (!host) {
        return {
          success: false,
          message: 'Tour host not found',
          errors: ['Missing tour host']
        }
      }

      // Generate custom purchase order name and number
      // Use warehouse.name (sanitized) if available, since warehouse.code does not exist on the type
      const warehouseCode = warehouse.name ? warehouse.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
      const poName = generatePurchaseOrderName(host.last_name, warehouseCode, tourDate)
      const poNumber = generatePurchaseOrderNumber()

      const purchaseOrderResult = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('shiphero_access_token')}`
        },
        body: JSON.stringify({
          type: 'purchase_order',
          data: {
            po_number: poNumber,
            po_date: tourDate.toISOString(),
            subtotal: "0.00",
            shipping_price: "0.00",
            total_price: "0.00",
            warehouse_id: warehouse.shiphero_warehouse_id,
            vendor_id: "1076735",
            fulfillment_status: "pending",
            line_items: lineItems
          }
        })
      })

      const purchaseOrderData = await purchaseOrderResult.json()

      if (purchaseOrderData.purchase_order_create?.purchase_order) {
        const purchaseOrder = purchaseOrderData.purchase_order_create.purchase_order
        console.log(`Created purchase order: ${purchaseOrder.po_number} (ID: ${purchaseOrder.id})`)
        
        // Store ShipHero purchase order details in database
        const shipheroPOUrl = `https://app.shiphero.com/purchase-orders/${purchaseOrder.id}`
        const { error: updateError } = await this.supabase
          .from('tours')
          .update({
            shiphero_purchase_order_id: purchaseOrder.id,
            shiphero_purchase_order_number: purchaseOrder.po_number,
            shiphero_purchase_order_url: shipheroPOUrl
          })
          .eq('id', tourId)
        
        if (updateError) {
          console.error('Failed to update tour with ShipHero purchase order ID:', updateError)
          return {
            success: true,
            message: `Created purchase order ${purchaseOrder.po_number} but failed to save tracking info`,
            poNumber: purchaseOrder.po_number,
            errors: ['Order created but failed to save tracking info']
          }
        }
        
        console.log(`Successfully stored purchase order tracking info for tour ${tourId}`)
        return {
          success: true,
          message: `Created purchase order ${purchaseOrder.po_number}`,
          poNumber: purchaseOrder.po_number,
          errors: []
        }
      } else {
        const errorMsg = purchaseOrderData.errors?.[0]?.message || 'Unknown error'
        console.error('Purchase order creation failed:', purchaseOrderData)
        return {
          success: false,
          message: `Failed to create purchase order: ${errorMsg}`,
          errors: [`Purchase order creation failed: ${errorMsg}`]
        }
      }

    } catch (error) {
      console.error('Error creating purchase order:', error)
      return {
        success: false,
        message: `Failed to create purchase order: ${error}`,
        errors: [String(error)]
      }
    }
  }

  /**
   * Create aggregated purchase order for a tour (sum all swag quantities)
   */
  async createPurchaseOrderForTour(tourId: string): Promise<{
    success: boolean
    message: string
    poId?: string
    errors: string[]
  }> {
    try {
      // Get tour details with host, warehouse, and swag allocations
      const { data: tour, error: tourError } = await this.supabase
        .from('tours')
        .select(`
          id,
          date,
          warehouse:warehouses(
            id,
            name,
            code,
            shiphero_warehouse_id,
            address,
            address2,
            city,
            state,
            zip,
            country
          ),
          host:team_members(
            id,
            first_name,
            last_name,
            email
          ),
          swag_allocations:tour_swag_allocations(
            id,
            quantity,
            swag_item:swag_items(
              id,
              name,
              sku
            )
          )
        `)
        .eq('id', tourId)
        .single()

      if (tourError || !tour) {
        return {
          success: false,
          message: 'Tour not found',
          errors: [tourError?.message || 'Tour not found']
        }
      }

      const warehouse = Array.isArray(tour.warehouse) ? tour.warehouse[0] : tour.warehouse
      const host = Array.isArray(tour.host) ? tour.host[0] : tour.host

      if (!warehouse?.shiphero_warehouse_id) {
        return {
          success: false,
          message: 'Warehouse does not have a ShipHero ID configured',
          errors: ['Missing warehouse ShipHero ID']
        }
      }

      if (!host) {
        return {
          success: false,
          message: 'Tour host not found',
          errors: ['Missing tour host']
        }
      }

      // Aggregate swag quantities by item
      const swagAggregation = new Map<string, { item: any, totalQuantity: number }>()
      
      if (Array.isArray(tour.swag_allocations)) {
        tour.swag_allocations.forEach((allocation: any) => {
          const swagItem = allocation.swag_item
          const key = swagItem.id
          
          if (swagAggregation.has(key)) {
            const existing = swagAggregation.get(key)!
            existing.totalQuantity += allocation.quantity
          } else {
            swagAggregation.set(key, {
              item: swagItem,
              totalQuantity: allocation.quantity
            })
          }
        })
      }

      if (swagAggregation.size === 0) {
        return {
          success: false,
          message: 'No swag items found for this tour',
          errors: ['No swag allocations']
        }
      }

      // Create line items for aggregated quantities
      const lineItems = Array.from(swagAggregation.values()).map(({ item, totalQuantity }) => ({
        sku: item.sku || item.name,
        quantity: totalQuantity,
        expected_weight_in_lbs: "1.00",
        vendor_id: "1076735",
        quantity_received: 0,
        quantity_rejected: 0,
        price: "0.00",
        product_name: item.name,
        fulfillment_status: "pending",
        sell_ahead: 0
      }))

      // Generate PO name and number using naming convention
      const tourDate = new Date(tour.date)
      const poName = generatePurchaseOrderName(host.last_name, warehouse.code, tourDate)
      const poNumber = generatePurchaseOrderNumber()

      // Use tomorrow's date for PO
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const poDate = tomorrow.toISOString().split('T')[0]

      const purchaseOrderResult = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('shiphero_access_token')}`
        },
        body: JSON.stringify({
          type: 'purchase_order',
          data: {
            po_date: poDate,
            po_number: poName, // Use the generated name as the PO number
            subtotal: "0.00",
            shipping_price: "0.00",
            total_price: "0.00",
            warehouse_id: warehouse.shiphero_warehouse_id,
            line_items: lineItems,
            fulfillment_status: "pending",
            discount: "0.00",
            vendor_id: "1076735"
          }
        })
      })

      if (!purchaseOrderResult.ok) {
        const errorData = await purchaseOrderResult.json()
        return {
          success: false,
          message: `ShipHero API error: ${purchaseOrderResult.status}`,
          errors: [errorData.error || errorData.details || 'Unknown API error']
        }
      }

      const poData = await purchaseOrderResult.json()
      const poId = poData.data?.purchase_order_create?.purchase_order?.id
      const poLegacyId = poData.data?.purchase_order_create?.purchase_order?.legacy_id
      const shipheroPOUrl = poLegacyId ? `https://app.shiphero.com/dashboard/purchase-orders/details/${poLegacyId}` : null

      // Update tour with PO information
      const { error: updateError } = await this.supabase
        .from('tours')
        .update({
          shiphero_purchase_order_id: poId,
          shiphero_purchase_order_number: poName,
          shiphero_purchase_order_url: shipheroPOUrl
        })
        .eq('id', tourId)

      if (updateError) {
        console.error('Failed to update tour with PO info:', updateError)
      }

      return {
        success: true,
        message: `Purchase order created successfully with ${lineItems.length} unique items (${lineItems.reduce((sum, item) => sum + item.quantity, 0)} total units)`,
        poId,
        errors: []
      }

    } catch (error: any) {
      console.error('Create purchase order error:', error)
      return {
        success: false,
        message: 'Failed to create purchase order',
        errors: [error.message || 'Unknown error']
      }
    }
  }
}

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
          host:hosts(
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
            warehouse.name,
            tourDate
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
                order_name: orderName,
                warehouse_id: warehouse.shiphero_warehouse_id,
                email: participant.email,
                first_name: participant.first_name,
                last_name: participant.last_name,
                company: participant.company,
                address: {
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
            console.log(`Created sales order for ${participant.first_name} ${participant.last_name}: ${salesOrderData.order_create.order.order_number}`)
          } else {
            errors.push(`Failed to create order for ${participant.first_name} ${participant.last_name}`)
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
  async createPurchaseOrderForTour(tourId: string, vendorId?: string): Promise<{
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
          host:hosts(
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
      const poName = generatePurchaseOrderName(host.last_name, tourDate)
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
            po_name: poName,
            warehouse_id: warehouse.shiphero_warehouse_id,
            vendor_id: vendorId,
            line_items: lineItems
          }
        })
      })

      const purchaseOrderData = await purchaseOrderResult.json()

      if (purchaseOrderData.purchase_order_create?.purchase_order) {
        return {
          success: true,
          message: `Created purchase order ${purchaseOrderData.purchase_order_create.purchase_order.po_number}`,
          poNumber: purchaseOrderData.purchase_order_create.purchase_order.po_number,
          errors: []
        }
      } else {
        return {
          success: false,
          message: 'Failed to create purchase order',
          errors: ['Purchase order creation failed']
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
}

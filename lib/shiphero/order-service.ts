import { createShipHeroClient } from './client'
import { createClient } from '@/lib/supabase/client'

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
      // Get tour details with participants and swag allocations
      const { data: tour, error: tourError } = await this.supabase
        .from('tours')
        .select(`
          id,
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
      const swagAllocations = Array.isArray(tour.swag_allocations) ? tour.swag_allocations : []

      let ordersCreated = 0
      const errors: string[] = []

      // Group swag allocations by participant
      const participantOrders = new Map()
      
      for (const allocation of swagAllocations) {
        const participant = Array.isArray(allocation.participant) ? allocation.participant[0] : allocation.participant
        const swagItem = Array.isArray(allocation.swag_item) ? allocation.swag_item[0] : allocation.swag_item
        
        if (!participant || !swagItem || !swagItem.sku) continue

        const participantId = participant.id
        if (!participantOrders.has(participantId)) {
          participantOrders.set(participantId, {
            participant,
            lineItems: []
          })
        }

        participantOrders.get(participantId).lineItems.push({
          sku: swagItem.sku,
          quantity: allocation.qty,
          price: "0.00" // Free swag
        })
      }

      // Create sales order for each participant
      for (const [participantId, orderData] of participantOrders) {
        try {
          const participant = orderData.participant
          const lineItems = orderData.lineItems

          if (lineItems.length === 0) continue

          const salesOrderResult = await this.shipHero.createSalesOrder({
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
          })

          if (salesOrderResult.order_create?.order) {
            ordersCreated++
            console.log(`Created sales order for ${participant.first_name} ${participant.last_name}: ${salesOrderResult.order_create.order.order_number}`)
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
      // Get tour with swag allocations
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

      const swagAllocations = Array.isArray(tour.swag_allocations) ? tour.swag_allocations : []

      // Aggregate quantities by SKU
      const skuTotals = new Map()
      
      for (const allocation of swagAllocations) {
        const swagItem = Array.isArray(allocation.swag_item) ? allocation.swag_item[0] : allocation.swag_item
        if (!swagItem?.sku) continue

        const sku = swagItem.sku
        const currentQty = skuTotals.get(sku) || 0
        skuTotals.set(sku, currentQty + allocation.qty)
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

      const tourDate = new Date(tour.date).toISOString().split('T')[0]
      const poNumber = `TOUR-${tourDate}-${tourId.slice(-6)}`

      const purchaseOrderResult = await this.shipHero.createPurchaseOrder({
        warehouse_id: warehouse.shiphero_warehouse_id,
        vendor_id: vendorId,
        po_number: poNumber,
        line_items: lineItems
      })

      if (purchaseOrderResult.purchase_order_create?.purchase_order) {
        return {
          success: true,
          message: `Created purchase order ${purchaseOrderResult.purchase_order_create.purchase_order.po_number}`,
          poNumber: purchaseOrderResult.purchase_order_create.purchase_order.po_number,
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

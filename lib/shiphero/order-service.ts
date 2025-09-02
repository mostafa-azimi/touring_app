import { createShipHeroClient } from './client'
import { createClient } from '@/lib/supabase/client'
import { 
  generateSalesOrderName, 
  generatePurchaseOrderName, 
  generateSalesOrderNumber, 
  generatePurchaseOrderNumber 
} from './naming-utils'

export class ShipHeroOrderService {
  private shipHero: any
  private supabase

  constructor() {
    // Don't create ShipHero client in constructor - we'll create it when needed with fresh tokens
    this.supabase = createClient()
  }

  /**
   * Get a fresh access token using the stored refresh token
   * This method works the same way as the adhoc order functionality
   */
  private async getAccessToken(): Promise<string> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('ShipHero order service must be used in browser environment. Please configure access tokens in Settings → ShipHero tab.')
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
    const accessToken = tokenData.access_token

    if (!accessToken) {
      throw new Error('No access token received from ShipHero. Please check your refresh token.')
    }

    // Return the access token (we'll use fetch directly like adhoc orders)
    return accessToken
  }

  private getStateCode(state: string): string {
    const stateMap: Record<string, string> = {
      'Georgia': 'GA',
      'California': 'CA',
      'New York': 'NY',
      'Texas': 'TX',
      'Florida': 'FL',
      // Add more as needed
    }
    return stateMap[state] || state
  }

  private getCountryCode(country: string): string {
    const countryMap: Record<string, string> = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      // Add more as needed
    }
    return countryMap[country] || country
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
          tour_numeric_id,
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
          participants:tour_participants(
            id,
            first_name,
            last_name,
            email,
            company,
            title
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

      // Get all available swag items (since we removed tour-specific allocations)
      const { data: allSwagItems, error: swagError } = await this.supabase
        .from('swag_items')
        .select(`
          id,
          name,
          sku
        `)

      if (swagError) {
        return {
          success: false,
          message: 'Failed to fetch swag items',
          ordersCreated: 0,
          errors: [swagError.message]
        }
      }

      if (!allSwagItems || allSwagItems.length === 0) {
        return {
          success: false,
          message: 'No swag items available. Please add swag items in Settings.',
          ordersCreated: 0,
          errors: ['No swag items found']
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

        // Add ALL available swag items to each participant (1 quantity each)
        for (const swagItem of allSwagItems) {
          if (!swagItem || !swagItem.sku) continue

          // Use the same format as adhoc orders for line item IDs
          const lineItemIndex = participantOrders.get(participant.id).lineItems.length + 1
          // Create a consistent date format for all orders
          const tourDate = new Date(tour.date)
          const orderName = generateSalesOrderName(
            participant.first_name,
            participant.last_name,
            warehouse.name || "",
            warehouse.code || "",
            tourDate
          )
          participantOrders.get(participant.id).lineItems.push({
            sku: swagItem.sku,
            partner_line_item_id: `${orderName}-${lineItemIndex}`, // Same format as adhoc orders
            quantity: 1, // 1 of each swag item per participant
            price: "0.00", // Free swag
            warehouse_id: warehouse.shiphero_warehouse_id, // Required field
            product_name: swagItem.name || swagItem.sku,
            fulfillment_status: "Tour_Orders",
            quantity_pending_fulfillment: 1
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

        // Add ALL available swag items to the host (1 quantity each)
        for (const swagItem of allSwagItems) {
          if (!swagItem || !swagItem.sku) continue

          // Use the same format as adhoc orders for line item IDs
          const lineItemIndex = participantOrders.get(`host-${host.id}`).lineItems.length + 1
          // Create a consistent date format for all orders
          const tourDate = new Date(tour.date)
          const orderName = generateSalesOrderName(
            host.first_name,
            host.last_name,
            warehouse.name || "",
            warehouse.code || "",
            tourDate
          )
          participantOrders.get(`host-${host.id}`).lineItems.push({
            sku: swagItem.sku,
            partner_line_item_id: `${orderName}-${lineItemIndex}`, // Same format as adhoc orders
            quantity: 1, // 1 of each swag item for host
            price: "0.00", // Free swag
            warehouse_id: warehouse.shiphero_warehouse_id, // Required field
            product_name: swagItem.name || swagItem.sku,
            fulfillment_status: "Tour_Orders",
            quantity_pending_fulfillment: 1
          })
        }
      }

      // Create sales order for each participant
      
      for (const [participantId, orderData] of participantOrders) {
        try {
          const participant = orderData.participant
          const lineItems = orderData.lineItems

          if (lineItems.length === 0) continue

          // Generate custom order name and number (same as adhoc orders)
          const tourDate = new Date(tour.date)
          
          console.log('🏢 Warehouse data for order creation:', {
            name: warehouse.name,
            code: warehouse.code,
            participantName: `${participant.first_name} ${participant.last_name}`
          })
          
          const orderName = generateSalesOrderName(
            participant.first_name,
            participant.last_name,
            warehouse.name || "",
            warehouse.code || "",
            tourDate
          )
          
          console.log('📦 Generated order name:', orderName)
          console.log('🏷️ Order tags being sent:', [warehouse.code || ""].filter(Boolean))
          console.log('🏢 Warehouse code value:', warehouse.code)

          const accessToken = await this.getAccessToken()
          const salesOrderResult = await fetch('/api/shiphero/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              type: 'sales_order',
              data: {
                order_number: orderName,
                shop_name: "Warehouse Tours",
                fulfillment_status: "Tour_Orders",
                order_date: tourDate.toISOString().split('T')[0], // Use date format like "2025-09-23"
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
                  first_name: warehouse.name,
                  last_name: "Warehouse",
                  company: warehouse.name,
                  address1: warehouse.address,
                  address2: warehouse.address2 || '',
                  city: warehouse.city,
                  state: this.getStateCode(warehouse.state),
                  state_code: this.getStateCode(warehouse.state),
                  zip: warehouse.zip,
                  country: this.getCountryCode(warehouse.country || 'United States'),
                  country_code: this.getCountryCode(warehouse.country || 'United States'),
                  email: participant.email,
                  phone: "5555555555"
                },
                billing_address: {
                  first_name: participant.first_name,
                  last_name: participant.last_name,
                  company: participant.company || '',
                  address1: warehouse.address,
                  address2: warehouse.address2 || '',
                  city: warehouse.city,
                  state: this.getStateCode(warehouse.state),
                  state_code: this.getStateCode(warehouse.state),
                  zip: warehouse.zip,
                  country: this.getCountryCode(warehouse.country || 'United States'),
                  country_code: this.getCountryCode(warehouse.country || 'United States'),
                  email: participant.email,
                  phone: "5555555555"
                },
                line_items: lineItems,
                required_ship_date: tourDate.toISOString().split('T')[0], // Use date format like "2025-09-23"
                tags: ["Tour", "Warehouse Tours", `Tour_${tour.tour_numeric_id}`, warehouse.code || ""].filter(Boolean) // Add tour and airport code as tags
              }
            })
          })

          const salesOrderData = await salesOrderResult.json()

          if (salesOrderData.data?.order_create?.order) {
            ordersCreated++
            const order = salesOrderData.data.order_create.order
            console.log(`Created sales order for ${participant.first_name} ${participant.last_name}: ${order.order_number} (ID: ${order.id})`)
            console.log('🔍 SO Response data:', {
              id: order.id,
              legacy_id: order.legacy_id,
              order_number: order.order_number
            })
            
            // Store ShipHero order details in database
            // Ensure we have a valid legacy_id before creating URL
            if (!order.legacy_id) {
              console.error('❌ Missing legacy_id in order response:', order)
              errors.push(`Sales order created but missing legacy_id for ${participant.first_name} ${participant.last_name}`)
              continue
            }
            
            const shipheroOrderUrl = `https://app.shiphero.com/dashboard/orders/details/${order.legacy_id}`
            console.log('🔗 Generated SO URL:', shipheroOrderUrl)
            
            // Check if this is a host order (participantId starts with "host-")
            if (participantId.startsWith('host-')) {
              // For host orders, update the tours table instead of tour_participants
              const actualHostId = participantId.replace('host-', '')
              const { error: updateError } = await this.supabase
                .from('tours')
                .update({
                  host_shiphero_sales_order_id: order.id,
                  host_shiphero_sales_order_number: order.order_number,
                  host_shiphero_sales_order_url: shipheroOrderUrl
                })
                .eq('id', tourId)
                .eq('host_id', actualHostId)
              
              if (updateError) {
                console.error('Failed to update tour with host ShipHero order ID:', updateError)
                errors.push(`Host order created but failed to save tracking info for ${participant.first_name} ${participant.last_name}`)
              } else {
                console.log(`Successfully stored host order tracking info for ${participant.first_name} ${participant.last_name}`)
              }
            } else {
              // For regular participants, update tour_participants table
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
            }
          } else {
            const errorMsg = salesOrderData.errors?.[0]?.message || 'Unknown error'
            errors.push(`Failed to create order for ${participant.first_name} ${participant.last_name}: ${errorMsg}`)
            console.error('Sales order creation failed - FULL DETAILS:', JSON.stringify(salesOrderData, null, 2))
            // Log any specific error messages
            if (salesOrderData.errors && salesOrderData.errors.length > 0) {
              console.error('ShipHero specific errors:', salesOrderData.errors.map((e: any) => e.message).join(', '))
            }
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
  /**
  /**
   * Create a purchase order in ShipHero for all swag items needed for a tour.
   */
  async createPurchaseOrderForTour(tourId: string): Promise<{
    success: boolean;
    message: string;
    poNumber?: string;
    errors: string[];
  }> {
    try {
      // Get tour with swag allocations and host
      const { data: tour, error: tourError } = await this.supabase
        .from('tours')
        .select(`
          id,
          date,
          tour_numeric_id,
          warehouse:warehouses(
            id,
            name,
            code,
            shiphero_warehouse_id
          ),
          host:team_members(
            id,
            first_name,
            last_name,
            email
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

      // Get all available swag items (since we removed tour-specific allocations)
      const { data: allSwagItems, error: swagError } = await this.supabase
        .from('swag_items')
        .select(`
          id,
          name,
          sku
        `)

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

      if (!allSwagItems || allSwagItems.length === 0) {
        return {
          success: false,
          message: 'No swag items available. Please add swag items in Settings.',
          errors: ['No swag items found']
        }
      }

      // Calculate total quantities needed (1 per item × number of participants)
      const skuTotals = new Map()
      
      for (const swagItem of allSwagItems) {
        const sku = swagItem.sku
        const totalQty = 1 * participantCount // 1 of each item per participant
        skuTotals.set(sku, {
          sku: swagItem.sku,
          name: swagItem.name,
          totalQuantity: totalQty
        })
      }

      if (skuTotals.size === 0) {
        return {
          success: false,
          message: 'No swag items found for this tour',
          errors: ['No swag allocations']
        }
      }

      // Create line items for purchase order (match adhoc PO format exactly)
      const lineItems = Array.from(skuTotals.entries()).map(([sku, itemData]) => ({
        sku: itemData.sku,
        quantity: itemData.totalQuantity,
        expected_weight_in_lbs: "1.00",
        vendor_id: "1076735",
        quantity_received: 0,
        quantity_rejected: 0,
        price: "0.00",
        product_name: itemData.name,
        fulfillment_status: "ShipHero Tours",
        sell_ahead: 0
      }))

      const tourDate = new Date(tour.date)
      // Set purchase order date to day before tour date
      const purchaseOrderDate = new Date(tourDate)
      purchaseOrderDate.setDate(purchaseOrderDate.getDate() - 1)
      
      const host = Array.isArray(tour.host) ? tour.host[0] : tour.host
      
      if (!host) {
        return {
          success: false,
          message: 'Tour host not found',
          errors: ['Missing tour host']
        }
      }

      // Generate custom purchase order name using the same format as our naming convention
      // Use the actual airport/warehouse code, not just sanitized name
      const warehouseCode = warehouse.code || warehouse.name?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3) || '';
      const poName = generatePurchaseOrderName(host.last_name, warehouseCode, purchaseOrderDate)

      const accessToken = await this.getAccessToken()
      const purchaseOrderResult = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          type: 'purchase_order',
          data: {
            po_date: purchaseOrderDate.toISOString().split('T')[0], // Use day before tour date
            po_number: poName, // Use our custom naming convention instead of generic number
            subtotal: "0.00",
            tax: "0.00",
            shipping_price: "0.00",
            total_price: "0.00",
            warehouse_id: warehouse.shiphero_warehouse_id,
            line_items: lineItems,
            fulfillment_status: "ShipHero Tours",
            discount: "0.00",
            vendor_id: "1076735"
          }
        })
      })

      const purchaseOrderData = await purchaseOrderResult.json()

      if (purchaseOrderData.data?.purchase_order_create?.purchase_order) {
        const purchaseOrder = purchaseOrderData.data.purchase_order_create.purchase_order
        console.log(`Created purchase order: ${purchaseOrder.po_number} (ID: ${purchaseOrder.id})`)
        console.log('🔍 PO Response data:', {
          id: purchaseOrder.id,
          legacy_id: purchaseOrder.legacy_id,
          po_number: purchaseOrder.po_number
        })
        
        // Store ShipHero purchase order details in database
        const shipheroPOUrl = `https://app.shiphero.com/dashboard/purchase-orders/details/${purchaseOrder.legacy_id}`
        console.log('🔗 Generated PO URL:', shipheroPOUrl)
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



}

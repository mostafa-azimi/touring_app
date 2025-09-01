import { GraphQLClient } from 'graphql-request'

interface ShipHeroConfig {
  accessToken: string
  refreshToken: string
  endpoint?: string
}

export class ShipHeroClient {
  private client: GraphQLClient
  private accessToken: string
  private refreshToken: string

  constructor(config: ShipHeroConfig) {
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    
    const endpoint = config.endpoint || 'https://public-api.shiphero.com/graphql'
    
    this.client = new GraphQLClient(endpoint, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  }

  async request<T = any>(query: string, variables?: any): Promise<T> {
    try {
      return await this.client.request<T>(query, variables)
    } catch (error: any) {
      // If token expired, try to refresh
      if (error.response?.status === 401) {
        await this.refreshAccessToken()
        // Retry the request with new token
        return await this.client.request<T>(query, variables)
      }
      throw error
    }
  }

  private async refreshAccessToken(): Promise<void> {
    // Implement token refresh logic
    // This would need to call ShipHero's token refresh endpoint
    console.log('Refreshing ShipHero access token...')
    // Update this.accessToken and this.client headers
  }

  // Sales Order operations
  async createSalesOrder(orderData: {
    warehouse_id: string
    email: string
    first_name: string
    last_name: string
    company?: string
    address: {
      first_name: string
      last_name: string
      company?: string
      address1: string
      address2?: string
      city: string
      state: string
      zip: string
      country: string
      email: string
    }
    line_items: Array<{
      sku: string
      quantity: number
      price?: string
    }>
  }) {
    const mutation = `
      mutation CreateOrder($data: OrderCreateInput!) {
        order_create(data: $data) {
          request_id
          complexity
          order {
            id
            order_number
            shop_name
            email
            total_price
          }
        }
      }
    `
    
    const data = {
      warehouse_id: orderData.warehouse_id,
      email: orderData.email,
      order_date: new Date().toISOString(),
      total_tax: "0.00",
      subtotal: "0.00",
      total_discounts: "0.00",
      total_price: "0.00",
      shipping_address: orderData.address,
      billing_address: orderData.address,
      line_items: orderData.line_items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price || "0.00",
        product_name: item.sku // Using SKU as product name for now
      }))
    }
    
    return this.request(mutation, { data })
  }

  // Warehouse operations (for connection testing)
  async getWarehouses() {
    const query = `
      query {
        warehouses {
          data {
            id
            identifier
            name
            profile {
              name
              address {
                name
                address1
                address2
                city
                state
                zip
                country
              }
            }
          }
        }
      }
    `
    return this.request(query)
  }

  // Purchase Order operations
  async createPurchaseOrder(orderData: {
    warehouse_id: string
    vendor_id?: string
    po_number?: string
    line_items: Array<{
      sku: string
      quantity: number
      price?: string
    }>
  }) {
    const mutation = `
      mutation CreatePurchaseOrder($data: PurchaseOrderCreateInput!) {
        purchase_order_create(data: $data) {
          request_id
          complexity
          purchase_order {
            id
            po_number
            warehouse_id
            subtotal
            total_price
          }
        }
      }
    `
    
    const data = {
      warehouse_id: orderData.warehouse_id,
      vendor_id: orderData.vendor_id || "default-vendor",
      po_number: orderData.po_number || `PO-${Date.now()}`,
      po_date: new Date().toISOString(),
      line_items: orderData.line_items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        expected_cost: item.price || "0.00"
      }))
    }
    
    return this.request(mutation, { data })
  }
}

// Factory function to create ShipHero client
export function createShipHeroClient(): ShipHeroClient {
  // Try environment variables first, then localStorage
  const accessToken = process.env.SHIPHERO_ACCESS_TOKEN || 
    (typeof window !== 'undefined' ? localStorage.getItem('shiphero_access_token') : null)
  const refreshToken = process.env.SHIPHERO_REFRESH_TOKEN || 
    (typeof window !== 'undefined' ? localStorage.getItem('shiphero_refresh_token') : null)
  
  if (!accessToken || !refreshToken) {
    throw new Error('ShipHero access token and refresh token are required. Please configure them in Settings → ShipHero tab.')
  }
  
  return new ShipHeroClient({
    accessToken,
    refreshToken
  })
}

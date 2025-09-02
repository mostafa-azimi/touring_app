# ShipHero API - Warehouses Query Sample

## API Endpoints

ShipHero's public API has two main endpoints:

1. **Authentication Endpoint**: `https://public-api.shiphero.com/auth`
2. **GraphQL Endpoint**: `https://public-api.shiphero.com/graphql`

## Authentication with Refresh Token

Since you have a refresh token, you can get a new access token using this curl command:

```bash
curl -X POST -H "Content-Type: application/json" -d \
'{ "refresh_token": "yhFvnmq8bQGwlbn48SwNqnzFIpOlSizyb1aubxZtB5d42-" }' \
"https://public-api.shiphero.com/auth/refresh"
```

This will return a response like:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs...",
  "expires_in": 2419200,
  "scope": "openid profile offline_access",
  "token_type": "Bearer"
}
```

## Sample Query for Warehouses

Once you have the access token, you can query for warehouses using this GraphQL query:

### GraphQL Query

```graphql
query {
  account {
    request_id
    complexity
    data {
      warehouses {
        id
        legacy_id
        identifier
        account_id
        address {
          name
          address1
          address2
          city
          state
          country
          zip
          phone
        }
        dynamic_slotting
        invoice_email
        phone_number
        profile
      }
    }
  }
}
```

### Complete curl Example

```bash
# First, get your access token using your refresh token
ACCESS_TOKEN=$(curl -s -X POST -H "Content-Type: application/json" -d \
'{ "refresh_token": "yhFvnmq8bQGwlbn48SwNqnzFIpOlSizyb1aubxZtB5d42-" }' \
"https://public-api.shiphero.com/auth/refresh" | jq -r '.access_token')

# Then use the access token to query warehouses
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "query { account { request_id complexity data { warehouses { id legacy_id identifier account_id address { name address1 address2 city state country zip phone } dynamic_slotting invoice_email phone_number profile } } } }"
  }' \
  "https://public-api.shiphero.com/graphql"
```

### Python Example

```python
import requests
import json

# Step 1: Get access token using refresh token
refresh_url = "https://public-api.shiphero.com/auth/refresh"
refresh_payload = {
    "refresh_token": "yhFvnmq8bQGwlbn48SwNqnzFIpOlSizyb1aubxZtB5d42-"
}

refresh_response = requests.post(refresh_url, json=refresh_payload)
access_token = refresh_response.json()["access_token"]

# Step 2: Query warehouses
graphql_url = "https://public-api.shiphero.com/graphql"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

query = """
query {
  account {
    request_id
    complexity
    data {
      warehouses {
        id
        legacy_id
        identifier
        account_id
        address {
          name
          address1
          address2
          city
          state
          country
          zip
          phone
        }
        dynamic_slotting
        invoice_email
        phone_number
        profile
      }
    }
  }
}
"""

payload = {"query": query}
response = requests.post(graphql_url, json=payload, headers=headers)
warehouses_data = response.json()

print(json.dumps(warehouses_data, indent=2))
```

## Key Fields Explained

- **`id`**: The unique identifier for the warehouse (primary key)
- **`legacy_id`**: The older identifier for the warehouse (if migrated from older system)
- **`identifier`**: A user-defined identifier for the warehouse
- **`account_id`**: The account this warehouse belongs to
- **`address`**: Complete address information for the warehouse
- **`dynamic_slotting`**: Whether dynamic slotting is enabled
- **`profile`**: Warehouse profile information

## Order Creation Mutation

### Create Order with Specific SKUs

To create an order with specific SKUs, use the `order_create` mutation:

```graphql
mutation {
  order_create(
    data: {
      order_number: "11223344"
      shop_name: "ExampleShop"
      fulfillment_status: "pending"
      order_date: "2019-07-29"
      total_tax: "29.00"
      subtotal: "150.00"
      total_discounts: "20.00"
      total_price: "159.00"
      shipping_lines: {
        title: "UPS"
        price: "0.00"
        carrier: "UPS"
        method: "Ground"
      }
      shipping_address: {
        first_name: "John"
        last_name: "Johnson"
        company: "The Johnson Co"
        address1: "2543 Duck St."
        address2: "Apt. 2"
        city: "Oklahoma"
        state: "Oklahoma"
        state_code: "OK"
        zip: "73008"
        country: "US"
        country_code: "US"
        email: "johnjohnsonco@johnsonco.com"
        phone: "5555555555"
      }
      billing_address: {
        first_name: "John"
        last_name: "Johnson"
        company: "The Johnson Co"
        address1: "2543 Duck St."
        address2: "Apt. 2"
        city: "Oklahoma"
        state: "OK"
        state_code: "OK"
        zip: "73008"
        country: "US"
        country_code: "US"
        email: "johnjohnsonco@johnsonco.com"
        phone: "5555555555"
      }
      line_items: {
        sku: "testSKU12345"
        partner_line_item_id: "282960815"
        quantity: 2
        price: "150.00"
        product_name: "Example Product"
        fulfillment_status: "pending"
        quantity_pending_fulfillment: 2
        warehouse_id: "V2FyZWhvdYNlOjgwNzU="
      }
      required_ship_date: "2019-08-29"
    }
  ) {
    request_id
    complexity
    order {
      id
      order_number
      shop_name
      fulfillment_status
      order_date
      total_tax
      subtotal
      total_discounts
      total_price
      line_items(first: 10) {
        edges {
          node {
            id
            sku
            product_id
            quantity
            product_name
            fulfillment_status
            quantity_pending_fulfillment
            quantity_allocated
            backorder_quantity
            warehouse_id
          }
        }
      }
    }
  }
}
```

### JavaScript/TypeScript Example for Order Creation

```typescript
// For Next.js API routes or server-side functions
export async function createShipHeroOrder(orderData: any) {
  // Get access token (as shown above)
  const accessToken = await getAccessToken();

  const orderMutation = `
    mutation {
      order_create(
        data: {
          order_number: "${orderData.orderNumber}"
          shop_name: "MyApp"
          fulfillment_status: "pending"
          order_date: "${new Date().toISOString().split('T')[0]}"
          total_tax: "${orderData.totalTax}"
          subtotal: "${orderData.subtotal}"
          total_discounts: "0.00"
          total_price: "${orderData.totalPrice}"
          shipping_lines: {
            title: "Standard Shipping"
            price: "${orderData.shippingPrice}"
            carrier: "UPS"
            method: "Ground"
          }
          shipping_address: {
            first_name: "${orderData.shippingAddress.firstName}"
            last_name: "${orderData.shippingAddress.lastName}"
            address1: "${orderData.shippingAddress.address1}"
            city: "${orderData.shippingAddress.city}"
            state: "${orderData.shippingAddress.state}"
            state_code: "${orderData.shippingAddress.stateCode}"
            zip: "${orderData.shippingAddress.zip}"
            country: "US"
            country_code: "US"
            email: "${orderData.shippingAddress.email}"
            phone: "${orderData.shippingAddress.phone}"
          }
          line_items: [
            ${orderData.lineItems.map((item: any) => `{
              sku: "${item.sku}"
              partner_line_item_id: "${item.partnerLineItemId}"
              quantity: ${item.quantity}
              price: "${item.price}"
              product_name: "${item.productName}"
              fulfillment_status: "pending"
              quantity_pending_fulfillment: ${item.quantity}
              warehouse_id: "${item.warehouseId}"
            }`).join(',')}
          ]
          required_ship_date: "${orderData.requiredShipDate}"
        }
      ) {
        request_id
        complexity
        order {
          id
          order_number
          fulfillment_status
          line_items(first: 10) {
            edges {
              node {
                sku
                quantity
                fulfillment_status
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://public-api.shiphero.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: orderMutation }),
  });

  const result = await response.json();
  return result;
}

// For client-side usage (React components)
export async function createOrder(orderData: any) {
  const response = await fetch('/api/shiphero/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error('Failed to create order');
  }

  return response.json();
}
```

## Purchase Order Creation Mutation

### Create Purchase Order

To create a purchase order, use the `purchase_order_create` mutation:

```graphql
mutation {
  purchase_order_create(
    data: {
      po_date: "2025-09-01"
      po_number: "PO-001"
      subtotal: "230.00"
      shipping_price: "0.00"
      total_price: "230.00"
      warehouse_id: "V2FyZWhvdXNlOjgwNzU="
      line_items: [
        {
          sku: "testSKU12345"
          quantity: 5
          expected_weight_in_lbs: "1.00"
          vendor_id: "VmVuZG9yOjE1NjE2Mw=="
          quantity_received: 0
          quantity_rejected: 0
          price: "230.00"
          product_name: "Product for testing Purchase Orders"
          fulfillment_status: "pending"
          sell_ahead: 0
        }
      ]
      fulfillment_status: "pending"
      discount: "0.00"
      vendor_id: "VmVuZG9yOjE1NjE2Mw=="
    }
  ) {
    request_id
    complexity
    purchase_order {
      id
      po_number
      po_date
      fulfillment_status
      subtotal
      total_price
      line_items {
        sku
        quantity
        quantity_received
        price
        product_name
      }
    }
  }
}
```

### JavaScript/TypeScript Example for Purchase Order Creation

```typescript
// For Next.js API routes or server-side functions
export async function createShipHeroPurchaseOrder(poData: any) {
  // Get access token (as shown above)
  const accessToken = await getAccessToken();

  const poMutation = `
    mutation {
      purchase_order_create(
        data: {
          po_date: "${poData.poDate}"
          po_number: "${poData.poNumber}"
          subtotal: "${poData.subtotal}"
          shipping_price: "${poData.shippingPrice}"
          total_price: "${poData.totalPrice}"
          warehouse_id: "${poData.warehouseId}"
          line_items: [
            ${poData.lineItems.map((item: any) => `{
              sku: "${item.sku}"
              quantity: ${item.quantity}
              expected_weight_in_lbs: "${item.expectedWeight}"
              vendor_id: "${item.vendorId}"
              quantity_received: 0
              quantity_rejected: 0
              price: "${item.price}"
              product_name: "${item.productName}"
              fulfillment_status: "pending"
              sell_ahead: 0
            }`).join(',')}
          ]
          fulfillment_status: "pending"
          discount: "${poData.discount || '0.00'}"
          vendor_id: "${poData.vendorId}"
        }
      ) {
        request_id
        complexity
        purchase_order {
          id
          po_number
          fulfillment_status
          total_price
        }
      }
    }
  `;

  const response = await fetch('https://public-api.shiphero.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: poMutation }),
  });

  const result = await response.json();
  return result;
}

// For client-side usage (React components)
export async function createPurchaseOrder(poData: any) {
  const response = await fetch('/api/shiphero/create-purchase-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(poData),
  });

  if (!response.ok) {
    throw new Error('Failed to create purchase order');
  }

  return response.json();
}
```

## Purchase Order Management

### Update Purchase Order (Receive Items)

```graphql
mutation {
  purchase_order_update(
    data: {
      po_id: "503386"
      line_items: { sku: "1122334457", quantity_received: 1 }
    }
  ) {
    request_id
    complexity
  }
}
```

### Close Purchase Order

```graphql
mutation {
  purchase_order_close(data: {
    po_id: "503387"
  }) {
    request_id
    complexity
  }
}
```

### Add Inventory from Purchase Order

```graphql
mutation {
  inventory_add(data: {
    sku: "12258196226120",
    warehouse_id: "V2FyZWhvdXNlOjgwNzU=",
    quantity: 1000
    reason: "Added from PO Nr.123"
  }) {
    request_id
    complexity
    warehouse_product {
      id
      account_id
      on_hand
      inventory_bin
    }
  }
}
```

## Complete JavaScript/TypeScript Integration Class

```typescript
// lib/shiphero.ts - Main ShipHero API client
export class ShipHeroAPI {
  private refreshToken: string;
  private accessToken: string | null = null;
  private baseUrl = 'https://public-api.shiphero.com';

  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
  }

  async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private async makeRequest(query: string): Promise<any> {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getWarehouses(): Promise<any> {
    const query = `
      query {
        account {
          data {
            warehouses {
              id
              legacy_id
              identifier
              address {
                name
                city
                state
                country
              }
            }
          }
        }
      }
    `;
    return this.makeRequest(query);
  }

  async createOrder(orderData: OrderData): Promise<any> {
    const mutation = `
      mutation {
        order_create(
          data: {
            order_number: "${orderData.orderNumber}"
            shop_name: "${orderData.shopName}"
            fulfillment_status: "pending"
            order_date: "${orderData.orderDate}"
            total_tax: "${orderData.totalTax}"
            subtotal: "${orderData.subtotal}"
            total_discounts: "${orderData.totalDiscounts}"
            total_price: "${orderData.totalPrice}"
            shipping_lines: {
              title: "${orderData.shippingLines.title}"
              price: "${orderData.shippingLines.price}"
              carrier: "${orderData.shippingLines.carrier}"
              method: "${orderData.shippingLines.method}"
            }
            shipping_address: {
              first_name: "${orderData.shippingAddress.firstName}"
              last_name: "${orderData.shippingAddress.lastName}"
              address1: "${orderData.shippingAddress.address1}"
              city: "${orderData.shippingAddress.city}"
              state: "${orderData.shippingAddress.state}"
              state_code: "${orderData.shippingAddress.stateCode}"
              zip: "${orderData.shippingAddress.zip}"
              country: "${orderData.shippingAddress.country}"
              country_code: "${orderData.shippingAddress.countryCode}"
              email: "${orderData.shippingAddress.email}"
              phone: "${orderData.shippingAddress.phone}"
            }
            line_items: [
              ${orderData.lineItems.map(item => `{
                sku: "${item.sku}"
                partner_line_item_id: "${item.partnerLineItemId}"
                quantity: ${item.quantity}
                price: "${item.price}"
                product_name: "${item.productName}"
                fulfillment_status: "pending"
                quantity_pending_fulfillment: ${item.quantity}
                warehouse_id: "${item.warehouseId}"
              }`).join(',')}
            ]
            required_ship_date: "${orderData.requiredShipDate}"
          }
        ) {
          request_id
          complexity
          order {
            id
            order_number
            fulfillment_status
            line_items(first: 10) {
              edges {
                node {
                  sku
                  quantity
                  fulfillment_status
                }
              }
            }
          }
        }
      }
    `;
    return this.makeRequest(mutation);
  }

  async createPurchaseOrder(poData: PurchaseOrderData): Promise<any> {
    const mutation = `
      mutation {
        purchase_order_create(
          data: {
            po_date: "${poData.poDate}"
            po_number: "${poData.poNumber}"
            subtotal: "${poData.subtotal}"
            shipping_price: "${poData.shippingPrice}"
            total_price: "${poData.totalPrice}"
            warehouse_id: "${poData.warehouseId}"
            line_items: [
              ${poData.lineItems.map(item => `{
                sku: "${item.sku}"
                quantity: ${item.quantity}
                expected_weight_in_lbs: "${item.expectedWeight}"
                vendor_id: "${item.vendorId}"
                quantity_received: 0
                quantity_rejected: 0
                price: "${item.price}"
                product_name: "${item.productName}"
                fulfillment_status: "pending"
                sell_ahead: 0
              }`).join(',')}
            ]
            fulfillment_status: "pending"
            discount: "${poData.discount || '0.00'}"
            vendor_id: "${poData.vendorId}"
          }
        ) {
          request_id
          complexity
          purchase_order {
            id
            po_number
            fulfillment_status
            total_price
          }
        }
      }
    `;
    return this.makeRequest(mutation);
  }
}

// TypeScript interfaces for type safety
export interface OrderData {
  orderNumber: string;
  shopName: string;
  orderDate: string;
  totalTax: string;
  subtotal: string;
  totalDiscounts: string;
  totalPrice: string;
  shippingLines: {
    title: string;
    price: string;
    carrier: string;
    method: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    stateCode: string;
    zip: string;
    country: string;
    countryCode: string;
    email: string;
    phone: string;
  };
  lineItems: Array<{
    sku: string;
    partnerLineItemId: string;
    quantity: number;
    price: string;
    productName: string;
    warehouseId: string;
  }>;
  requiredShipDate: string;
}

export interface PurchaseOrderData {
  poDate: string;
  poNumber: string;
  subtotal: string;
  shippingPrice: string;
  totalPrice: string;
  warehouseId: string;
  vendorId: string;
  discount?: string;
  lineItems: Array<{
    sku: string;
    quantity: number;
    expectedWeight: string;
    vendorId: string;
    price: string;
    productName: string;
  }>;
}
```

## Next.js API Routes Examples

```typescript
// pages/api/shiphero/warehouses.ts or app/api/shiphero/warehouses/route.ts
import { ShipHeroAPI } from '@/lib/shiphero';

export async function GET() {
  try {
    const api = new ShipHeroAPI(process.env.SHIPHERO_REFRESH_TOKEN!);
    const warehouses = await api.getWarehouses();
    
    return Response.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return Response.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}

// pages/api/shiphero/create-order.ts or app/api/shiphero/create-order/route.ts
import { ShipHeroAPI, OrderData } from '@/lib/shiphero';

export async function POST(request: Request) {
  try {
    const orderData: OrderData = await request.json();
    const api = new ShipHeroAPI(process.env.SHIPHERO_REFRESH_TOKEN!);
    const result = await api.createOrder(orderData);
    
    return Response.json(result);
  } catch (error) {
    console.error('Error creating order:', error);
    return Response.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

// pages/api/shiphero/create-purchase-order.ts or app/api/shiphero/create-purchase-order/route.ts
import { ShipHeroAPI, PurchaseOrderData } from '@/lib/shiphero';

export async function POST(request: Request) {
  try {
    const poData: PurchaseOrderData = await request.json();
    const api = new ShipHeroAPI(process.env.SHIPHERO_REFRESH_TOKEN!);
    const result = await api.createPurchaseOrder(poData);
    
    return Response.json(result);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return Response.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}
```

## React Component Examples

```tsx
// components/OrderForm.tsx
'use client';

import { useState } from 'react';
import { OrderData } from '@/lib/shiphero';

export default function OrderForm() {
  const [orderData, setOrderData] = useState<Partial<OrderData>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/shiphero/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const result = await response.json();
      console.log('Order created:', result);
      // Handle success (show toast, redirect, etc.)
    } catch (error) {
      console.error('Error:', error);
      // Handle error (show error message)
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields for order data */}
      <input
        type="text"
        placeholder="Order Number"
        value={orderData.orderNumber || ''}
        onChange={(e) => setOrderData({ ...orderData, orderNumber: e.target.value })}
        className="w-full p-2 border rounded"
      />
      
      {/* Add more form fields as needed */}
      
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-500 text-white p-2 rounded disabled:opacity-50"
      >
        {loading ? 'Creating Order...' : 'Create Order'}
      </button>
    </form>
  );
}
```

## Environment Variables (.env.local)

```bash
# ShipHero API Configuration
SHIPHERO_REFRESH_TOKEN=yhFvnmq8bQGwlbn48SwNqnzFIpOlSizyb1aubxZtB5d42-

# Supabase Configuration (if storing ShipHero data)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Supabase Integration

```sql
-- Create tables to store ShipHero data
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER,
  identifier TEXT,
  name TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE,
  shop_name TEXT,
  fulfillment_status TEXT,
  total_price DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  shiphero_data JSONB
);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE,
  fulfillment_status TEXT,
  total_price DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  shiphero_data JSONB
);
```

```typescript
// lib/supabase.ts - Store ShipHero data in Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function storeOrderInSupabase(orderResult: any) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      id: orderResult.data.order_create.order.id,
      order_number: orderResult.data.order_create.order.order_number,
      shop_name: orderResult.data.order_create.order.shop_name,
      fulfillment_status: orderResult.data.order_create.order.fulfillment_status,
      total_price: orderResult.data.order_create.order.total_price,
      shiphero_data: orderResult
    });

  if (error) {
    console.error('Error storing order in Supabase:', error);
    throw error;
  }

  return data;
}
```

## Tech Stack Specific Considerations

### v0.app Integration
- Use the provided TypeScript interfaces for type safety
- Copy the React component examples as starting points
- Leverage v0's component generation with these ShipHero patterns

### Vercel Deployment
- Store your refresh token in Vercel environment variables
- Use Vercel's Edge Runtime for faster API responses
- Consider using Vercel's caching for warehouse data

### Supabase Integration
- Store ShipHero order/PO data for your app's needs
- Use Supabase real-time subscriptions for order status updates
- Implement Row Level Security (RLS) for multi-tenant scenarios

### GitHub/Cursor Workflow
- Store the ShipHero API client in `lib/shiphero.ts`
- Create separate API routes for each ShipHero operation
- Use TypeScript interfaces for better development experience
- Implement proper error handling and logging

# Usage Example

```typescript
// Example usage in your app
const api = new ShipHeroAPI(process.env.SHIPHERO_REFRESH_TOKEN!);

// Get warehouses
const warehouses = await api.getWarehouses();

// Create an order
const orderData: OrderData = {
  orderNumber: "APP-001",
  shopName: "MyApp",
  orderDate: "2025-09-01",
  // ... other required fields
};
const orderResult = await api.createOrder(orderData);

// Store in Supabase
await storeOrderInSupabase(orderResult);
```

## Important Notes for Your Tech Stack

### Authentication & Security
- Store your refresh token in Vercel environment variables (never in client-side code)
- Access tokens expire every 28 days - the API client handles automatic refresh
- Always use server-side API routes for ShipHero API calls to protect your credentials
- Include proper error handling for authentication failures

### Development Workflow
- Use the TypeScript interfaces for type safety in Cursor
- Store the ShipHero API client in `lib/shiphero.ts`
- Create separate API routes for each ShipHero operation
- Implement proper error handling and logging for production

### v0.app Integration
- Copy the React component examples as starting points for v0
- Use the provided TypeScript interfaces for form validation
- Leverage v0's component generation with these ShipHero patterns

### Vercel Deployment
- Store environment variables in Vercel dashboard
- Use Vercel's Edge Runtime for faster API responses if needed
- Consider implementing caching for warehouse data to reduce API calls

### Supabase Integration
- Store ShipHero order/PO data in Supabase for your app's needs
- Use Supabase real-time subscriptions for order status updates
- Implement Row Level Security (RLS) for multi-tenant scenarios
- Store webhook data for order status changes

### Performance Considerations
- Cache warehouse data since it doesn't change frequently
- Implement request queuing for bulk operations
- Use Vercel's caching headers for static ShipHero data
- Consider implementing retry logic for failed API calls

### Error Handling
- Always wrap ShipHero API calls in try-catch blocks
- Implement proper error responses in your API routes
- Log errors for debugging and monitoring
- Provide user-friendly error messages in your UI

### GraphQL Best Practices
- Only request the fields you need to minimize response size
- Use the `partner_line_item_id` field to track your internal order items
- For 3PL accounts, add `customer_account_id` to mutations
- Orders from natively connected stores should not be created via API to avoid conflicts
- Purchase order `quantity_received` is accumulative - each update adds to existing quantity


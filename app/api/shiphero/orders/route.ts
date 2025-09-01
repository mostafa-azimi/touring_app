import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    let query: string
    let variables: any

    if (type === 'sales_order') {
      query = `
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
      variables = { data }
    } else if (type === 'purchase_order') {
      query = `
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
      variables = { data }
    } else {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 })
    }

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('ShipHero orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

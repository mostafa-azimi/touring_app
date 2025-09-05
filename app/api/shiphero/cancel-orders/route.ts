import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const body = await request.json()
    const { orders, type } = body // orders: array of {id, legacy_id}, type: 'sales' or 'purchase'

    console.log(`🚫 Canceling ${type} orders:`, orders.map((o: any) => o.legacy_id || o.id))

    const results = []
    const errors = []

    for (const order of orders) {
      try {
        let query: string
        
        if (type === 'sales') {
          // Update sales order fulfillment status to 'Canceled'
          query = `
            mutation {
              order_update(
                data: {
                  order_id: "${order.id}"
                  fulfillment_status: "Canceled"
                }
              ) {
                request_id
                complexity
                order {
                  id
                  legacy_id
                  order_number
                  fulfillment_status
                }
              }
            }
          `
        } else {
          // Update purchase order fulfillment status to 'Canceled'
          query = `
            mutation {
              purchase_order_update(
                data: {
                  purchase_order_id: "${order.id}"
                  fulfillment_status: "Canceled"
                }
              ) {
                request_id
                complexity
                purchase_order {
                  id
                  legacy_id
                  po_number
                  fulfillment_status
                }
              }
            }
          `
        }

        console.log(`🔄 Canceling ${type} order ${order.legacy_id || order.id}...`)

        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ query })
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        
        if (result.errors && result.errors.length > 0) {
          console.error(`❌ GraphQL errors for ${type} order ${order.legacy_id}:`, result.errors)
          errors.push({
            order: order.legacy_id || order.id,
            error: result.errors[0].message
          })
        } else {
          console.log(`✅ Successfully canceled ${type} order ${order.legacy_id || order.id}`)
          results.push({
            order: order.legacy_id || order.id,
            success: true,
            data: result.data
          })
        }

      } catch (error: any) {
        console.error(`❌ Error canceling ${type} order ${order.legacy_id || order.id}:`, error.message)
        errors.push({
          order: order.legacy_id || order.id,
          error: error.message
        })
      }
    }

    const response = {
      success: errors.length === 0,
      canceled_count: results.length,
      total_count: orders.length,
      results,
      errors
    }

    console.log(`🏁 Cancellation complete: ${results.length}/${orders.length} ${type} orders canceled`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Cancel orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

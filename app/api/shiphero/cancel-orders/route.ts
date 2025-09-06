import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const body = await request.json()
    const { orders, type, new_status, use_cancel_mutation } = body // orders: array of {id, legacy_id}, type: 'sales' or 'purchase', new_status: optional, use_cancel_mutation: boolean

    const targetStatus = new_status || (type === 'sales' ? 'on_hold' : 'Canceled')
    
    if (use_cancel_mutation && type === 'sales') {
      console.log(`🚫 Canceling ${type} orders using order_cancel mutation:`, orders.map((o: any) => o.legacy_id || o.id))
    } else if (use_cancel_mutation && type === 'purchase') {
      console.log(`🚫 Canceling ${type} orders using purchase_order_cancel mutation:`, orders.map((o: any) => o.legacy_id || o.id))
    } else {
      console.log(`🚫 Setting ${type} orders to ${targetStatus}:`, orders.map((o: any) => o.legacy_id || o.id))
    }

    const results = []
    const errors = []

    for (const order of orders) {
        try {
          let query: string
          
          if (use_cancel_mutation && type === 'sales') {
            // Use order_cancel mutation for sales orders
            query = `
              mutation {
                order_cancel(
                  data: {
                    order_id: "${order.id}"
                    reason: "Tour canceled"
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
          } else if (use_cancel_mutation && type === 'purchase') {
            // For purchase orders: First check status, then cancel if possible
            console.log(`🔍 DEBUG: Purchase order data for cancellation:`, {
              id: order.id,
              legacy_id: order.legacy_id,
              po_number: order.po_number || 'N/A'
            })
            
            const poId = String(order.legacy_id)
            
            // Step 1: Query current PO status first
            const statusQuery = `
              query {
                purchase_order(id: "${order.id}") {
                  id
                  legacy_id
                  po_number
                  fulfillment_status
                  subtotal
                  created_date
                }
              }
            `
            
            console.log(`🔍 DEBUG: Checking PO status first:`, statusQuery)
            
            // Execute status check
            const statusResponse = await fetch('https://public-api.shiphero.com/graphql', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({ query: statusQuery })
            })
            
            if (!statusResponse.ok) {
              const errorText = await statusResponse.text()
              console.error(`❌ Failed to check PO status:`, {
                status: statusResponse.status,
                error: errorText
              })
              throw new Error(`Failed to check PO status: HTTP ${statusResponse.status}`)
            }
            
            const statusResult = await statusResponse.json()
            console.log(`🔍 DEBUG: PO status check result:`, JSON.stringify(statusResult, null, 2))
            
            if (statusResult.errors) {
              console.error(`❌ GraphQL errors checking PO status:`, statusResult.errors)
              throw new Error(`Failed to check PO status: ${statusResult.errors[0].message}`)
            }
            
            const currentPO = statusResult.data?.purchase_order
            if (!currentPO) {
              throw new Error(`Purchase order not found: ${order.po_number}`)
            }
            
            console.log(`📋 Current PO status: ${currentPO.fulfillment_status}`)
            
            // Check if PO can be canceled
            const cancelableStatuses = ['pending', 'processing', 'on_hold']
            if (!cancelableStatuses.includes(currentPO.fulfillment_status)) {
              throw new Error(`Cannot cancel PO in status '${currentPO.fulfillment_status}'. Only POs with status: ${cancelableStatuses.join(', ')} can be canceled.`)
            }
            
            // Step 2: Now proceed with cancellation using official mutation
            query = `
              mutation {
                purchase_order_update(data: {
                  po_id: "${poId}"
                  fulfillment_status: "canceled"
                }) {
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
            
            console.log(`✅ PO can be canceled. Using official purchase_order_update mutation:`, query)
          } else if (type === 'sales') {
            // Update sales order fulfillment status
            query = `
              mutation {
                order_update(
                  data: {
                    order_id: "${order.id}"
                    fulfillment_status: "${targetStatus}"
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
            // Update purchase order fulfillment status
            query = `
              mutation {
                purchase_order_update(
                  data: {
                    purchase_order_id: "${order.id}"
                    fulfillment_status: "${targetStatus}"
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
          const errorText = await response.text()
          console.error(`❌ ShipHero API HTTP Error:`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
            query: query
          })
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        
        console.log(`🔍 DEBUG: ShipHero API response for ${type} order ${order.legacy_id || order.id}:`, JSON.stringify(result, null, 2))
        
        if (result.errors && result.errors.length > 0) {
          console.error(`❌ GraphQL errors for ${type} order ${order.legacy_id}:`, result.errors)
          console.error(`🔍 DEBUG: First GraphQL error details:`, {
            message: result.errors[0].message,
            path: result.errors[0].path,
            extensions: result.errors[0].extensions,
            fullError: result.errors[0]
          })
          errors.push({
            order: order.legacy_id || order.id,
            error: result.errors[0].message,
            graphql_error: result.errors[0]
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

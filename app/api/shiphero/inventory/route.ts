import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get access token from localStorage (client-side) or environment
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '') || 
                       process.env.SHIPHERO_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No ShipHero access token available' },
        { status: 401 }
      )
    }

    // GraphQL query to get all products with inventory information
    const query = `
      query GetInventory {
        products(first: 100, has_inventory: true) {
          data {
            edges {
              node {
                sku
                name
                inventory {
                  available
                  on_hand
                  allocated
                  warehouse_id
                }
                warehouse {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    })

    const result = await response.json()
    console.log('ShipHero inventory API response:', {
      status: response.status,
      hasData: !!result.data,
      hasErrors: !!result.errors,
      errors: result.errors,
      dataStructure: result.data ? Object.keys(result.data) : 'no data'
    })

    if (result.errors) {
      console.error('ShipHero API errors:', result.errors)
      return NextResponse.json(
        { error: 'ShipHero API error', details: result.errors },
        { status: 400 }
      )
    }

    // Extract products and flatten the data structure
    const products = result.data?.products?.data?.edges?.map((edge: any) => ({
      sku: edge.node.sku,
      name: edge.node.name,
      inventory: {
        available: edge.node.inventory.available || 0,
        on_hand: edge.node.inventory.on_hand || 0,
        allocated: edge.node.inventory.allocated || 0,
        warehouse_id: edge.node.inventory.warehouse_id
      },
      warehouse: {
        id: edge.node.warehouse?.id,
        name: edge.node.warehouse?.name
      }
    })) || []

    return NextResponse.json({
      success: true,
      products,
      total: products.length
    })

  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('📦 ShipHero Inventory API called')
  
  try {
    // Get access token from localStorage (client-side) or environment
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '') || 
                       process.env.SHIPHERO_ACCESS_TOKEN

    console.log('🔑 Token check:', {
      hasAuthHeader: !!request.headers.get('authorization'),
      hasEnvToken: !!process.env.SHIPHERO_ACCESS_TOKEN,
      tokenStart: accessToken ? accessToken.substring(0, 20) + '...' : 'none'
    })

    if (!accessToken) {
      console.log('❌ No access token available')
      return NextResponse.json(
        { error: 'No ShipHero access token available' },
        { status: 401 }
      )
    }

    // GraphQL query to get all products with inventory information
    const query = `
      query GetInventory {
        products(first: 100, has_inventory: true) {
          request_id
          complexity
          data {
            edges {
              node {
                id
                sku
                name
                inventory {
                  warehouse_id
                  on_hand
                  available
                  allocated
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `

    console.log('🚀 Making ShipHero GraphQL request:', {
      endpoint: 'https://public-api.shiphero.com/graphql',
      method: 'POST',
      hasToken: !!accessToken,
      queryLength: query.length,
      queryStart: query.substring(0, 100) + '...'
    })

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    })

    console.log('📡 ShipHero response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
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
      console.error('❌ ShipHero API returned errors:', {
        errorCount: result.errors.length,
        errors: result.errors,
        fullResponse: result
      })
      return NextResponse.json(
        { error: 'ShipHero API error', details: result.errors },
        { status: 400 }
      )
    }

    if (!response.ok) {
      console.error('❌ HTTP error from ShipHero:', {
        status: response.status,
        statusText: response.statusText,
        result: result
      })
      return NextResponse.json(
        { error: `ShipHero API HTTP error: ${response.status} ${response.statusText}`, details: result },
        { status: response.status }
      )
    }

    // Extract products and flatten the data structure
    const products = result.data?.products?.data?.edges?.map((edge: any) => {
      const inventory = edge.node.inventory || {}
      return {
        sku: edge.node.sku,
        name: edge.node.name,
        inventory: {
          available: inventory.available || 0,
          on_hand: inventory.on_hand || 0,
          allocated: inventory.allocated || 0,
          warehouse_id: inventory.warehouse_id
        }
      }
    }) || []

    console.log('✅ Successfully processed inventory data:', {
      totalProducts: products.length,
      productsWithAvailableInventory: products.filter(p => p.inventory.available > 0).length,
      sampleSKUs: products.slice(0, 3).map(p => p.sku)
    })

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

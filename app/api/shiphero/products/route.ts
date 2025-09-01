import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    // Query products with SWAG in the SKU
    const query = `
      query {
        account {
          request_id
          complexity
          data {
            products(first: 100, filter: { sku: { contains: "SWAG" } }) {
              edges {
                node {
                  id
                  legacy_id
                  sku
                  name
                  product_type
                  vendor
                  created_at
                  updated_at
                }
              }
            }
          }
        }
      }
    `

    console.log('ShipHero Products API - Query:', query)

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query })
    })

    console.log('ShipHero Products API - Response Status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('ShipHero Products API - Error Response:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('ShipHero Products API - Success Response:', JSON.stringify(result, null, 2))
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('ShipHero products API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

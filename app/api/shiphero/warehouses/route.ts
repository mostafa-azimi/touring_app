import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('ShipHero warehouses API route called')
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    
    if (!accessToken) {
      console.log('No access token provided')
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    // Try the exact query format that might work
    const query = `query { warehouses { data { id name } } }`

    const requestBody = { query }
    console.log('Sending request to ShipHero:', {
      url: 'https://public-api.shiphero.com/graphql',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.substring(0, 10)}...`
      },
      body: requestBody
    })

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('ShipHero response status:', response.status)
    console.log('ShipHero response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('ShipHero error response:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('ShipHero warehouses API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

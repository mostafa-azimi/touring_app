import { NextRequest, NextResponse } from 'next/server'
import { databaseTokenService } from '@/lib/shiphero/database-token-service'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 Access token API called')

    const accessToken = await databaseTokenService.getValidAccessToken()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid access token available. Please configure ShipHero tokens in Settings.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      access_token: accessToken,
      success: true
    })

  } catch (error: any) {
    console.error('❌ Access token API error:', error)
    return NextResponse.json(
      { error: 'Failed to get access token', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔑 Storing new ShipHero tokens...')
    
    const { access_token, refresh_token, expires_in } = await request.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Both access_token and refresh_token are required' },
        { status: 400 }
      )
    }

    const stored = await databaseTokenService.storeToken(
      access_token, 
      refresh_token, 
      expires_in || 86400
    )

    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to store tokens' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tokens stored successfully'
    })

  } catch (error: any) {
    console.error('❌ Store tokens API error:', error)
    return NextResponse.json(
      { error: 'Failed to store tokens', details: error.message },
      { status: 500 }
    )
  }
}

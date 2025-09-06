import { NextRequest, NextResponse } from 'next/server'
import { databaseTokenService } from '@/lib/shiphero/database-token-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Migrating tokens from localStorage to database...')

    // This endpoint helps migrate existing localStorage tokens to database
    const body = await request.json()
    const { access_token, refresh_token } = body

    if (!access_token || !refresh_token) {
      return NextResponse.json({
        error: 'Both access_token and refresh_token are required',
        message: 'Please provide your current ShipHero tokens'
      }, { status: 400 })
    }

    // Store tokens in database
    const success = await databaseTokenService.storeToken(access_token, refresh_token, 86400)

    if (success) {
      console.log('✅ Tokens successfully migrated to database')
      return NextResponse.json({
        success: true,
        message: 'Tokens successfully stored in database. Order cancellation should now work!'
      })
    } else {
      console.error('❌ Failed to store tokens in database')
      return NextResponse.json({
        error: 'Failed to store tokens in database'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Token migration error:', error)
    return NextResponse.json({
      error: 'Token migration failed',
      details: error.message
    }, { status: 500 })
  }
}

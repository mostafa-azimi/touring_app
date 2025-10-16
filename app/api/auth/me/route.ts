import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/me
 * Get current user info
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let sessionData
    try {
      const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
      sessionData = JSON.parse(decoded)
    } catch {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Check if session is expired
    if (Date.now() > sessionData.exp) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get current user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, company_name, is_admin, last_login_at')
      .eq('id', sessionData.userId)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        isAdmin: user.is_admin,
        lastLoginAt: user.last_login_at
      }
    })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/logout
 * Logout current user
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Clear session cookie
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

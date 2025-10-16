import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin session
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

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', sessionData.userId)
      .eq('is_admin', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, company_name, is_admin, last_login_at, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get users error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        isAdmin: user.is_admin,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      }))
    })

  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const adminResetSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6)
})

/**
 * POST /api/auth/admin/reset-password
 * Admin endpoint to reset any user's password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, newPassword } = adminResetSchema.parse(body)

    const supabase = createServiceClient()

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

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update user's password
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('email, first_name, last_name')
      .single()

    if (updateError) {
      console.error('Admin password reset error:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${updatedUser.first_name} ${updatedUser.last_name} (${updatedUser.email})`
    })

  } catch (error) {
    console.error('Admin password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

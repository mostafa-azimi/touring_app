import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const changePasswordSchema = z.object({
  resetToken: z.string(),
  newPassword: z.string().min(6)
})

/**
 * POST /api/auth/change-password
 * Change password using reset token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { resetToken, newPassword } = changePasswordSchema.parse(body)

    // Verify reset token
    let tokenData
    try {
      const decoded = Buffer.from(resetToken, 'base64').toString('utf-8')
      tokenData = JSON.parse(decoded)
    } catch {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (Date.now() > tokenData.exp) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update password
    const { error } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenData.userId)

    if (error) {
      console.error('Password change error:', error)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })

  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

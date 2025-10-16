import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  email: z.string().email()
})

/**
 * POST /api/auth/reset-password
 * Send password reset email (simplified - just generates reset token)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resetPasswordSchema.parse(body)

    const supabase = await createClient()

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (userError || !user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      })
    }

    // Generate reset token (simple approach for demo)
    const resetToken = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      exp: Date.now() + 60 * 60 * 1000 // 1 hour
    })).toString('base64')

    // In production, you'd send this via email
    // For now, we'll return it in the response for easy testing
    console.log(`🔑 Password reset token for ${email}: ${resetToken}`)

    return NextResponse.json({
      success: true,
      message: 'Password reset token generated',
      resetToken: resetToken, // Remove this in production
      instructions: 'Use this token with /api/auth/change-password'
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { createClient } from '@/lib/supabase/client'

interface TokenData {
  access_token: string
  refresh_token: string
  expires_at: string
}

export class DatabaseTokenService {
  private supabase = createClient()
  private userId: string | null = null

  setUserId(userId: string) {
    this.userId = userId
  }

  /**
   * Get valid access token from database, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    try {
      console.log('🔑 Getting access token from database...')

      // Get the latest token from database
      const { data: tokenData, error } = await this.supabase
        .from('shiphero_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !tokenData) {
        console.log('❌ No token found in database:', error?.message)
        return null
      }

      // Check if token is still valid (with 5 minute buffer)
      const expiresAt = new Date(tokenData.expires_at)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt > fiveMinutesFromNow) {
        console.log('✅ Using valid access token from database')
        return tokenData.access_token
      }

      console.log('🔄 Token expired, refreshing...')
      
      // Token is expired or expiring soon, refresh it
      const refreshed = await this.refreshAndStoreToken(tokenData.refresh_token)
      if (refreshed) {
        return refreshed.access_token
      }

      return null

    } catch (error) {
      console.error('❌ Error getting access token from database:', error)
      return null
    }
  }

  /**
   * Store new token data in database
   */
  async storeToken(accessToken: string, refreshToken: string, expiresIn: number = 86400): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      // Delete old tokens first
      await this.supabase.from('shiphero_tokens').delete().neq('id', 0)

      // CRITICAL: Delete all warehouses when storing new tokens
      // This ensures warehouses from previous ShipHero accounts don't persist
      console.log('🗑️ Clearing old warehouses from previous ShipHero account...')
      await this.supabase.from('warehouses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      console.log('✅ Old warehouses cleared')

      // Insert new token
      const { error } = await this.supabase
        .from('shiphero_tokens')
        .insert({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString()
        })

      if (error) {
        console.error('❌ Error storing token:', error)
        return false
      }

      console.log('✅ Token stored in database, expires at:', expiresAt.toISOString())
      return true

    } catch (error) {
      console.error('❌ Error storing token in database:', error)
      return false
    }
  }

  /**
   * Clear all stored tokens (disable ShipHero access)
   */
  async clearAllTokens(): Promise<boolean> {
    try {
      console.log('🗑️ Clearing all ShipHero tokens from database...')
      
      const { error } = await this.supabase
        .from('shiphero_tokens')
        .delete()
        .neq('id', 0) // Delete all rows
      
      if (error) {
        console.error('❌ Error clearing tokens:', error)
        return false
      }
      
      console.log('✅ All ShipHero tokens cleared from database')
      return true
      
    } catch (error) {
      console.error('❌ Error clearing tokens:', error)
      return false
    }
  }

  /**
   * Refresh token using ShipHero API and store the result
   */
  private async refreshAndStoreToken(refreshToken: string): Promise<TokenData | null> {
    try {
      console.log('🔄 Refreshing token with ShipHero API...')

      const response = await fetch('https://public-api.shiphero.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ ShipHero refresh error:', errorText)
        return null
      }

      const data = await response.json()
      console.log('✅ Token refreshed successfully')

      // Store the new token in database
      const stored = await this.storeToken(
        data.access_token, 
        data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep existing
        data.expires_in || 86400
      )

      if (!stored) {
        console.error('❌ Failed to store refreshed token')
        return null
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_at: new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString()
      }

    } catch (error) {
      console.error('❌ Error refreshing token:', error)
      return null
    }
  }

  /**
   * Initialize token storage with initial tokens (for setup)
   */
  async initializeWithTokens(accessToken: string, refreshToken: string): Promise<boolean> {
    console.log('🚀 Initializing database with ShipHero tokens...')
    return await this.storeToken(accessToken, refreshToken)
  }
}

// Export singleton instance
export const databaseTokenService = new DatabaseTokenService()

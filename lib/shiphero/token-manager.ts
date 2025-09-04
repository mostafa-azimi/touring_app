/**
 * ShipHero Token Management Utility
 * Handles automatic token refresh and persistence
 */

export class ShipHeroTokenManager {
  private static instance: ShipHeroTokenManager
  private refreshInterval: NodeJS.Timeout | null = null

  private constructor() {}

  public static getInstance(): ShipHeroTokenManager {
    if (!ShipHeroTokenManager.instance) {
      ShipHeroTokenManager.instance = new ShipHeroTokenManager()
    }
    return ShipHeroTokenManager.instance
  }

  /**
   * Check if access token exists and is valid
   */
  public hasValidAccessToken(): boolean {
    const accessToken = localStorage.getItem('shiphero_access_token')
    const expiresAt = localStorage.getItem('shiphero_token_expires_at')
    
    if (!accessToken || !expiresAt) {
      return false
    }

    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const minutesUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60)
    
    // Consider token invalid if it expires in less than 2 minutes
    return minutesUntilExpiry > 2
  }

  /**
   * Get access token, refreshing if necessary
   */
  public async getValidAccessToken(): Promise<string | null> {
    if (this.hasValidAccessToken()) {
      return localStorage.getItem('shiphero_access_token')
    }

    // Try to refresh the token
    const refreshed = await this.refreshAccessToken()
    if (refreshed) {
      return localStorage.getItem('shiphero_access_token')
    }

    return null
  }

  /**
   * Refresh the access token using the refresh token
   */
  public async refreshAccessToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('shiphero_refresh_token')
    
    if (!refreshToken) {
      console.error('❌ No refresh token available for auto-refresh')
      return false
    }

    try {
      console.log('🔄 Auto-refreshing ShipHero access token...')
      
      const response = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.access_token) {
        // Store new access token
        localStorage.setItem('shiphero_access_token', data.access_token)
        
        // Calculate and store expiration (ShipHero tokens typically last 1 hour)
        const expirationDate = new Date()
        expirationDate.setHours(expirationDate.getHours() + 1)
        localStorage.setItem('shiphero_token_expires_at', expirationDate.toISOString())
        
        console.log('✅ Access token auto-refreshed successfully')
        return true
      } else {
        throw new Error('No access token in response')
      }
    } catch (error) {
      console.error('❌ Failed to auto-refresh access token:', error)
      return false
    }
  }

  /**
   * Start automatic token refresh monitoring
   */
  public startAutoRefresh(): void {
    // Clear existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    // Check every 5 minutes
    this.refreshInterval = setInterval(async () => {
      const expiresAt = localStorage.getItem('shiphero_token_expires_at')
      if (expiresAt) {
        const expirationDate = new Date(expiresAt)
        const now = new Date()
        const minutesUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60)
        
        // Refresh if expires in less than 10 minutes
        if (minutesUntilExpiry < 10 && minutesUntilExpiry > 0) {
          console.log(`🔄 Token expires in ${minutesUntilExpiry.toFixed(1)} minutes, refreshing...`)
          await this.refreshAccessToken()
        }
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    console.log('🔄 Started automatic token refresh monitoring')
  }

  /**
   * Stop automatic token refresh monitoring
   */
  public stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
      console.log('⏹️ Stopped automatic token refresh monitoring')
    }
  }
}

// Export singleton instance
export const tokenManager = ShipHeroTokenManager.getInstance()

import { createClient } from '@/lib/supabase/client'

export interface TenantConfig {
  id?: string
  shiphero_vendor_id: string
  shop_name: string
  company_name: string
  default_fulfillment_status: string
  enable_hold_until: boolean
}

export class TenantConfigService {
  private supabase = createClient()
  private configCache: TenantConfig | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get tenant configuration with caching
   */
  async getConfig(): Promise<TenantConfig> {
    const now = Date.now()
    
    // Return cached config if still valid
    if (this.configCache && now < this.cacheExpiry) {
      return this.configCache
    }

    try {
      const { data, error } = await this.supabase
        .from('tenant_config')
        .select('*')
        .limit(1)

      if (error) {
        console.warn('Error loading tenant config:', error)
      }
      
      const configData = data && data.length > 0 ? data[0] : null

      // Use provided data or defaults
        const config: TenantConfig = configData || {
          shiphero_vendor_id: "1076735", // Default fallback
          shop_name: "Tour Orders",
          company_name: "Tour Company",
          default_fulfillment_status: "pending", // Correct default for new purchase orders
          enable_hold_until: false // Default to disabled
        }

      // Cache the config
      this.configCache = config
      this.cacheExpiry = now + this.CACHE_DURATION

      return config
    } catch (error) {
      console.error('Error loading tenant config:', error)
      
      // Return default config on error
      const defaultConfig: TenantConfig = {
        shiphero_vendor_id: "1076735",
        shop_name: "Tour Orders",
        company_name: "Tour Company",
        default_fulfillment_status: "pending",
        enable_hold_until: false // Default to disabled
      }
      
      return defaultConfig
    }
  }

  /**
   * Get shop name for orders
   */
  async getShopName(): Promise<string> {
    try {
      const config = await this.getConfig()
      return config.shop_name || "Tour Orders"
    } catch (error) {
      console.error('Error getting shop name:', error)
      return "Tour Orders"
    }
  }

  /**
   * Get default fulfillment status for SALES ORDERS
   */
  async getDefaultFulfillmentStatus(): Promise<string> {
    try {
      const config = await this.getConfig()
      const status = config.default_fulfillment_status || "pending"
      console.log(`🔍 getDefaultFulfillmentStatus (for sales orders) returning: "${status}"`)
      return status
    } catch (error) {
      console.error('Error getting fulfillment status:', error)
      console.log(`🔍 getDefaultFulfillmentStatus fallback: "pending"`)
      return "pending"
    }
  }

  /**
   * Get fulfillment status for PURCHASE ORDERS (always "pending")
   */
  async getPurchaseOrderFulfillmentStatus(): Promise<string> {
    // Purchase orders ALWAYS use "pending" regardless of tenant config
    console.log(`🔍 getPurchaseOrderFulfillmentStatus returning: "pending" (required for POs)`)
    return "pending"
  }

  /**
   * Check if hold until is enabled (bypasses cache for real-time settings check)
   */
  async isHoldUntilEnabled(): Promise<boolean> {
    try {
      console.log('🔍 HOLD UNTIL CHECK: Fetching fresh config from database (bypassing cache)...')
      
      // Bypass cache for hold until check to get real-time setting
      const { data, error } = await this.supabase
        .from('tenant_config')
        .select('enable_hold_until')
        .limit(1)

      if (error) {
        console.error('🔒 Error checking hold until setting:', error)
        console.log('🔒 Hold Until setting: DISABLED (fallback due to error)')
        return false
      }
      
      const configData = data && data.length > 0 ? data[0] : null
      const enabled = configData?.enable_hold_until || false
      
      console.log(`🔒 HOLD UNTIL SETTING (fresh from DB): ${enabled ? 'ENABLED' : 'DISABLED'}`)
      console.log(`🔍 Raw database value:`, configData?.enable_hold_until)
      console.log(`🔍 Config data found:`, configData ? 'YES' : 'NO')
      
      return enabled
    } catch (error) {
      console.error('Error checking hold until setting:', error)
      console.log('🔒 Hold Until setting: DISABLED (fallback due to error)')
      return false // Default to disabled on error
    }
  }

  /**
   * Clear the config cache (useful when settings are updated)
   */
  clearCache(): void {
    console.log('🗑️ Clearing tenant config cache')
    this.configCache = null
    this.cacheExpiry = 0
  }
}

// Singleton instance
export const tenantConfigService = new TenantConfigService()

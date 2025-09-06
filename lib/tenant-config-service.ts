import { createClient } from '@/lib/supabase/client'

export interface TenantConfig {
  id?: string
  shiphero_vendor_id: string
  shop_name: string
  company_name: string
  default_fulfillment_status: string
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
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // Use provided data or defaults
      const config: TenantConfig = data || {
        shiphero_vendor_id: "1076735", // Default fallback
        shop_name: "Tour Orders",
        company_name: "Tour Company",
        default_fulfillment_status: "pending"
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
        default_fulfillment_status: "pending"
      }
      
      return defaultConfig
    }
  }

  /**
   * Clear the config cache (useful after updates)
   */
  clearCache(): void {
    this.configCache = null
    this.cacheExpiry = 0
  }
}

// Singleton instance
export const tenantConfigService = new TenantConfigService()

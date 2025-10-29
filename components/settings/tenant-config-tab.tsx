"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, RefreshCw, Building2, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { WorkflowDefaultsSection } from "./workflow-defaults-section"

interface TenantConfig {
  id?: string
  shiphero_vendor_id: string
  shop_name: string
  company_name: string
  default_fulfillment_status: string
  enable_hold_until: boolean
}

const FULFILLMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "Tour_Orders", label: "Tour Orders" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "partially_fulfilled", label: "Partially Fulfilled" },
  { value: "cancelled", label: "Cancelled" }
]

export function TenantConfigTab() {
  const [config, setConfig] = useState<TenantConfig>({
    shiphero_vendor_id: "",
    shop_name: "Tour Orders",
    company_name: "Tour Company",
    default_fulfillment_status: "pending",
    enable_hold_until: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('tenant_config')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setConfig(data)
      }
    } catch (error) {
      console.error('Error loading tenant config:', error)
      // Don't show error toast, just use defaults
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      setIsSaving(true)
      
      const { error } = await supabase
        .from('tenant_config')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Clear the tenant config cache so changes take effect immediately
      const { tenantConfigService } = await import('@/lib/tenant-config-service')
      tenantConfigService.clearCache()
      console.log('🔄 Cleared tenant config cache after save')

      toast({
        title: "Configuration Saved",
        description: "Tenant settings have been updated successfully",
      })
    } catch (error: any) {
      console.error('Error saving tenant config:', error)
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof TenantConfig, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading configuration...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Tenant Configuration</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Order Settings
          </CardTitle>
          <CardDescription>
            Configure default settings for order creation and fulfillment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="shop_name">Shop Name</Label>
              <Input
                id="shop_name"
                value={config.shop_name}
                onChange={(e) => handleInputChange('shop_name', e.target.value)}
                placeholder="Tour Orders"
              />
              <p className="text-sm text-muted-foreground">
                This appears as the shop name in ShipHero orders
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={config.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Tour Company"
              />
              <p className="text-sm text-muted-foreground">
                Used in billing and shipping addresses
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shiphero_vendor_id">ShipHero Vendor ID</Label>
              <Input
                id="shiphero_vendor_id"
                value={config.shiphero_vendor_id}
                onChange={(e) => handleInputChange('shiphero_vendor_id', e.target.value)}
                placeholder="1076735"
              />
              <p className="text-sm text-muted-foreground">
                Required for purchase order creation. Get this from your ShipHero account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fulfillment_status">Default Fulfillment Status</Label>
              <Select
                value={config.default_fulfillment_status}
                onValueChange={(value) => handleInputChange('default_fulfillment_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {FULFILLMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Default status for new orders
              </p>
            </div>
          </div>

          {/* Hold Until Setting */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="hold_until">Enable Hold Until</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, orders will be created with a "hold until" status to prevent immediate fulfillment
                </p>
              </div>
              <Switch
                id="hold_until"
                checked={config.enable_hold_until}
                onCheckedChange={(checked) => handleInputChange('enable_hold_until', checked)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Defaults Section */}
      <WorkflowDefaultsSection />
    </div>
  )
}

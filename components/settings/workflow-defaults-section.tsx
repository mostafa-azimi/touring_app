"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronUp, Save, Settings2, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { WorkflowOption } from "@/lib/shiphero/tour-finalization-service"

// Workflow options (same as Schedule Tour page)
const workflowOptions = [
  {
    id: "standard_receiving" as WorkflowOption,
    name: "Standard Receiving",
    description: "Creates one purchase order using your selected SKUs and quantities for receiving training",
    category: "Inbound",
    badge: "Standard"
  },
  {
    id: "bulk_shipping" as WorkflowOption,
    name: "Bulk Shipping",
    description: "Creates identical orders with same SKUs shipping to different customer addresses",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "single_item_batch" as WorkflowOption,
    name: "Single-Item Batch",
    description: "Creates single line-item orders with different SKUs shipping to different customer addresses",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "multi_item_batch" as WorkflowOption,
    name: "Multi-Item Batch",
    description: "Creates randomized orders with multiple SKUs for complex batch picking training",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "pack_to_light" as WorkflowOption,
    name: "Pack to Light",
    description: "Creates orders with pack to light workflow for training packing station operations with light-guided assistance",
    category: "Fulfillment",
    badge: "Standard"
  },
]

// Generic component for product selection with quantities (reused from Schedule Tour page)
function WorkflowProductSelection({ allSkus, workflowConfig, onSkuQuantityChange, selectedWarehouse, workflowName, workflowId }: {
  allSkus: any[]
  workflowConfig: any
  onSkuQuantityChange: (sku: string, quantity: number) => void
  selectedWarehouse: string
  workflowName: string
  workflowId: string
}) {
  if (allSkus.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-700">
          Loading products from all warehouses...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">📦 Select products and quantities for {workflowName}:</Label>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {allSkus.map((product) => {
          const currentQuantity = workflowConfig?.skuQuantities?.[product.sku] || 0
          const availableQty = product.inventory?.available || 0
          
          return (
            <div 
              key={product.sku} 
              className="relative flex flex-col space-y-3 p-4 rounded-lg border transition-all duration-200 border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-25"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {product.sku}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {product.name}
                </div>
                <div className="flex items-center mt-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    availableQty > 0 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {availableQty} available
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`qty-${product.sku}`} className="text-xs">Qty:</Label>
                <Input
                  id={`qty-${product.sku}`}
                  type="number"
                  min="0"
                  value={currentQuantity}
                  onChange={(e) => {
                    const newQuantity = parseInt(e.target.value) || 0
                    onSkuQuantityChange(product.sku, newQuantity)
                  }}
                  className="w-20 h-8 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Enter quantities for products you want to include in the {workflowName.toLowerCase()}. Set to 0 to exclude.
      </p>
    </div>
  )
}

export function WorkflowDefaultsSection() {
  const [allSkus, setAllSkus] = useState<any[]>([])
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Workflow configuration state
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([
    "standard_receiving", 
    "bulk_shipping", 
    "single_item_batch", 
    "multi_item_batch",
    "pack_to_light"
  ])
  const [workflowConfigs, setWorkflowConfigs] = useState<{[key: string]: {orderCount: number, skuQuantities: {[sku: string]: number}}}>({})
  const [expandedWorkflows, setExpandedWorkflows] = useState<string[]>([
    "standard_receiving", 
    "bulk_shipping", 
    "single_item_batch", 
    "multi_item_batch",
    "pack_to_light"
  ])

  const { toast } = useToast()
  const supabase = createClient()

  // Default order counts for each workflow (matches database migration)
  const getDefaultOrderCount = (workflowId: string): number => {
    switch (workflowId) {
      case 'standard_receiving': return 1 // 1 purchase order
      case 'bulk_shipping': return 15 // 15 bulk shipping orders (from screenshot)
      case 'single_item_batch': return 5 // 5 single-item orders (from screenshot)
      case 'multi_item_batch': return 8 // 8 multi-item orders (from screenshot)
      case 'pack_to_light': return 5 // 5 pack to light orders (from screenshot)
      default: return 5
    }
  }

  // Load all products and existing defaults
  useEffect(() => {
    loadAllProducts()
    loadWorkflowDefaults()
  }, [])

  const loadAllProducts = async () => {
    try {
      setIsLoadingSkus(true)
      
      console.log('🚀 Loading products using SAME method as Tour Creation page...')
      
      // Use the EXACT same method as Tour Creation page
      const { shipHeroDataService } = await import('@/lib/shiphero/data-service')
      const activeProducts = await shipHeroDataService.getActiveProducts()
      
      console.log(`✅ Loaded ${activeProducts.length} raw products using shipHeroDataService`)
      
      // Debug: Log first product to see structure
      if (activeProducts.length > 0) {
        console.log(`🔍 Sample product structure:`, activeProducts[0])
      }
      
      // Aggregate products by SKU to combine quantities from multiple warehouses
      const productMap = new Map<string, any>()
      
      activeProducts.forEach((product: any) => {
        const sku = product.sku
        const qty = product.inventory?.available || 0
        
        if (productMap.has(sku)) {
          // Product already exists, add to quantity
          const existing = productMap.get(sku)
          existing.totalAvailable += qty
          existing.warehouseCount += 1
          console.log(`🔄 Combining ${sku}: ${existing.totalAvailable} total units (from ${existing.warehouseCount} warehouses)`)
        } else {
          // New product
          productMap.set(sku, {
            ...product,
            totalAvailable: qty,
            warehouseCount: 1
          })
          console.log(`✅ Added ${sku}: ${qty} units`)
        }
      })
      
      // Convert back to array and sort alphabetically
      const aggregatedProducts = Array.from(productMap.values()).map(product => ({
        ...product,
        inventory: {
          ...product.inventory,
          available: product.totalAvailable // Use combined quantity
        }
      })).sort((a, b) => a.sku.localeCompare(b.sku))
      
      console.log(`📊 AGGREGATED ${aggregatedProducts.length} unique products:`)
      aggregatedProducts.slice(0, 5).forEach(product => {
        console.log(`  ${product.sku}: ${product.inventory?.available} total units`)
      })
      
      setAllSkus(aggregatedProducts)
      console.log(`✅ Settings page showing ${aggregatedProducts.length} unique products with combined quantities`)
      
    } catch (error: any) {
      console.error('Error loading products with shipHeroDataService:', error)
      toast({
        title: "Error",
        description: `Failed to load products: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsLoadingSkus(false)
    }
  }

  const loadWorkflowDefaults = async () => {
    try {
      const { data, error } = await supabase
        .from('tenant_config')
        .select('workflow_defaults')
        .limit(1)

      if (error) {
        console.warn('Error loading workflow defaults:', error)
        // Don't throw error, just continue with empty defaults
        return
      }

      const configData = data && data.length > 0 ? data[0] : null
      if (configData?.workflow_defaults && typeof configData.workflow_defaults === 'object') {
        const defaults = configData.workflow_defaults
        
        // Load saved workflow configurations
        setWorkflowConfigs(defaults)
        
        // Load selected workflows from defaults
        const savedWorkflows = Object.keys(defaults).filter(key => 
          defaults[key] && typeof defaults[key] === 'object' && Object.keys(defaults[key]).length > 0
        )
        if (savedWorkflows.length > 0) {
          setSelectedWorkflows(savedWorkflows)
          setExpandedWorkflows(savedWorkflows)
        }
        
        console.log(`Loaded workflow defaults for ${savedWorkflows.length} workflows`)
      } else {
        console.log('No workflow defaults found, using default configuration')
      }
    } catch (error) {
      console.warn('Failed to load workflow defaults:', error)
      // Continue with default settings
    }
  }

  const saveWorkflowDefaults = async () => {
    try {
      setIsSaving(true)
      
      console.log('💾 SAVING workflow defaults:', workflowConfigs)
      
      // Handle multiple tenant_config rows by using the first one or creating new
      const { data: existingConfigs, error: selectError } = await supabase
        .from('tenant_config')
        .select('id')
        .limit(1)
      
      if (selectError) {
        console.warn('Error checking existing config:', selectError)
      }
      
      let saveError
      if (existingConfigs && existingConfigs.length > 0) {
        const existingConfig = existingConfigs[0]
        console.log('📝 Updating existing tenant_config:', existingConfig.id)
        // Update existing config
        const { error } = await supabase
          .from('tenant_config')
          .update({
            workflow_defaults: workflowConfigs,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id)
        saveError = error
      } else {
        console.log('📝 Creating new tenant_config')
        // Insert new config
        const { error } = await supabase
          .from('tenant_config')
          .insert({
            workflow_defaults: workflowConfigs,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        saveError = error
      }

      if (saveError) {
        console.error('❌ Save error:', saveError)
        throw saveError
      }

      console.log('✅ Workflow defaults saved successfully!')
      console.log('📋 Saved configurations:', workflowConfigs)

      toast({
        title: "Workflow Defaults Saved",
        description: "Your workflow configurations have been saved successfully",
      })
      
      // DON'T reload products after saving - this might be causing the reset
      console.log('💡 Keeping current product state (not reloading after save)')
      
    } catch (error: any) {
      console.error('❌ Error saving workflow defaults:', error)
      toast({
        title: "Error",
        description: `Failed to save workflow defaults: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleWorkflowChange = useCallback((workflowId: string, checked: boolean) => {
    setSelectedWorkflows(prev => 
      checked 
        ? [...prev, workflowId]
        : prev.filter(id => id !== workflowId)
    )
    
      if (checked) {
        setExpandedWorkflows(prev => [...prev, workflowId])
        // Initialize with default values if not already set
        if (!workflowConfigs[workflowId]) {
          setWorkflowConfigs(prev => ({
            ...prev,
            [workflowId]: {
              orderCount: getDefaultOrderCount(workflowId),
              skuQuantities: {}
            }
          }))
        }
      } else {
      setExpandedWorkflows(prev => prev.filter(id => id !== workflowId))
    }
  }, [workflowConfigs])

  const updateWorkflowOrderCount = (workflowId: string, count: number) => {
    console.log(`🔢 Updating ${workflowId} order count to: ${count}`)
    setWorkflowConfigs(prev => {
      const newConfig = {
        ...prev,
        [workflowId]: {
          ...prev[workflowId],
          orderCount: count,
          skuQuantities: prev[workflowId]?.skuQuantities || {}
        }
      }
      console.log('📋 New workflow configs after order count update:', newConfig)
      return newConfig
    })
  }

  const toggleWorkflowExpansion = (workflowId: string) => {
    setExpandedWorkflows(prev => 
      prev.includes(workflowId) 
        ? prev.filter(id => id !== workflowId)
        : [...prev, workflowId]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-semibold">Workflow Defaults</h3>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configure Default Settings
          </CardTitle>
          <CardDescription>
            Set up default configurations for each workflow. These settings will be automatically loaded when creating new tours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Information about product aggregation */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600 text-lg">📦</span>
              <h4 className="font-medium text-blue-900">All Warehouse Products</h4>
            </div>
            <p className="text-sm text-blue-700">
              Showing all products from all warehouses with combined quantities. These defaults will work for any warehouse when creating tours.
            </p>
          </div>

          {/* Workflow Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium">Workflow Configurations</h4>
            <div className="space-y-4">
              {workflowOptions.map((option) => (
                <div key={option.id} className="border rounded-lg">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <Checkbox
                          id={`workflow-${option.id}`}
                          checked={selectedWorkflows.includes(option.id)}
                          onCheckedChange={(checked) => handleWorkflowChange(option.id, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`workflow-${option.id}`} className="font-medium cursor-pointer">
                              {option.name}
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                              {option.badge}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {option.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      
                      {selectedWorkflows.includes(option.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWorkflowExpansion(option.id)}
                          className="ml-2"
                        >
                          {expandedWorkflows.includes(option.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Expandable Configuration Section */}
                    {selectedWorkflows.includes(option.id) && expandedWorkflows.includes(option.id) && (
                      <div className="ml-6 p-4 bg-muted/30 rounded-lg border space-y-4 mt-4">
                        {/* Order Count Input - For all workflows */}
                        <div className="flex items-center gap-4">
                          <Label htmlFor={`${option.id}-count`} className="text-sm font-medium">
                            📦 {option.id === 'standard_receiving' ? 'Purchase Orders to Create:' : 'Sales Orders to Create:'}
                          </Label>
                          <Input
                            id={`${option.id}-count`}
                            type="number"
                            min="1"
                            max="100"
                            value={workflowConfigs[option.id]?.orderCount || getDefaultOrderCount(option.id)}
                            onChange={(e) => updateWorkflowOrderCount(option.id, parseInt(e.target.value) || getDefaultOrderCount(option.id))}
                            className="w-20"
                          />
                        </div>

                        {/* Product Selection - Special handling for Multi-Item Batch */}
                        {option.id !== 'multi_item_batch' ? (
                          <WorkflowProductSelection 
                            allSkus={allSkus}
                            workflowConfig={workflowConfigs[option.id]}
                            selectedWarehouse=""
                            workflowName={option.name}
                            workflowId={option.id}
                            onSkuQuantityChange={(sku, quantity) => {
                              console.log(`📦 Updating ${option.id} SKU ${sku} quantity to: ${quantity}`)
                              setWorkflowConfigs(prev => {
                                const newConfig = {
                                  ...prev,
                                  [option.id]: {
                                    orderCount: prev[option.id]?.orderCount || getDefaultOrderCount(option.id),
                                    skuQuantities: {
                                      ...prev[option.id]?.skuQuantities,
                                      [sku]: quantity
                                    }
                                  }
                                }
                                console.log(`📋 Updated ${option.id} config:`, newConfig[option.id])
                                return newConfig
                              })
                            }}
                          />
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-blue-600 text-lg">🎲</span>
                                <h4 className="font-medium text-blue-900">Randomized Multi-Item Orders</h4>
                              </div>
                              <p className="text-sm text-blue-700 mb-2">
                                Select which SKUs to use for randomization. Orders will be created with:
                              </p>
                              <ul className="text-sm text-blue-600 space-y-1 ml-4">
                                <li>• 2-4 random SKUs per order (from your selected SKUs below)</li>
                                <li>• Random quantities: 1 unit (70%), 2 units (25%), 3 units (5%)</li>
                                <li>• Different combinations for each order to provide variety</li>
                              </ul>
                            </div>
                            <WorkflowProductSelection 
                              allSkus={allSkus}
                              workflowConfig={workflowConfigs[option.id]}
                              selectedWarehouse=""
                              workflowName={`${option.name} (Randomization Pool)`}
                              workflowId={option.id}
                              onSkuQuantityChange={(sku, quantity) => {
                                console.log(`🎲 Updating ${option.id} SKU ${sku} quantity to: ${quantity}`)
                                setWorkflowConfigs(prev => {
                                  const newConfig = {
                                    ...prev,
                                    [option.id]: {
                                      orderCount: prev[option.id]?.orderCount || getDefaultOrderCount(option.id),
                                      skuQuantities: {
                                        ...prev[option.id]?.skuQuantities,
                                        [sku]: quantity
                                      }
                                    }
                                  }
                                  console.log(`📋 Updated ${option.id} config:`, newConfig[option.id])
                                  return newConfig
                                })
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={saveWorkflowDefaults} 
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Workflow Defaults"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

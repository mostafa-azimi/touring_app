"use client"

import { useState, useEffect, useCallback } from "react"
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
      <h4 className="font-medium text-sm">📦 Select Products & Quantities for {workflowName}</h4>
      <div className="grid gap-3 max-h-64 overflow-y-auto">
        {allSkus.map((sku) => {
          const currentQuantity = workflowConfig?.skuQuantities?.[sku.sku] || 0
          return (
            <div key={sku.sku} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex-1">
                <div className="font-medium text-sm">{sku.name}</div>
                <div className="text-xs text-muted-foreground">
                  SKU: {sku.sku} • Total Available: {sku.available} units
                  {sku.warehouses && sku.warehouses.length > 1 && (
                    <span className="text-blue-600"> (across {sku.warehouses.filter((w: any) => w.available > 0).length} warehouses)</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`${workflowId}-${sku.sku}`} className="text-xs">Qty:</Label>
                <Input
                  id={`${workflowId}-${sku.sku}`}
                  type="number"
                  min="0"
                  max="100"
                  value={currentQuantity}
                  onChange={(e) => onSkuQuantityChange(sku.sku, parseInt(e.target.value) || 0)}
                  className="w-16 h-8 text-xs"
                />
              </div>
            </div>
          )
        })}
      </div>
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

  // Load all products and existing defaults
  useEffect(() => {
    loadAllProducts()
    loadWorkflowDefaults()
  }, [])

  const loadAllProducts = async () => {
    try {
      setIsLoadingSkus(true)
      
      // First, get all warehouses
      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id, code, name')
        .order('name')

      if (warehouseError) throw warehouseError

      if (!warehouses || warehouses.length === 0) {
        console.warn('No warehouses found')
        setAllSkus([])
        return
      }

      console.log(`🏭 Found ${warehouses.length} warehouses:`, warehouses.map(w => `${w.name} (${w.code})`))

      // Load products from all warehouses
      const allProductsMap = new Map<string, any>()
      const processedWarehouses = new Set<string>()
      
      // Get access token for ShipHero API calls
      let accessToken = localStorage.getItem('shiphero_access_token')
      
      // If no token in localStorage, try to get a fresh one
      if (!accessToken) {
        try {
          const tokenResponse = await fetch('/api/shiphero/access-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json()
            accessToken = tokenData.access_token
            console.log('🔑 Retrieved fresh access token for Settings')
          }
        } catch (error) {
          console.warn('Failed to get fresh access token:', error)
        }
      }
      
      if (!accessToken) {
        console.warn('No ShipHero access token available. Please configure ShipHero integration.')
        toast({
          title: "Authentication Required",
          description: "Please configure ShipHero integration in Settings > ShipHero tab first.",
          variant: "destructive",
        })
        return
      }
      
      for (const warehouse of warehouses) {
        // Skip if we've already processed this warehouse
        if (processedWarehouses.has(warehouse.id)) {
          console.log(`⚠️ Skipping duplicate warehouse: ${warehouse.name} (${warehouse.id})`)
          continue
        }
        processedWarehouses.add(warehouse.id)
        
        try {
          console.log(`🔄 Processing warehouse: ${warehouse.name} (${warehouse.code}) - ID: ${warehouse.id}`)
          
          const response = await fetch(`/api/shiphero/inventory?warehouse_id=${warehouse.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            const products = data.products || []
            
            console.log(`🏭 Loaded ${products.length} products from ${warehouse.name}`)
            
            // Debug: Log first product structure to understand API response
            if (products.length > 0) {
              console.log(`🔍 Sample product structure from ${warehouse.name}:`, products[0])
            }
            
            // Aggregate products across warehouses
            products.forEach((product: any, index: number) => {
              const existingProduct = allProductsMap.get(product.sku)
              
              // Try multiple possible quantity field names
              const productAvailable = parseInt(product.available) || 
                                     parseInt(product.quantity_available) || 
                                     parseInt(product.on_hand) || 
                                     parseInt(product.quantity_on_hand) || 
                                     parseInt(product.inventory_quantity) || 0
              
              console.log(`📦 [${index + 1}/${products.length}] Processing ${product.sku} from ${warehouse.name}: ${productAvailable} units (available: ${product.available}, on_hand: ${product.on_hand}, qty_available: ${product.quantity_available})`)
              
              if (existingProduct) {
                // Check if this warehouse is already recorded for this product
                const warehouseExists = existingProduct.warehouses?.some((w: any) => w.warehouse_code === warehouse.code)
                
                if (!warehouseExists) {
                  // Combine quantities from multiple warehouses
                  existingProduct.available += productAvailable
                  existingProduct.warehouses = existingProduct.warehouses || []
                  existingProduct.warehouses.push({
                    warehouse_code: warehouse.code,
                    warehouse_name: warehouse.name,
                    available: productAvailable
                  })
                  console.log(`🔄 Updated ${product.sku} total: ${existingProduct.available} units`)
                } else {
                  console.log(`⚠️ Skipping duplicate ${product.sku} from ${warehouse.name}`)
                }
              } else {
                // New product
                allProductsMap.set(product.sku, {
                  ...product,
                  available: productAvailable,
                  warehouses: [{
                    warehouse_code: warehouse.code,
                    warehouse_name: warehouse.name,
                    available: productAvailable
                  }]
                })
                console.log(`✅ Added new ${product.sku}: ${productAvailable} units`)
              }
            })
          }
        } catch (error) {
          console.warn(`Failed to load inventory for warehouse ${warehouse.name}:`, error)
          // Continue with other warehouses
        }
      }

      // Convert map to array and sort by name
      const aggregatedProducts = Array.from(allProductsMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      )
      
      // Debug: Log final aggregated results
      console.log(`📊 FINAL AGGREGATION RESULTS:`)
      aggregatedProducts.forEach(product => {
        console.log(`  ${product.sku}: ${product.available} total units from ${product.warehouses?.length || 0} warehouses`)
      })
      
      setAllSkus(aggregatedProducts)
      console.log(`✅ Loaded ${aggregatedProducts.length} unique products from ${warehouses.length} warehouses`)
      
    } catch (error) {
      console.error('Error loading all products:', error)
      toast({
        title: "Error",
        description: "Failed to load products from warehouses. Please try again.",
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
        .maybeSingle()

      if (error) {
        console.warn('Error loading workflow defaults:', error)
        // Don't throw error, just continue with empty defaults
        return
      }

      if (data?.workflow_defaults && typeof data.workflow_defaults === 'object') {
        const defaults = data.workflow_defaults
        
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
      
      // First check if a tenant_config row exists
      const { data: existingConfig, error: selectError } = await supabase
        .from('tenant_config')
        .select('id')
        .maybeSingle()
      
      if (selectError) {
        console.warn('Error checking existing config:', selectError)
      }
      
      let saveError
      if (existingConfig) {
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
        console.error('Save error:', saveError)
        throw saveError
      }

      toast({
        title: "Workflow Defaults Saved",
        description: "Your workflow configurations have been saved successfully",
      })
    } catch (error: any) {
      console.error('Error saving workflow defaults:', error)
      toast({
        title: "Error",
        description: `Failed to save workflow defaults: ${error.message || 'Unknown error'}`,
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
            orderCount: 5,
            skuQuantities: {}
          }
        }))
      }
    } else {
      setExpandedWorkflows(prev => prev.filter(id => id !== workflowId))
    }
  }, [workflowConfigs])

  const updateWorkflowOrderCount = (workflowId: string, count: number) => {
    setWorkflowConfigs(prev => ({
      ...prev,
      [workflowId]: {
        ...prev[workflowId],
        orderCount: count,
        skuQuantities: prev[workflowId]?.skuQuantities || {}
      }
    }))
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
                        {/* Order Count Input - Only for fulfillment workflows */}
                        {!['standard_receiving'].includes(option.id) && (
                          <div className="flex items-center gap-4">
                            <Label htmlFor={`${option.id}-count`} className="text-sm font-medium">
                              📦 Default Orders to Create:
                            </Label>
                            <Input
                              id={`${option.id}-count`}
                              type="number"
                              min="1"
                              max="50"
                              value={workflowConfigs[option.id]?.orderCount || 5}
                              onChange={(e) => updateWorkflowOrderCount(option.id, parseInt(e.target.value) || 5)}
                              className="w-20"
                            />
                          </div>
                        )}

                        {/* Product Selection - Special handling for Multi-Item Batch */}
                        {option.id !== 'multi_item_batch' ? (
                          <WorkflowProductSelection 
                            allSkus={allSkus}
                            workflowConfig={workflowConfigs[option.id]}
                            selectedWarehouse=""
                            workflowName={option.name}
                            workflowId={option.id}
                            onSkuQuantityChange={(sku, quantity) => {
                              setWorkflowConfigs(prev => ({
                                ...prev,
                                [option.id]: {
                                  orderCount: prev[option.id]?.orderCount || 5,
                                  skuQuantities: {
                                    ...prev[option.id]?.skuQuantities,
                                    [sku]: quantity
                                  }
                                }
                              }))
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
                                setWorkflowConfigs(prev => ({
                                  ...prev,
                                  [option.id]: {
                                    orderCount: prev[option.id]?.orderCount || 5,
                                    skuQuantities: {
                                      ...prev[option.id]?.skuQuantities,
                                      [sku]: quantity
                                    }
                                  }
                                }))
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

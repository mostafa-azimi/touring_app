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
  const filteredSkus = selectedWarehouse 
    ? allSkus.filter(sku => sku.warehouse_id === selectedWarehouse)
    : allSkus

  if (filteredSkus.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-700">
          {selectedWarehouse ? 'No products found for selected warehouse' : 'Please select a warehouse to see available products'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">📦 Select Products & Quantities for {workflowName}</h4>
      <div className="grid gap-3 max-h-64 overflow-y-auto">
        {filteredSkus.map((sku) => {
          const currentQuantity = workflowConfig?.skuQuantities?.[sku.sku] || 0
          return (
            <div key={sku.sku} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex-1">
                <div className="font-medium text-sm">{sku.name}</div>
                <div className="text-xs text-muted-foreground">SKU: {sku.sku}</div>
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
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [allSkus, setAllSkus] = useState<any[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
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

  // Load warehouses and existing defaults
  useEffect(() => {
    loadWarehouses()
    loadWorkflowDefaults()
  }, [])

  // Load SKUs when warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      loadSkus(selectedWarehouse)
    }
  }, [selectedWarehouse])

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name')

      if (error) throw error
      setWarehouses(data || [])
      
      // Auto-select first warehouse if none selected
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id)
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadSkus = async (warehouseId: string) => {
    try {
      setIsLoadingSkus(true)
      const response = await fetch(`/api/shiphero/inventory?warehouse_id=${warehouseId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const data = await response.json()
      setAllSkus(data.products || [])
    } catch (error) {
      console.error('Error loading SKUs:', error)
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
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
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data?.workflow_defaults) {
        const defaults = data.workflow_defaults
        
        // Load saved workflow configurations
        setWorkflowConfigs(defaults)
        
        // Load selected workflows from defaults
        const savedWorkflows = Object.keys(defaults).filter(key => 
          defaults[key] && Object.keys(defaults[key]).length > 0
        )
        if (savedWorkflows.length > 0) {
          setSelectedWorkflows(savedWorkflows)
          setExpandedWorkflows(savedWorkflows)
        }
      }
    } catch (error) {
      console.error('Error loading workflow defaults:', error)
    }
  }

  const saveWorkflowDefaults = async () => {
    try {
      setIsSaving(true)
      
      const { error } = await supabase
        .from('tenant_config')
        .upsert({
          workflow_defaults: workflowConfigs,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast({
        title: "Workflow Defaults Saved",
        description: "Your workflow configurations have been saved successfully",
      })
    } catch (error: any) {
      console.error('Error saving workflow defaults:', error)
      toast({
        title: "Error",
        description: "Failed to save workflow defaults",
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
          {/* Warehouse Selection */}
          <div className="space-y-2">
            <Label htmlFor="default-warehouse">Default Warehouse (for product selection)</Label>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse to configure products" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                            selectedWarehouse={selectedWarehouse}
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
                              selectedWarehouse={selectedWarehouse}
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

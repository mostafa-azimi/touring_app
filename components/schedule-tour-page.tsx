"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Calendar, MapPin, Users, Package, Gift, Upload, Download, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkflowOption } from "@/lib/shiphero/tour-finalization-service"
// Products are managed through ShipHero inventory API

// Simple component for product selection with quantities (used by Standard Receiving and Receive to Light)
function StandardReceivingProducts({ allSkus, workflowConfig, onSkuQuantityChange, selectedWarehouse, workflowName }: {
  allSkus: any[]
  workflowConfig: any
  onSkuQuantityChange: (sku: string, quantity: number) => void
  selectedWarehouse: any
  workflowName: string
}) {
  if (allSkus.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Select a warehouse to load products</p>
      </div>
    )
  }

  // Filter products by selected warehouse and remove duplicates
  const warehouseProducts = allSkus.filter(product => {
    // Match by warehouse identifier/code - check the inventory object
    return product.inventory?.warehouse_identifier === selectedWarehouse?.code
  })

  // Remove duplicates by SKU (keep the first occurrence)
  const uniqueProducts = warehouseProducts.reduce((acc, product) => {
    if (!acc.find(p => p.sku === product.sku)) {
      acc.push(product)
    }
    return acc
  }, [])

  console.log(`🏭 ${workflowName} - Selected warehouse:`, selectedWarehouse?.code)
  console.log(`🏭 ${workflowName} - Filtered products:`, uniqueProducts.length, 'from', allSkus.length, 'total')
  
  // Debug: Log sample product data to understand the structure
  if (allSkus.length > 0) {
    console.log(`🔍 ${workflowName} - Sample product data:`, {
      firstProduct: {
        sku: allSkus[0].sku,
        inventory_warehouse_id: allSkus[0].inventory?.warehouse_id,
        inventory_warehouse_identifier: allSkus[0].inventory?.warehouse_identifier,
        inventory_warehouse_name: allSkus[0].inventory?.warehouse_name
      },
      selectedWarehouseCode: selectedWarehouse?.code,
      selectedWarehouseId: selectedWarehouse?.id,
      selectedWarehouseShipHeroId: selectedWarehouse?.shiphero_warehouse_id
    })
  }

  if (uniqueProducts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No products found for warehouse: {selectedWarehouse?.name}</p>
        <p className="text-xs mt-2">Warehouse code: {selectedWarehouse?.code}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">📦 Select products and quantities for {workflowName} at {selectedWarehouse?.name}:</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-4 border rounded-lg bg-muted/20">
        {uniqueProducts.map(product => {
          const currentQuantity = workflowConfig?.skuQuantities?.[product.sku] || 0
          // Get the correct available quantity from inventory data
          const availableQty = product.inventory?.available || product.available || 0
          
          return (
            <div key={`${product.sku}-${product.inventory?.warehouse_identifier}`} className="p-3 bg-white rounded-lg border space-y-2">
              <div className="space-y-1">
                <h4 className="font-medium text-sm leading-tight">{product.name}</h4>
                <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                <p className="text-xs text-green-600">Available: {availableQty}</p>
                <p className="text-xs text-muted-foreground">Warehouse: {product.inventory?.warehouse_identifier}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`qty-${product.sku}`} className="text-xs">Qty:</Label>
                <Input
                  id={`qty-${product.sku}`}
                  type="number"
                  min="0"
                  value={currentQuantity}
                  onChange={(e) => onSkuQuantityChange(product.sku, parseInt(e.target.value) || 0)}
                  className="w-20 h-8 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Enter quantities for products you want to include in the purchase order. Set to 0 to exclude.
      </p>
    </div>
  )
}

interface Warehouse {
  id: string
  name: string
  code?: string
  address: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface Participant {
  id: string
  first_name: string
  last_name: string
  email: string
  company: string
  title: string
}


// Generate a 6-digit numeric tour ID
function generateTourNumericId(): number {
  return Math.floor(100000 + Math.random() * 900000)
}

// Workflow options for tour finalization
const workflowOptions = [
  {
    id: "standard_receiving" as WorkflowOption,
    name: "Standard Receiving",
    description: "Creates one purchase order using your selected SKUs and quantities for receiving training",
    category: "Inbound",
    badge: "Standard"
  },
  {
    id: "receive_to_light" as WorkflowOption,
    name: "Receive to Light",
    description: "Creates one purchase order using your selected SKUs and quantities for light-guided receiving training",
    category: "Inbound",
    badge: "Attainable Automation"
  },
  {
    id: "bulk_shipping" as WorkflowOption,
    name: "Bulk Shipping",
    description: "Creates identical orders with same SKUs shipping to different customer addresses (demonstrates bulk processing efficiency)",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "single_item_batch" as WorkflowOption,
    name: "Single-Item Batch",
    description: "Creates single line-item orders with different SKUs shipping to different customer addresses (demonstrates single-item batch efficiency)",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "multi_item_batch" as WorkflowOption,
    name: "Multi-Item Batch",
    description: "Creates participant orders + additional training orders with multiple SKUs for complex batch picking training",
    category: "Fulfillment",
    badge: "Standard"
  },
  {
    id: "pack_to_light" as WorkflowOption,
    name: "Pack to Light",
    description: "Creates participant orders using selected SKUs for light-guided packing demonstrations",
    category: "Fulfillment",
    badge: "Attainable Automation"
  }
]

const categories = [
  "Inbound",
  "Fulfillment"
]

// Global render counter for debugging
let renderCount = 0

export function ScheduleTourPage() {
  renderCount++
  console.log('🔥 RENDER START: ScheduleTourPage component rendering - RENDER #', renderCount, 'at', new Date().toISOString())
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [hosts, setHosts] = useState<any[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    warehouse_id: "",
    host_id: "",
    date: "2025-11-15", // Default to mid-November for easier testing
    time: "09:00", // Default to 9:00 AM
  })
  const [newParticipant, setNewParticipant] = useState({ first_name: "", last_name: "", email: "", company: "", title: "" })
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([])
  const [workflowConfigs, setWorkflowConfigs] = useState<{[key: string]: {orderCount: number, selectedSkus: string[], skuQuantities: {[sku: string]: number}}}>({})
  const [expandedWorkflows, setExpandedWorkflows] = useState<string[]>([])
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]) // Legacy - will be replaced by workflowConfigs
  const [availableSkus, setAvailableSkus] = useState<any[]>([])
  const [allSkus, setAllSkus] = useState<any[]>([]) // Store all SKUs for filtering
  
  console.log('🔄 STATE SNAPSHOT:', {
    selectedWorkflows: selectedWorkflows.length,
    workflowConfigsKeys: Object.keys(workflowConfigs),
    expandedWorkflows: expandedWorkflows.length,
    availableSkus: availableSkus.length,
    allSkus: allSkus.length,
    warehouseId: formData.warehouse_id
  })
  
  // Add debugging to track what's changing
  console.log('🔍 DETAILED STATE:', {
    selectedWorkflows: JSON.stringify(selectedWorkflows),
    workflowConfigs: JSON.stringify(workflowConfigs),
    expandedWorkflows: JSON.stringify(expandedWorkflows)
  })
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleWorkflowChange = useCallback((optionId: string, checked: boolean) => {
    console.log('🎯 WORKFLOW CHANGE:', { optionId, checked, timestamp: Date.now() })
    
    if (checked) {
      console.log('✅ Adding workflow:', optionId)
      setSelectedWorkflows(prev => {
        console.log('📝 setSelectedWorkflows: adding', optionId, 'to', prev)
        return [...prev, optionId]
      })
      // Initialize workflow config with defaults
      setWorkflowConfigs(prev => {
        console.log('📝 setWorkflowConfigs: adding config for', optionId)
        return {
          ...prev,
          [optionId]: {
            orderCount: 5, // Default to 5 orders
            selectedSkus: [],
            skuQuantities: {} // For Standard Receiving quantities
          }
        }
      })
      // Auto-expand the workflow section
      setExpandedWorkflows(prev => {
        console.log('📝 setExpandedWorkflows: adding', optionId, 'to', prev)
        return [...prev, optionId]
      })
    } else {
      console.log('❌ Removing workflow:', optionId)
      setSelectedWorkflows(prev => {
        console.log('📝 setSelectedWorkflows: removing', optionId, 'from', prev)
        return prev.filter(id => id !== optionId)
      })
      // Remove workflow config
      setWorkflowConfigs(prev => {
        console.log('📝 setWorkflowConfigs: removing config for', optionId)
        const newConfigs = { ...prev }
        delete newConfigs[optionId]
        return newConfigs
      })
      // Collapse the workflow section
      setExpandedWorkflows(prev => {
        console.log('📝 setExpandedWorkflows: removing', optionId, 'from', prev)
        return prev.filter(id => id !== optionId)
      })
    }
  }, [])

  const toggleWorkflowExpansion = (workflowId: string) => {
    setExpandedWorkflows(prev => 
      prev.includes(workflowId) 
        ? prev.filter(id => id !== workflowId)
        : [...prev, workflowId]
    )
  }

  const updateWorkflowOrderCount = (workflowId: string, count: number) => {
    setWorkflowConfigs(prev => ({
      ...prev,
      [workflowId]: {
        ...prev[workflowId],
        orderCount: count
      }
    }))
  }

  const handleWorkflowSkuChange = (workflowId: string, sku: string, checked: boolean) => {
    setWorkflowConfigs(prev => ({
      ...prev,
      [workflowId]: {
        orderCount: prev[workflowId]?.orderCount || 5,
        selectedSkus: checked 
          ? [...(prev[workflowId]?.selectedSkus || []), sku]
          : (prev[workflowId]?.selectedSkus || []).filter(s => s !== sku)
      }
    }))
  }

  const handleSkuChange = (sku: string, checked: boolean) => {
    if (checked) {
      setSelectedSkus(prev => [...prev, sku])
    } else {
      setSelectedSkus(prev => prev.filter(s => s !== sku))
    }
  }

  // Filter SKUs by selected warehouse
  const filterSkusByWarehouse = (warehouseId: string) => {
    console.log('🏭 FILTER SKUs START:', { warehouseId, allSkusLength: allSkus.length, timestamp: Date.now() })
    
    if (!warehouseId || !allSkus.length) {
      console.log('🚫 Early return: no warehouse or no SKUs')
      setAvailableSkus([])
      return
    }

    // Find the selected warehouse to get its ShipHero ID
    const selectedWarehouse = warehouses.find(w => w.id === warehouseId)
    if (!selectedWarehouse) {
      console.log('🚫 Early return: warehouse not found')
      setAvailableSkus([])
      return
    }

    // Filter SKUs that belong to this warehouse
    const filteredSkus = allSkus.filter(product => {
      // Check if product has inventory for this specific warehouse
      return product.inventory?.warehouse_id === selectedWarehouse.shiphero_warehouse_id
    })

    console.log('🏭 Filtering SKUs by warehouse:', {
      warehouseId,
      warehouseName: selectedWarehouse.name,
      shipHeroWarehouseId: selectedWarehouse.shiphero_warehouse_id,
      totalSkus: allSkus.length,
      filteredSkus: filteredSkus.length,
      sampleFiltered: filteredSkus.slice(0, 3).map(p => ({ sku: p.sku, available: p.inventory?.available }))
    })

    console.log('📝 setAvailableSkus: setting', filteredSkus.length, 'filtered SKUs')
    setAvailableSkus(filteredSkus)
    console.log('🏭 FILTER SKUs END:', { timestamp: Date.now() })
  }

  const loadAvailableSkus = async () => {
    setIsLoadingSkus(true)
    try {
      // Use centralized data service for better caching and performance
      const { shipHeroDataService } = await import('@/lib/shiphero/data-service')
      const activeProducts = await shipHeroDataService.getActiveProducts()
      
      // Sort alphabetically by SKU
      const sortedProducts = activeProducts.sort((a, b) => a.sku.localeCompare(b.sku))
      
      // Store all SKUs for filtering
      setAllSkus(sortedProducts)
      // Initially show no SKUs until a warehouse is selected
      setAvailableSkus([])
      console.log(`✅ Loaded ${sortedProducts.length} active SKUs for tour selection (cached: ${sortedProducts.length > 0})`)
      
      // If warehouse is already selected, filter immediately
      if (formData.warehouse_id) {
        filterSkusByWarehouse(formData.warehouse_id)
      }
    } catch (error: any) {
      console.error('Failed to load SKUs:', error)
      toast({
        title: "Failed to Load SKUs",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoadingSkus(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
    fetchHosts()
    // Auto-load SKUs when component mounts for better UX
    loadAvailableSkus()
  }, [])

  const fetchWarehouses = async () => {
    try {
      console.log('🏢 Loading warehouses from REMOTE database...')
      
      // First, load existing warehouses from remote database
      const { data: existingWarehouses, error: dbError } = await supabase
        .from('warehouses')
        .select('id, name, code, address, address2, city, state, zip, country, shiphero_warehouse_id')
        .order('name')
      
      if (dbError) {
        console.error('❌ Error fetching warehouses from remote database:', dbError)
        throw new Error('Failed to fetch warehouses from remote database')
      }
      
      console.log(`📊 Found ${existingWarehouses?.length || 0} existing warehouses in remote database`)
      
      // If we have existing warehouses, use them but also check for updates from ShipHero
      if (existingWarehouses && existingWarehouses.length > 0) {
        console.log('✅ Found existing warehouses, setting them first')
        console.log('🔍 First warehouse:', existingWarehouses[0])
        setWarehouses(existingWarehouses)
        
        // Continue to check ShipHero for any new warehouses (don't return early)
        console.log('🔄 Also checking ShipHero for any new warehouses...')
      }
      
      // Sync from ShipHero (either for first time or to check for updates)
      const hasExistingWarehouses = existingWarehouses && existingWarehouses.length > 0
      console.log(hasExistingWarehouses ? '🔄 Checking ShipHero for new warehouses...' : '🔄 No warehouses found in remote database, syncing from ShipHero...')
      
      const { tokenManager } = await import('@/lib/shiphero/token-manager')
      const accessToken = await tokenManager.getValidAccessToken()
      
      if (!accessToken) {
        console.error('❌ No ShipHero access token available')
        if (!hasExistingWarehouses) {
          toast({
            title: "Error",
            description: "No ShipHero access token found. Please generate one in Settings.",
            variant: "destructive",
          })
          setWarehouses([])
        }
        return
      }
      
      const response = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('❌ Failed to fetch warehouses from ShipHero')
        throw new Error('Failed to fetch warehouses from ShipHero')
      }

      const result = await response.json()
      const shipHeroWarehouses = result.data?.account?.data?.warehouses || []
      
      if (shipHeroWarehouses.length === 0) {
        console.log('⚠️ No warehouses found in ShipHero')
        if (!hasExistingWarehouses) {
          setWarehouses([])
        }
        return
      }
      
      console.log(`📦 Found ${shipHeroWarehouses.length} warehouses in ShipHero`)
      
      // Check which warehouses are new (not in local database)
      const existingShipHeroIds = new Set(existingWarehouses?.map(w => w.shiphero_warehouse_id) || [])
      const newWarehouses = shipHeroWarehouses.filter(warehouse => !existingShipHeroIds.has(warehouse.id))
      
      if (newWarehouses.length > 0) {
        console.log(`🆕 Found ${newWarehouses.length} new warehouses to add to remote database...`)
        
        const warehousesToCreate = newWarehouses.map(warehouse => ({
          name: warehouse.address?.name || warehouse.identifier,
          code: warehouse.identifier || '',
          address: warehouse.address?.address1 || '',
          address2: warehouse.address?.address2 || '',
          city: warehouse.address?.city || '',
          state: warehouse.address?.state || '',
          zip: warehouse.address?.zip || '',
          country: warehouse.address?.country || 'US',
          shiphero_warehouse_id: warehouse.id
        }))
        
        const { data: createdWarehouses, error: createError } = await supabase
          .from('warehouses')
          .insert(warehousesToCreate)
          .select('id, name, code, address, address2, city, state, zip, country, shiphero_warehouse_id')
        
        if (createError) {
          console.error('❌ Error creating new warehouses in remote database:', createError)
          console.log('❌ Create error details:', createError)
          // Don't throw error, just log it - we still have existing warehouses
        } else {
          console.log(`✅ Created ${createdWarehouses?.length || 0} new warehouses in remote database`)
          
          // Merge existing and new warehouses
          const allWarehouses = [...(existingWarehouses || []), ...(createdWarehouses || [])]
          setWarehouses(allWarehouses)
          
          toast({
            title: "Warehouses Updated",
            description: `Added ${createdWarehouses?.length || 0} new warehouses from ShipHero`,
            variant: "default",
          })
        }
      } else {
        console.log('✅ All ShipHero warehouses already exist in remote database')
        if (hasExistingWarehouses) {
          // Warehouses already set above, no need to update
        } else {
          setWarehouses(existingWarehouses || [])
        }
      }
      
    } catch (error) {
      console.error("❌ Error in fetchWarehouses:", error)
      toast({
        title: "Error",
        description: `Failed to load warehouses: ${error.message}`,
        variant: "destructive",
      })
      setWarehouses([])
    }
  }

  const fetchHosts = async () => {
    try {
      const { data, error } = await supabase.from("team_members").select("id, first_name, last_name, email").order("first_name")

      if (error) throw error
      setHosts(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch hosts",
        variant: "destructive",
      })
    }
  }

  const addParticipant = () => {
    if (!newParticipant.first_name.trim() || !newParticipant.last_name.trim() || !newParticipant.email.trim()) {
      toast({
        title: "Error",
        description: "Please enter first name, last name, and email for the participant",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate emails
    if (participants.some((p) => p.email.toLowerCase() === newParticipant.email.toLowerCase())) {
      toast({
        title: "Error",
        description: "A participant with this email already exists",
        variant: "destructive",
      })
      return
    }

    const participant: Participant = {
      id: crypto.randomUUID(),
      first_name: newParticipant.first_name.trim(),
      last_name: newParticipant.last_name.trim(),
      email: newParticipant.email.trim().toLowerCase(),
      company: newParticipant.company.trim(),
      title: newParticipant.title.trim(),
    }

    setParticipants([...participants, participant])
    setNewParticipant({ first_name: "", last_name: "", email: "", company: "", title: "" })
  }

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.warehouse_id || !formData.host_id || !formData.date || !formData.time) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Allow tours without participants for testing
    if (participants.length === 0) {
      console.log('⚠️ Creating tour without participants (testing mode)')
    }

    setIsLoading(true)

    try {
      // Debug: Log the data being sent
      // Aggregate all SKUs from all workflows for backward compatibility
      const allSelectedSkus = Array.from(new Set(
        Object.values(workflowConfigs).flatMap(config => config.selectedSkus)
      ))

      const tourInsertData = {
        warehouse_id: formData.warehouse_id,
        host_id: formData.host_id,
        date: formData.date,
        time: formData.time,
        status: 'scheduled',
        tour_numeric_id: generateTourNumericId(),
        selected_workflows: selectedWorkflows,
        selected_skus: allSelectedSkus, // Aggregated SKUs from all workflows
        workflow_configs: workflowConfigs, // New detailed configuration
      }
      
      console.log('🔍 Tour creation data:', tourInsertData)
      console.log('🏢 Warehouse ID format:', typeof formData.warehouse_id, formData.warehouse_id)
      console.log('👤 Host ID format:', typeof formData.host_id, formData.host_id)
      console.log('🎯 Selected workflows:', selectedWorkflows)
      console.log('📦 Selected SKUs:', selectedSkus)
      
      // DETAILED DEBUGGING - Show exactly what's being sent
      console.log('🚨 DETAILED DEBUG - Raw form data:')
      console.log('  warehouse_id:', JSON.stringify(formData.warehouse_id))
      console.log('  host_id:', JSON.stringify(formData.host_id))
      console.log('  selected_workflows type:', typeof selectedWorkflows, Array.isArray(selectedWorkflows))
      console.log('  selected_skus type:', typeof selectedSkus, Array.isArray(selectedSkus))
      console.log('🚨 DETAILED DEBUG - Payload being sent to Supabase:')
      console.log(JSON.stringify(tourInsertData, null, 2))

      // Validate data before sending
      if (!formData.warehouse_id) {
        throw new Error('Warehouse ID is required')
      }
      if (!formData.host_id) {
        throw new Error('Host ID is required')
      }
      if (!formData.date) {
        throw new Error('Date is required')
      }
      if (!formData.time) {
        throw new Error('Time is required')
      }

      // Check if warehouse_id looks like a UUID (should be if from our database)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(formData.warehouse_id)) {
        console.error('❌ Invalid warehouse ID format:', formData.warehouse_id)
        throw new Error(`Invalid warehouse ID format: ${formData.warehouse_id}. Expected UUID format.`)
      }
      if (!uuidRegex.test(formData.host_id)) {
        console.error('❌ Invalid host ID format:', formData.host_id)
        throw new Error(`Invalid host ID format: ${formData.host_id}. Expected UUID format.`)
      }

      console.log('✅ Data validation passed, creating tour...')

      // Optimized: Create tour and get related data in one query with joins
      const { data: tourData, error: tourError } = await supabase
        .from("tours")
        .insert([tourInsertData])
        .select(`
          *,
          warehouse:warehouses(id, name, address, city, state, zip, country),
          host:team_members(id, first_name, last_name, email)
        `)
        .single()

      if (tourError) {
        console.error('🚨 Supabase tour creation error:', tourError)
        console.error('🚨 Error details:', JSON.stringify(tourError, null, 2))
        throw tourError
      }

      // Add participants in batch for better performance
      let insertedParticipants = null
      if (participants.length > 0) {
        const participantInserts = participants.map((participant) => ({
          tour_id: tourData.id,
          name: `${participant.first_name} ${participant.last_name}`, // Keep name field for backward compatibility
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          company: participant.company,
          title: participant.title,
        }))

        const { data: participantData, error: participantError } = await supabase
          .from("tour_participants")
          .insert(participantInserts)
          .select("id, first_name, last_name, email, company, title")

        if (participantError) throw participantError
        insertedParticipants = participantData
      }

      toast({
        title: "Success",
        description: `Tour scheduled successfully with ${participants.length} participant${participants.length > 1 ? "s" : ""}!`,
      })

            // Reset form
      setFormData({ warehouse_id: "", host_id: "", date: "2025-11-15", time: "09:00" })
      setParticipants([])
      setSelectedWorkflows([])
      setSelectedSkus([])
    } catch (error: any) {
      console.error('Tour creation error:', error)
      toast({
        title: "Error",
        description: `Failed to schedule tour: ${error.message || error.toString()}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedWarehouse = useMemo(() => {
    console.log('🏗️ MEMO: selectedWarehouse recalculating', { warehouseId: formData.warehouse_id, warehousesLength: warehouses.length })
    const result = warehouses.find((w) => w.id === formData.warehouse_id)
    console.log('🏗️ MEMO: selectedWarehouse result', result ? result.name : 'not found')
    return result
  }, [warehouses, formData.warehouse_id])

  // Memoize category options to prevent re-renders
  const getCategoryOptions = useMemo(() => {
    console.log('🏗️ MEMO: getCategoryOptions recalculating')
    const categoryMap = new Map()
    categories.forEach(category => {
      const result = workflowOptions.filter(option => option.category === category)
      categoryMap.set(category, result)
      console.log('🏗️ MEMO: categoryOptions for', category, ':', result.length, 'options')
    })
    return categoryMap
  }, []) // workflowOptions and categories are static constants

  // Memoize workflow SKUs to prevent infinite re-renders
  const workflowSkusMap = useMemo(() => {
    console.log('🏗️ MEMO: workflowSkusMap recalculating - availableSkus length:', availableSkus.length)
    const skuMap = new Map()
    selectedWorkflows.forEach(workflowId => {
      skuMap.set(workflowId, availableSkus.map((product, index) => {
        if (index === 0) console.log('🎨 MEMOIZING WORKFLOW SKUs for', workflowId, '- total:', availableSkus.length)
        return (
          <div
            key={product.sku}
            className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
              (workflowConfigs[workflowId]?.selectedSkus || []).includes(product.sku)
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
            onClick={() => handleWorkflowSkuChange(workflowId, product.sku, !(workflowConfigs[workflowId]?.selectedSkus || []).includes(product.sku))}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm leading-tight truncate">
                  {product.name}
                </h4>
                <Checkbox
                  checked={(workflowConfigs[workflowId]?.selectedSkus || []).includes(product.sku)}
                  onChange={() => {}} // Handled by parent click
                  className="pointer-events-none"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {product.sku}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Qty: {product.quantity_available || 0}
                </span>
              </div>
            </div>
          </div>
        )
      }))
    })
    return skuMap
  }, [availableSkus, selectedWorkflows, workflowConfigs])

  // Memoize main product grid to prevent infinite re-renders  
  const productGrid = useMemo(() => {
    console.log('🏗️ MEMO: productGrid recalculating - availableSkus length:', availableSkus.length)
    return availableSkus.map(product => (
      <div 
        key={product.sku} 
        className={`
          relative flex items-start space-x-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer
          ${selectedSkus.includes(product.sku)
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-border bg-card hover:bg-muted/50'
          }
        `}
        onClick={() => handleSkuChange(product.sku, !selectedSkus.includes(product.sku))}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            id={product.sku}
            checked={selectedSkus.includes(product.sku)}
            onCheckedChange={(checked) => handleSkuChange(product.sku, checked as boolean)}
            className="mt-1"
          />
        </div>
        <div className="flex-1 min-w-0">
          <Label
            htmlFor={product.sku}
            className="font-semibold text-sm block text-slate-800 mb-1 pointer-events-none"
          >
            {product.name}
          </Label>
          <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">
            {product.sku}
          </p>
          <div className="flex items-center">
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              (product.inventory?.available || 0) > 0
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {product.inventory?.available || 0} available
            </span>
          </div>
        </div>
      </div>
    ))
  }, [availableSkus, selectedSkus])

  // CSV Upload functionality
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      })
      return
    }

    setIsUploadingCSV(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      // Validate headers
      const requiredHeaders = ['warehouse_name', 'host_first_name', 'host_last_name', 'tour_date', 'tour_time', 'participant_first_name', 'participant_last_name', 'participant_email']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      
      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV Format",
          description: `Missing required columns: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        })
        return
      }

      // Group rows by tour (warehouse + host + date + time)
      const tourGroups = new Map()
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length < headers.length) continue

        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })

        const tourKey = `${row.warehouse_name}-${row.host_first_name}-${row.host_last_name}-${row.tour_date}-${row.tour_time}`
        
        if (!tourGroups.has(tourKey)) {
          tourGroups.set(tourKey, {
            warehouse_name: row.warehouse_name,
            host_first_name: row.host_first_name,
            host_last_name: row.host_last_name,
            tour_date: row.tour_date,
            tour_time: row.tour_time,
            participants: []
          })
        }

        tourGroups.get(tourKey).participants.push({
          first_name: row.participant_first_name,
          last_name: row.participant_last_name,
          email: row.participant_email,
          company: row.participant_company || '',
          title: row.participant_title || ''
        })
      }

      // Create tours
      let toursCreated = 0
      for (const [, tourData] of tourGroups) {
        try {
          // Find warehouse by name
          const warehouse = warehouses.find(w => w.name === tourData.warehouse_name)
          if (!warehouse) {
            console.warn(`Warehouse not found: ${tourData.warehouse_name}`)
            continue
          }

          // Find host by name
          const host = hosts.find(h => 
            h.first_name === tourData.host_first_name && 
            h.last_name === tourData.host_last_name
          )
          if (!host) {
            console.warn(`Host not found: ${tourData.host_first_name} ${tourData.host_last_name}`)
            continue
          }

          // Aggregate all SKUs from all workflows for backward compatibility
          const allSelectedSkus = Array.from(new Set(
            Object.values(workflowConfigs).flatMap(config => config.selectedSkus)
          ))

          // Create tour
          const { data: tourResult, error: tourError } = await supabase
            .from("tours")
            .insert([{
              warehouse_id: warehouse.id,
              host_id: host.id,
              date: tourData.tour_date,
              time: tourData.tour_time,
              status: 'scheduled',
              tour_numeric_id: generateTourNumericId(),
              selected_workflows: selectedWorkflows,
              selected_skus: allSelectedSkus,
              workflow_configs: workflowConfigs
            }])
            .select()
            .single()

          if (tourError) throw tourError

          // Add participants
          const participantInserts = tourData.participants.map((p: any) => ({
            tour_id: tourResult.id,
            name: `${p.first_name} ${p.last_name}`,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            company: p.company,
            title: p.title
          }))

          const { error: participantError } = await supabase
            .from("tour_participants")
            .insert(participantInserts)

          if (participantError) throw participantError

          toursCreated++
        } catch (error) {
          console.error('Error creating tour:', error)
        }
      }

      toast({
        title: "CSV Upload Successful",
        description: `Created ${toursCreated} tours from CSV file`,
      })

      // Reset form
      setFormData({ warehouse_id: "", host_id: "", date: "2025-11-15", time: "09:00" })
      setParticipants([])

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process CSV file",
        variant: "destructive",
      })
    } finally {
      setIsUploadingCSV(false)
      // Reset file input
      event.target.value = ''
    }
  }

  // Download CSV template
  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/tour-upload-template.csv'
    link.download = 'tour-upload-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ShipHero-style page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-600" />
          Schedule a New Tour
        </h1>
        <p className="text-slate-600">Create a new warehouse tour and configure training workflows and products for realistic demonstrations.</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-800">Tour Configuration</CardTitle>
          <CardDescription className="text-slate-600">
            Fill out the tour details, select training workflows, and choose products for demonstrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tour Details Section - 2x2 Grid Layout */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="warehouse">Warehouse *</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, warehouse_id: value })
                    setSelectedSkus([]) // Clear selected SKUs when warehouse changes
                    filterSkusByWarehouse(value) // Filter SKUs by selected warehouse
                  }}
                >
                  <SelectTrigger id="warehouse" className="cursor-pointer">
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id} className="cursor-pointer">
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWarehouse && (
                  <div className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedWarehouse.city && selectedWarehouse.state 
                        ? `${selectedWarehouse.address}, ${selectedWarehouse.city}, ${selectedWarehouse.state} ${selectedWarehouse.zip || ''}`.trim()
                        : selectedWarehouse.address
                      }
                    </p>
                    {selectedWarehouse.code && (
                      <p className="text-xs">Code: {selectedWarehouse.code}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="host">Host *</Label>
                <Select
                  value={formData.host_id}
                  onValueChange={(value) => setFormData({ ...formData, host_id: value })}
                >
                  <SelectTrigger id="host" className="cursor-pointer">
                    <SelectValue placeholder="Select tour host" />
                  </SelectTrigger>
                  <SelectContent>
                    {hosts.map((host) => (
                      <SelectItem key={host.id} value={host.id} className="cursor-pointer">
                        {host.first_name} {host.last_name} ({host.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="cursor-pointer h-9 w-fit max-w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                  className="cursor-pointer h-9 w-fit max-w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"
                  style={{ colorScheme: 'light' }}
                />
                {formData.time && (
                  <p className="text-sm text-muted-foreground">
                    Selected time: {(() => {
                      const [hour24, minute] = formData.time.split(':')
                      const hour12 = parseInt(hour24) % 12 || 12
                      const period = parseInt(hour24) >= 12 ? 'PM' : 'AM'
                      return `${hour12}:${minute} ${period}`
                    })()}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Participants Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Participants</h3>
                <span className="text-sm text-muted-foreground">({participants.length} added)</span>
              </div>

              {/* Add Participant Form */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="participant-first-name">First Name</Label>
                        <Input
                          id="participant-first-name"
                          value={newParticipant.first_name}
                          onChange={(e) => setNewParticipant({ ...newParticipant, first_name: e.target.value })}
                          placeholder="John"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="participant-last-name">Last Name</Label>
                        <Input
                          id="participant-last-name"
                          value={newParticipant.last_name}
                          onChange={(e) => setNewParticipant({ ...newParticipant, last_name: e.target.value })}
                          placeholder="Smith"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="participant-email">Email</Label>
                        <Input
                          id="participant-email"
                          type="email"
                          value={newParticipant.email}
                          onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                          placeholder="john.smith@company.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="participant-company">Company</Label>
                        <Input
                          id="participant-company"
                          value={newParticipant.company}
                          onChange={(e) => setNewParticipant({ ...newParticipant, company: e.target.value })}
                          placeholder="ACME Corp"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="participant-title">Title</Label>
                        <Input
                          id="participant-title"
                          value={newParticipant.title}
                          onChange={(e) => setNewParticipant({ ...newParticipant, title: e.target.value })}
                          placeholder="Software Engineer"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={addParticipant} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Participant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participants List */}
              {participants.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tour Participants</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="grid gap-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{participant.first_name} {participant.last_name}</p>
                              {participant.title && (
                                <span className="text-sm text-muted-foreground">- {participant.title}</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{participant.email}</p>
                            {participant.company && (
                              <p className="text-sm text-muted-foreground">{participant.company}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeParticipant(participant.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {participants.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No participants added yet</p>
                  <p className="text-sm">Add participants using the form above</p>
                </div>
              )}
            </div>



            <Separator />

            {/* Workflow Selection Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Training Workflows</h3>
                <span className="text-sm text-muted-foreground">({selectedWorkflows.length} selected)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Select the training workflows to create when finalizing this tour. These will generate specific orders in ShipHero for different training scenarios.
              </p>

              <div className="space-y-6">
                {categories.map(category => {
                  console.log('🏗️ CATEGORY RENDER:', category, 'at', Date.now())
                  const categoryOptions = getCategoryOptions.get(category) || []
                  
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{category}</h4>
                        <Separator className="flex-1" />
                      </div>
                      
                      <div className="space-y-3">
                        {categoryOptions.map(option => (
                          <div key={option.id} className="space-y-3">
                            {/* Workflow Selection Row */}
                            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                              <Checkbox
                                id={option.id}
                                checked={selectedWorkflows.includes(option.id)}
                                onCheckedChange={(checked) => handleWorkflowChange(option.id, checked as boolean)}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={option.id} className="font-medium cursor-pointer">
                                    {option.name}
                                  </Label>
                                  <Badge variant={option.badge === "Original" ? "default" : "secondary"} className="text-xs">
                                    {option.badge}
                                  </Badge>
                                  {selectedWorkflows.includes(option.id) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleWorkflowExpansion(option.id)}
                                      className="ml-auto h-6 px-2"
                                    >
                                      {expandedWorkflows.includes(option.id) ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {option.description}
                                </p>
                              </div>
                            </div>

                            {/* Expandable Configuration Section */}
                            {selectedWorkflows.includes(option.id) && expandedWorkflows.includes(option.id) && (
                              <div className="ml-6 p-4 bg-muted/30 rounded-lg border space-y-4">
                                {/* Order Count Input - Only for fulfillment workflows */}
                                {!['standard_receiving', 'receive_to_light'].includes(option.id) && (
                                  <div className="flex items-center gap-4">
                                    <Label htmlFor={`${option.id}-count`} className="text-sm font-medium">
                                      📦 Orders to Create:
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

                                {/* Simple Product Selection for Standard Receiving and Receive to Light */}
                                {(option.id === 'standard_receiving' || option.id === 'receive_to_light') ? (
                                  <StandardReceivingProducts 
                                    allSkus={allSkus}
                                    workflowConfig={workflowConfigs[option.id]}
                                    selectedWarehouse={selectedWarehouse}
                                    workflowName={option.name}
                                    onSkuQuantityChange={(sku, quantity) => {
                                      setWorkflowConfigs(prev => ({
                                        ...prev,
                                        [option.id]: {
                                          ...prev[option.id],
                                          selectedSkus: quantity > 0 
                                            ? [...(prev[option.id]?.selectedSkus?.filter(s => s !== sku) || []), sku]
                                            : prev[option.id]?.selectedSkus?.filter(s => s !== sku) || [],
                                          skuQuantities: {
                                            ...prev[option.id]?.skuQuantities,
                                            [sku]: quantity
                                          }
                                        }
                                      }))
                                    }}
                                  />
                                ) : (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">🏷️ SKUs for this workflow:</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
                                      {workflowSkusMap.get(option.id) || []}
                                    </div>
                                    {availableSkus.length === 0 && (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Select a warehouse to load available SKUs
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* SKU Selection Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Product SKUs</h3>
                  <span className="text-sm text-muted-foreground">({selectedSkus.length} selected)</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadAvailableSkus}
                  disabled={isLoadingSkus}
                >
                  {isLoadingSkus ? "Loading..." : "Refresh SKUs"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Select the specific SKUs to use for this tour. These will be used to create realistic orders instead of placeholder items.
              </p>

              {isLoadingSkus && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                  <p>Loading available SKUs from ShipHero...</p>
                </div>
              )}

              {availableSkus.length > 0 && !isLoadingSkus && (
                <div className="space-y-4">
                  {/* ShipHero-style header with counts */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                                      <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-slate-700">
                      {availableSkus.length} Active Products
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedSkus.length} Selected
                    </div>
                  </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSkus([])}
                        className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* ShipHero-style product grid - no max height, no scrolling */}
                  {!formData.warehouse_id ? (
                    <div className="text-sm text-muted-foreground p-8 border rounded-lg bg-slate-50 text-center">
                      👆 Select a warehouse first to see available products for this tour
                    </div>
                  ) : availableSkus.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-8 border rounded-lg bg-slate-50 text-center">
                      {isLoadingSkus ? "Loading products..." : "No active products found for the selected warehouse"}
                    </div>
                  ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {availableSkus.map(product => (
                      <div 
                        key={product.sku} 
                        className={`
                          relative flex items-start space-x-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer
                          ${selectedSkus.includes(product.sku) 
                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-25'
                          }
                        `}
                        onClick={() => handleSkuChange(product.sku, !selectedSkus.includes(product.sku))}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            id={product.sku}
                            checked={selectedSkus.includes(product.sku)}
                            onCheckedChange={(checked) => handleSkuChange(product.sku, checked as boolean)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={product.sku} 
                            className="font-semibold text-sm block text-slate-800 mb-1 pointer-events-none"
                          >
                            {product.sku}
                          </Label>
                          <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">
                            {product.name}
                          </p>
                          <div className="flex items-center">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              (product.inventory?.available || 0) > 0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {product.inventory?.available || 0} available
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isLoading} 
                size="lg"
                className={isLoading ? "cursor-wait" : ""}
              >
                {isLoading ? "Scheduling..." : "Schedule Tour"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* CSV Bulk Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </CardTitle>
          <CardDescription>Upload multiple tours at once using CSV format</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={isUploadingCSV}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isUploadingCSV}
                  className={isUploadingCSV ? "cursor-wait" : ""}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isUploadingCSV ? "Uploading..." : "Upload CSV"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to create multiple tours at once. Download the template to see the required format and structure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Calendar, MapPin, Users, Package, Gift, Upload, Download, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkflowOption } from "@/lib/shiphero/tour-finalization-service"
// Removed swag allocation imports - swag items will be added manually, not allocated automatically

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

interface SwagPreview {
  name: string
  totalAvailable: number
  itemsPerParticipant: number
  participantsGettingExtra: number
  totalToAllocate: number
}

// Generate a 6-digit numeric tour ID
function generateTourNumericId(): number {
  return Math.floor(100000 + Math.random() * 900000)
}

// Workflow options for tour finalization
const workflowOptions = [
  {
    id: "receive_to_light" as WorkflowOption,
    name: "Receive to Light",
    description: "Creates sales orders for participants + aggregated purchase order (receive to light workflow)",
    category: "As-Is Workflows",
    badge: "Original"
  },
  {
    id: "pack_to_light" as WorkflowOption,
    name: "Pack to Light",
    description: "Creates sales orders for participants + aggregated purchase order (pack to light workflow)",
    category: "As-Is Workflows",
    badge: "Original"
  },
  {
    id: "standard_receiving" as WorkflowOption,
    name: "Standard Receiving",
    description: "Creates a dedicated purchase order with 6 specific SKUs for receiving workflow training",
    category: "Purchase Orders",
    badge: "Training"
  },
  {
    id: "bulk_shipping" as WorkflowOption,
    name: "Bulk Shipping",
    description: "Creates 10 sales orders with same SKU but different addresses for bulk shipping training",
    category: "Sales Orders",
    badge: "Training"
  },
  {
    id: "single_item_batch" as WorkflowOption,
    name: "Single-Item Batch",
    description: "Creates 5 single-item orders for batch picking training (SKUs can repeat)",
    category: "Sales Orders",
    badge: "Training"
  },
  {
    id: "multi_item_batch" as WorkflowOption,
    name: "Multi-Item Batch",
    description: "Creates 5 multi-item orders for complex batch picking training",
    category: "Sales Orders",
    badge: "Training"
  }
]

const categories = [
  "As-Is Workflows",
  "Purchase Orders", 
  "Sales Orders"
]

export function ScheduleTourPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [hosts, setHosts] = useState<any[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [swagPreview, setSwagPreview] = useState<SwagPreview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    warehouse_id: "",
    host_id: "",
    date: "",
    time: "",
  })
  const [newParticipant, setNewParticipant] = useState({ first_name: "", last_name: "", email: "", company: "", title: "" })
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)
  const [selectedWorkflows, setSelectedWorkflows] = useState<WorkflowOption[]>([])
  const [selectedSkus, setSelectedSkus] = useState<string[]>([])
  const [availableSkus, setAvailableSkus] = useState<any[]>([])
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleWorkflowChange = (optionId: WorkflowOption, checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(prev => [...prev, optionId])
    } else {
      setSelectedWorkflows(prev => prev.filter(id => id !== optionId))
    }
  }

  const handleSkuChange = (sku: string, checked: boolean) => {
    if (checked) {
      setSelectedSkus(prev => [...prev, sku])
    } else {
      setSelectedSkus(prev => prev.filter(s => s !== sku))
    }
  }

  const loadAvailableSkus = async () => {
    setIsLoadingSkus(true)
    try {
      const accessToken = localStorage.getItem('shiphero_access_token')
      if (!accessToken) {
        toast({
          title: "Access Token Required",
          description: "Please generate a ShipHero access token in Settings to load SKUs.",
          variant: "destructive",
        })
        return
      }

      const response = await fetch('/api/shiphero/inventory', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const result = await response.json()
      
      if (result.success && result.products) {
        // Filter products with available inventory and sort by availability
        const availableProducts = result.products
          .filter((product: any) => product.inventory?.available > 0)
          .sort((a: any, b: any) => b.inventory.available - a.inventory.available)
        
        setAvailableSkus(availableProducts)
        console.log(`Loaded ${availableProducts.length} available SKUs`)
      } else {
        throw new Error('Invalid response format')
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
  }, [])

  const fetchWarehouses = async () => {
    try {
      // First try to load from ShipHero if access token exists
      const accessToken = localStorage.getItem('shiphero_access_token')
      
      if (accessToken) {
        console.log('Loading warehouses from ShipHero...')
        const response = await fetch('/api/shiphero/warehouses', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const result = await response.json()
          const shipHeroWarehouses = result.data?.account?.data?.warehouses || []
          
          // Transform ShipHero warehouses to match expected format
          const transformedWarehouses = shipHeroWarehouses.map((warehouse: any) => ({
            id: warehouse.id,
            name: warehouse.address?.name || warehouse.identifier,
            code: warehouse.identifier || '',
            address: warehouse.address?.address1 || '',
            address2: warehouse.address?.address2 || '',
            city: warehouse.address?.city || '',
            state: warehouse.address?.state || '',
            zip: warehouse.address?.zip || '',
            country: warehouse.address?.country || 'US',
            shiphero_warehouse_id: warehouse.id,
            // Store full address object for later use
            full_address: warehouse.address
          }))
          
          setWarehouses(transformedWarehouses)
          console.log(`✅ Loaded ${transformedWarehouses.length} warehouses from ShipHero:`, transformedWarehouses.map(w => w.name))
          return
        }
      }
      
      // Fallback to Supabase warehouses if ShipHero fails or no token
      console.log('Loading warehouses from Supabase (fallback)...')
      const { data, error } = await supabase.from("warehouses").select("id, name, code, address, address2, city, state, zip, country").order("name")
      if (error) throw error
      setWarehouses(data || [])
      
    } catch (error) {
      console.error("Error fetching warehouses:", error)
      toast({
        title: "Error",
        description: "Failed to load warehouses. Please check your ShipHero connection or try again.",
        variant: "destructive",
      })
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

    if (participants.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one participant",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Create the tour
      const { data: tourData, error: tourError } = await supabase
        .from("tours")
        .insert([
          {
            warehouse_id: formData.warehouse_id,
            host_id: formData.host_id,
            date: formData.date,
            time: formData.time,
            status: 'scheduled',
            tour_numeric_id: generateTourNumericId(),
            selected_workflows: selectedWorkflows,
            selected_skus: selectedSkus,
          },
        ])
        .select()
        .single()

      if (tourError) throw tourError

      // Add participants - no need to parse names anymore
      const participantInserts = participants.map((participant) => ({
        tour_id: tourData.id,
        name: `${participant.first_name} ${participant.last_name}`, // Keep name field for backward compatibility
        first_name: participant.first_name,
        last_name: participant.last_name,
        email: participant.email,
        company: participant.company,
        title: participant.title,
      }))

      const { data: insertedParticipants, error: participantError } = await supabase
        .from("tour_participants")
        .insert(participantInserts)
        .select("id")

      if (participantError) throw participantError

      toast({
        title: "Success",
        description: `Tour scheduled successfully with ${participants.length} participant${participants.length > 1 ? "s" : ""}!`,
      })

            // Reset form
      setFormData({ warehouse_id: "", host_id: "", date: "", time: "" })
      setParticipants([])
      setSwagPreview([])
      setSelectedWorkflows([])
      setSelectedSkus([])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule tour. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedWarehouse = warehouses.find((w) => w.id === formData.warehouse_id)

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
              selected_skus: selectedSkus
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
      setFormData({ warehouse_id: "", host_id: "", date: "", time: "" })
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule a New Tour
          </CardTitle>
          <CardDescription>Create a new warehouse tour and manage participants</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tour Details Section - 2x2 Grid Layout */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="warehouse">Warehouse *</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                >
                  <SelectTrigger id="warehouse">
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => {
                      console.log('Rendering warehouse:', warehouse.name, warehouse.id)
                      return (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      )
                    })}
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
                  <SelectTrigger id="host">
                    <SelectValue placeholder="Select tour host" />
                  </SelectTrigger>
                  <SelectContent>
                    {hosts.map((host) => (
                      <SelectItem key={host.id} value={host.id}>
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
                  const categoryOptions = workflowOptions.filter(option => option.category === category)
                  
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{category}</h4>
                        <Separator className="flex-1" />
                      </div>
                      
                      <div className="grid gap-3 md:grid-cols-2">
                        {categoryOptions.map(option => (
                          <div key={option.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
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
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
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
                  {isLoadingSkus ? "Loading..." : "Load SKUs"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Select the specific SKUs to use for this tour. These will be used to create realistic orders instead of placeholder items.
              </p>

              {availableSkus.length > 0 && (
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {availableSkus.map(product => (
                      <div key={product.sku} className="flex items-start space-x-2 p-2 rounded border hover:bg-muted/50">
                        <Checkbox
                          id={product.sku}
                          checked={selectedSkus.includes(product.sku)}
                          onCheckedChange={(checked) => handleSkuChange(product.sku, checked as boolean)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <Label htmlFor={product.sku} className="font-medium cursor-pointer text-xs block truncate">
                            {product.sku}
                          </Label>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                            {product.name}
                          </p>
                          <p className="text-xs text-green-600">
                            {product.inventory?.available || 0}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableSkus.length === 0 && !isLoadingSkus && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Click "Load SKUs" to see available products</p>
                  <p className="text-xs">Requires ShipHero access token</p>
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

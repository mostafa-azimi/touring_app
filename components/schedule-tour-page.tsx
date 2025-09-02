"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Calendar, MapPin, Users, Package, Gift } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { allocateSwagToTour, getSwagAllocationPreview } from "@/lib/actions/swag-allocation"

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
  name: string
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

export function ScheduleTourPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [swagPreview, setSwagPreview] = useState<SwagPreview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    warehouse_id: "",
    date: "",
    time: "",
    notes: "",
  })
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "", company: "", title: "" })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchWarehouses()
  }, [])

  useEffect(() => {
    if (participants.length > 0) {
      updateSwagPreview()
    } else {
      setSwagPreview([])
    }
  }, [participants.length])

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase.from("warehouses").select("id, name, code, address, address2, city, state, zip, country").order("name")

      if (error) throw error
      setWarehouses(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch warehouses",
        variant: "destructive",
      })
    }
  }

  const updateSwagPreview = async () => {
    const result = await getSwagAllocationPreview(participants.length)
    if (result.success) {
      setSwagPreview(result.preview)
    }
  }

  const addParticipant = () => {
    if (!newParticipant.name.trim() || !newParticipant.email.trim()) {
      toast({
        title: "Error",
        description: "Please enter both name and email for the participant",
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
      name: newParticipant.name.trim(),
      email: newParticipant.email.trim().toLowerCase(),
      company: newParticipant.company.trim(),
      title: newParticipant.title.trim(),
    }

    setParticipants([...participants, participant])
    setNewParticipant({ name: "", email: "", company: "", title: "" })
  }

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.warehouse_id || !formData.date || !formData.time) {
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
            date: formData.date,
            time: formData.time,
            notes: formData.notes || null,
          },
        ])
        .select()
        .single()

      if (tourError) throw tourError

      // Add participants
      const participantInserts = participants.map((participant) => ({
        tour_id: tourData.id,
        name: participant.name,
        email: participant.email,
        company: participant.company,
        title: participant.title,
      }))

      const { data: insertedParticipants, error: participantError } = await supabase
        .from("tour_participants")
        .insert(participantInserts)
        .select("id")

      if (participantError) throw participantError

      const participantIds = insertedParticipants.map((p) => p.id)
      const swagResult = await allocateSwagToTour(tourData.id, participantIds)

      if (swagResult.success) {
        toast({
          title: "Success",
          description: `Tour scheduled successfully with ${participants.length} participant${participants.length > 1 ? "s" : ""}. ${swagResult.message}`,
        })
      } else {
        toast({
          title: "Partial Success",
          description: `Tour scheduled successfully, but swag allocation failed: ${swagResult.message}`,
          variant: "destructive",
        })
      }

            // Reset form
      setFormData({ warehouse_id: "", date: "", time: "", notes: "" })
      setParticipants([])
      setSwagPreview([])
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
            {/* Tour Details Section */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="warehouse">Warehouse *</Label>
                  <Select
                    value={formData.warehouse_id}
                    onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
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
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="time">Time *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={formData.time.split(':')[0] || ''}
                      onValueChange={(hour) => {
                        const currentMinute = formData.time.split(':')[1] || '00'
                        setFormData({ ...formData, time: `${hour}:${currentMinute}` })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.time.split(':')[1] || ''}
                      onValueChange={(minute) => {
                        const currentHour = formData.time.split(':')[0] || '09'
                        setFormData({ ...formData, time: `${currentHour}:${minute}` })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Minutes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="00">00</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.time && (
                    <p className="text-sm text-muted-foreground">
                      Selected time: {formData.time}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special instructions or notes for the tour..."
                  className="min-h-[120px]"
                />
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
                        <Label htmlFor="participant-name">Name</Label>
                        <Input
                          id="participant-name"
                          value={newParticipant.name}
                          onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                          placeholder="John Smith"
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
                              <p className="font-medium">{participant.name}</p>
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

            {swagPreview.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Swag Allocation Preview</h3>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Auto-assigned
                    </Badge>
                  </div>

                  <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CardHeader>
                      <CardTitle className="text-base text-green-800 dark:text-green-200">
                        Automatic Swag Distribution
                      </CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-300">
                        The following swag items will be automatically distributed to participants when the tour is
                        created
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {swagPreview.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.itemsPerParticipant} per participant
                                {item.participantsGettingExtra > 0 &&
                                  ` (+1 extra for ${item.participantsGettingExtra} participant${item.participantsGettingExtra > 1 ? "s" : ""})`}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {item.totalToAllocate} / {item.totalAvailable} available
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading} size="lg">
                {isLoading ? "Scheduling..." : "Schedule Tour"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

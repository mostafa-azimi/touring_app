"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, RefreshCw, Building2, TestTube } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Warehouse {
  id: string
  name: string
  code: string
  address: string
  address2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  contact_person?: string
  notes?: string
  shiphero_warehouse_id?: string
  created_at: string
}

interface ShipHeroWarehouse {
  id: string
  legacy_id: number
  identifier: string
  account_id: string
  address: {
    name: string
    address1: string
    address2?: string
    city: string
    state: string
    country: string
    zip: string
    phone?: string
  }
  dynamic_slotting: boolean
  invoice_email?: string
  phone_number?: string
  profile?: string
}

export function WarehousesTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [shipHeroWarehouses, setShipHeroWarehouses] = useState<ShipHeroWarehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingFromShipHero, setIsRefreshingFromShipHero] = useState(false)
  const [lastShipHeroSync, setLastShipHeroSync] = useState<Date | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    shiphero_warehouse_id: ""
  })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchWarehouses()
    
    // Auto-load ShipHero warehouses if access token exists
    const accessToken = localStorage.getItem('shiphero_access_token')
    if (accessToken) {
      console.log('🔄 Auto-loading ShipHero warehouses on component mount')
      fetchShipHeroWarehouses()
    }
  }, [])

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase.from("warehouses").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setWarehouses(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch warehouses",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchShipHeroWarehouses = async () => {
    setIsRefreshingFromShipHero(true)
    console.log('🏭 Fetching warehouses from ShipHero...')
    
    try {
      // Get access token from localStorage
      const accessToken = localStorage.getItem('shiphero_access_token')
      
      if (!accessToken) {
        throw new Error('No access token available. Please generate a new access token in the ShipHero tab first.')
      }

      console.log('🔍 Using access token from localStorage')

      const response = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('🏭 ShipHero warehouses API response:', {
        status: response.status,
        ok: response.ok
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('❌ ShipHero warehouses API error:', {
          status: response.status,
          error: result.error,
          details: result.details,
          fullResult: result
        })
        
        throw new Error(result.error || 'Failed to fetch ShipHero warehouses')
      }

      // Extract warehouses from ShipHero response
      const shipHeroWarehouses = result.data?.account?.data?.warehouses || []
      setShipHeroWarehouses(shipHeroWarehouses)
      setLastShipHeroSync(new Date())
      
      toast({
        title: "ShipHero Warehouses Loaded",
        description: `Found ${shipHeroWarehouses.length} warehouses from ShipHero`,
      })

      console.log('✅ ShipHero warehouses loaded successfully:', {
        totalWarehouses: shipHeroWarehouses.length,
        sampleWarehouses: shipHeroWarehouses.slice(0, 3).map((w: ShipHeroWarehouse) => w.address?.name || w.identifier)
      })

    } catch (error: any) {
      console.error('❌ Failed to fetch ShipHero warehouses:', error)
      toast({
        title: "Failed to Load ShipHero Warehouses",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsRefreshingFromShipHero(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Debug: Log the form data being submitted
      console.log("Submitting warehouse data:", formData)
      
      if (editingWarehouse) {
        const { data, error } = await supabase.from("warehouses").update(formData).eq("id", editingWarehouse.id).select()
        console.log("Update result:", { data, error })
        if (error) throw error
        toast({ title: "Success", description: "Warehouse updated successfully" })
      } else {
        const { data, error } = await supabase.from("warehouses").insert([formData]).select()
        console.log("Insert result:", { data, error })
        if (error) {
          console.error("Warehouse insert error:", error)
          throw error
        }
        toast({ title: "Success", description: "Warehouse created successfully" })
      }

      setFormData({
        name: "",
        code: "",
        address: "",
        address2: "",
        city: "",
        state: "",
        zip: "",
        country: "US",
        shiphero_warehouse_id: ""
      })
      setEditingWarehouse(null)
      setIsDialogOpen(false)
      fetchWarehouses()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save warehouse",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      code: warehouse.code || "",
      address: warehouse.address,
      address2: warehouse.address2 || "",
      city: warehouse.city || "",
      state: warehouse.state || "",
      zip: warehouse.zip || "",
      country: warehouse.country || "US",
      shiphero_warehouse_id: warehouse.shiphero_warehouse_id || ""
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this warehouse?")) return

    try {
      const { error } = await supabase.from("warehouses").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Warehouse deleted successfully" })
      fetchWarehouses()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete warehouse",
        variant: "destructive",
      })
    }
  }



  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "US",
      shiphero_warehouse_id: ""
    })
    setEditingWarehouse(null)
  }

  return (
    <div className="space-y-6">
      {/* Header with ShipHero Integration */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Warehouses
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage warehouse locations with real-time ShipHero integration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchShipHeroWarehouses}
              disabled={isRefreshingFromShipHero}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingFromShipHero ? 'animate-spin' : ''}`} />
              {isRefreshingFromShipHero ? 'Loading...' : 'Sync ShipHero'}
            </Button>
          </div>
        </div>

        {/* ShipHero Status */}
        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">ShipHero Integration</span>
            </div>
            
            {lastShipHeroSync && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  Last synced: {lastShipHeroSync.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  Found {shipHeroWarehouses.length} ShipHero warehouses
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ShipHero Warehouses Display */}
      {shipHeroWarehouses.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">ShipHero Warehouses</h4>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[100px]">Identifier</TableHead>
                    <TableHead className="min-w-[200px]">Address</TableHead>
                    <TableHead className="min-w-[100px]">City</TableHead>
                    <TableHead className="min-w-[80px]">State</TableHead>
                    <TableHead className="min-w-[80px]">Zip</TableHead>
                    <TableHead className="min-w-[120px]">ShipHero ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipHeroWarehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">
                        {warehouse.address?.name || warehouse.identifier || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {warehouse.identifier || '-'}
                      </TableCell>
                      <TableCell>
                        {warehouse.address?.address1 || '-'}
                      </TableCell>
                      <TableCell>
                        {warehouse.address?.city || '-'}
                      </TableCell>
                      <TableCell>
                        {warehouse.address?.state || '-'}
                      </TableCell>
                      <TableCell>
                        {warehouse.address?.zip || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {warehouse.id || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium">Local Warehouse Configuration</h4>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "Add New Warehouse"}</DialogTitle>
              <DialogDescription>
                {editingWarehouse ? "Update the warehouse information." : "Add a new warehouse location."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                {/* ShipHero Integration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">ShipHero Integration</h4>
                  <div className="grid gap-2">
                    <Label htmlFor="shiphero_warehouse_id">ShipHero Warehouse ID *</Label>
                    <Input
                      id="shiphero_warehouse_id"
                      value={formData.shiphero_warehouse_id}
                      onChange={(e) => setFormData({ ...formData, shiphero_warehouse_id: e.target.value })}
                      placeholder="V2FyZWhvdXN10jExOTM0Mw=="
                      required
                    />
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Warehouse Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Main Distribution Center"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="code">Airport Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="LAX"
                      maxLength={3}
                      required
                    />
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Address Information</h4>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address">Street Address *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Industrial Blvd"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address2">Address Line 2</Label>
                      <Input
                        id="address2"
                        value={formData.address2}
                        onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="Los Angeles"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder="CA"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="zip">ZIP Code *</Label>
                        <Input
                          id="zip"
                          value={formData.zip}
                          onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                          placeholder="90210"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="country">Country *</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          placeholder="US"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>


              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className={isLoading ? "cursor-wait" : ""}
                >
                  {isLoading ? "Saving..." : editingWarehouse ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[200px]">City, State</TableHead>
                <TableHead className="min-w-[150px]">ShipHero ID</TableHead>
                <TableHead className="min-w-[100px]">Created</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading warehouses...
                </TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No warehouses found. Add your first warehouse to get started.
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell className="font-medium">{warehouse.name}</TableCell>
                  <TableCell>{warehouse.code || '-'}</TableCell>
                  <TableCell>
                    {warehouse.city && warehouse.state 
                      ? `${warehouse.city}, ${warehouse.state}` 
                      : warehouse.address || '-'
                    }
                  </TableCell>
                  <TableCell className="font-mono text-xs">{warehouse.shiphero_warehouse_id || '-'}</TableCell>
                  <TableCell>{new Date(warehouse.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(warehouse)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(warehouse.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

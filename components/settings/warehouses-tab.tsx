"use client"

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

// Utility function to decode ShipHero warehouse ID and extract warehouse number
const decodeWarehouseId = (base64Id: string): string => {
  try {
    const decoded = atob(base64Id)
    // Remove "Warehouse:" prefix and return just the number
    return decoded.replace('Warehouse:', '')
  } catch (error) {
    console.error('Failed to decode warehouse ID:', base64Id, error)
    return 'Unknown'
  }
}

export function WarehousesTab() {
  const [shipHeroWarehouses, setShipHeroWarehouses] = useState<ShipHeroWarehouse[]>([])
  const [warehouseCodes, setWarehouseCodes] = useState<{[key: string]: string}>({})
  const [isRefreshingFromShipHero, setIsRefreshingFromShipHero] = useState(false)
  const [lastShipHeroSync, setLastShipHeroSync] = useState<Date | null>(null)
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [editingCodeValue, setEditingCodeValue] = useState('')
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    // Load warehouse codes from Supabase
    loadWarehouseCodes()
    
    // Auto-load ShipHero warehouses if access token exists
    const accessToken = localStorage.getItem('shiphero_access_token')
    if (accessToken) {
      console.log('🔄 Auto-loading ShipHero warehouses on component mount')
      fetchShipHeroWarehouses()
    }
  }, [])

  const loadWarehouseCodes = async () => {
    try {
      // Load warehouse codes from a new table (we'll create this)
      const { data, error } = await supabase
        .from("warehouse_codes")
        .select("shiphero_warehouse_id, code")

      if (error && error.code !== 'PGRST116') { // Ignore table not found error for now
        throw error
      }
      
      // Convert to lookup object
      const codesMap: {[key: string]: string} = {}
      if (data) {
        data.forEach((item: any) => {
          codesMap[item.shiphero_warehouse_id] = item.code
        })
      }
      
      setWarehouseCodes(codesMap)
    } catch (error) {
      console.error('Error loading warehouse codes:', error)
      // Don't show error toast for now, table might not exist yet
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

  const startEditingCode = (warehouseId: string, currentCode: string) => {
    setEditingCodeId(warehouseId)
    setEditingCodeValue(currentCode)
  }

  const cancelEditingCode = () => {
    setEditingCodeId(null)
    setEditingCodeValue('')
  }

  const saveWarehouseCode = async (warehouseId: string, code: string) => {
    try {
      // Create warehouse_codes table if it doesn't exist and upsert the code
      const { error } = await supabase
        .from('warehouse_codes')
        .upsert({
          shiphero_warehouse_id: warehouseId,
          code: code.trim(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Update local state
      setWarehouseCodes(prev => ({
        ...prev,
        [warehouseId]: code.trim()
      }))

      setEditingCodeId(null)
      setEditingCodeValue('')

      toast({
        title: "Code Saved",
        description: `Warehouse code updated to "${code.trim()}"`,
      })

    } catch (error: any) {
      console.error('Error saving warehouse code:', error)
      toast({
        title: "Error",
        description: "Failed to save warehouse code",
        variant: "destructive",
      })
    }
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
      {shipHeroWarehouses.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-md font-medium">ShipHero Warehouses</h4>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Name</TableHead>
                  <TableHead className="w-[10%]">Code</TableHead>
                  <TableHead className="w-[25%]">Address</TableHead>
                  <TableHead className="w-[15%] hidden lg:table-cell">City</TableHead>
                  <TableHead className="w-[8%] hidden xl:table-cell">State</TableHead>
                  <TableHead className="w-[8%] hidden xl:table-cell">Zip</TableHead>
                  <TableHead className="w-[10%] hidden md:table-cell">Warehouse #</TableHead>
                  <TableHead className="w-[4%] hidden 2xl:table-cell">ShipHero ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipHeroWarehouses.map((warehouse) => {
                  const warehouseNumber = decodeWarehouseId(warehouse.id)
                  const currentCode = warehouseCodes[warehouse.id] || ''
                  const isEditing = editingCodeId === warehouse.id

                  return (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">
                        <div className="truncate">
                          {warehouse.address?.name || warehouse.identifier || '-'}
                        </div>
                        {/* Show mobile info */}
                        <div className="lg:hidden text-xs text-muted-foreground mt-1">
                          {warehouse.address?.city && warehouse.address?.state && 
                            `${warehouse.address.city}, ${warehouse.address.state}`
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              value={editingCodeValue}
                              onChange={(e) => setEditingCodeValue(e.target.value)}
                              className="w-full h-8"
                              placeholder="Code"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => saveWarehouseCode(warehouse.id, editingCodeValue)}
                                className="h-6 px-2 text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditingCode}
                                className="h-6 px-2 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                            onClick={() => startEditingCode(warehouse.id, currentCode)}
                          >
                            <span className="font-mono text-sm truncate block">
                              {currentCode || 'Add'}
                            </span>
                            <Edit className="h-3 w-3 text-muted-foreground mt-1" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="truncate">
                          {warehouse.address?.address1 || '-'}
                        </div>
                        {/* Show mobile warehouse info */}
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          Warehouse #{warehouseNumber}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="truncate">
                          {warehouse.address?.city || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {warehouse.address?.state || '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {warehouse.address?.zip || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium hidden md:table-cell">
                        {warehouseNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground hidden 2xl:table-cell">
                        <div className="truncate" title={warehouse.id}>
                          {warehouse.id}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No ShipHero warehouses loaded yet.</p>
          <p className="text-sm">Click "Sync ShipHero" to load your warehouse data.</p>
        </div>
      )}
    </div>
  )
}

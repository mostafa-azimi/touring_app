"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, RefreshCw, Eye, EyeOff, TestTube, Plus, ShoppingCart } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

export function ShipHeroTab() {
  const [refreshToken, setRefreshToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [showAdhocOrder, setShowAdhocOrder] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [hosts, setHosts] = useState<any[]>([])
  const [swagItems, setSwagItems] = useState<any[]>([])
  const [adhocOrderData, setAdhocOrderData] = useState({
    warehouseId: '',
    hostId: '',
    swagItemIds: [] as string[],
    notes: ''
  })
  const [lastError, setLastError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const savedToken = localStorage.getItem('shiphero_refresh_token') || ''
    setRefreshToken(savedToken)
  }, [])

  const loadAdhocOrderData = async () => {
    try {
      const supabase = createClient()
      
      // Load warehouses, hosts, and swag items directly from Supabase
      const [warehousesRes, hostsRes, swagItemsRes] = await Promise.all([
        supabase.from('warehouses').select('id, name, code, address, address2, city, state, zip, country, shiphero_warehouse_id').order('name'),
        supabase.from('team_members').select('id, first_name, last_name, email').order('first_name'),
        supabase.from('swag_items').select('id, name, sku, vendor_id').order('name')
      ])

      if (warehousesRes.error) {
        throw new Error(`Warehouses error: ${warehousesRes.error.message}`)
      }
      if (hostsRes.error) {
        throw new Error(`Hosts error: ${hostsRes.error.message}`)
      }
      if (swagItemsRes.error) {
        throw new Error(`Swag items error: ${swagItemsRes.error.message}`)
      }

      setWarehouses(warehousesRes.data || [])
      setHosts(hostsRes.data || [])
      setSwagItems(swagItemsRes.data || [])
      
      console.log('Loaded data:', {
        warehouses: warehousesRes.data?.length || 0,
        hosts: hostsRes.data?.length || 0,
        swagItems: swagItemsRes.data?.length || 0
      })
      
      console.log('Warehouse data:', warehousesRes.data)
      console.log('Host data:', hostsRes.data)
      console.log('Swag items data:', swagItemsRes.data)
    } catch (error: any) {
      console.error('Error loading adhoc order data:', error)
      toast({
        title: "Error",
        description: `Failed to load data: ${error.message}`,
        variant: "destructive",
      })
    }
  }



  const handleSaveToken = () => {
    if (refreshToken) {
      localStorage.setItem('shiphero_refresh_token', refreshToken)
      toast({
        title: "Token Saved",
        description: "Refresh token saved successfully",
      })
    }
  }

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      })

      if (response.ok) {
        const data = await response.json()
        const newAccessToken = data.access_token
        const expiresIn = data.expires_in
        
        if (newAccessToken) {
          // Calculate expiration date
          const expirationDate = new Date(Date.now() + (expiresIn * 1000))
          
          toast({
            title: "Access Token Refreshed Successfully",
            description: `New access token generated. Expires: ${expirationDate.toLocaleString()}`,
          })
        } else {
          throw new Error('No access token received from refresh')
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to refresh token')
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh token",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleConnectionTest = async () => {
    setIsTesting(true)
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available. Please enter your refresh token first.')
      }
      
      // First, get an access token using the refresh token
      const tokenResponse = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      })
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get access token from refresh token')
      }
      
      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token
      
      if (!accessToken) {
        throw new Error('No access token received from refresh token')
      }
      
      // Test connection by querying warehouses
      const warehousesResponse = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!warehousesResponse.ok) {
        throw new Error(`Warehouses query failed: ${warehousesResponse.status}`)
      }
      
      const warehousesResult = await warehousesResponse.json()
      
      // Also query products with SWAG in SKU
      const productsResponse = await fetch('/api/shiphero/products', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      let productsResult = null
      if (productsResponse.ok) {
        productsResult = await productsResponse.json()
      } else {
        console.log('Products query failed:', productsResponse.status, productsResponse.statusText)
      }

      // Combine results
      const combinedResult = {
        warehouses: warehousesResult,
        products: productsResult
      }
      
      setTestResults(combinedResult)
      
      const warehouseCount = warehousesResult.data?.account?.data?.warehouses?.length || 0
      const productCount = productsResult?.data?.account?.data?.products?.edges?.length || 0
      
      toast({
        title: "Connection Test Successful",
        description: `Found ${warehouseCount} warehouses and ${productCount} SWAG products in ShipHero`,
      })
    } catch (error: any) {
      setTestResults({ error: error.message })
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to ShipHero API",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleCreateAdhocOrder = async () => {
    console.log('🚀🚀🚀 handleCreateAdhocOrder called with data:', adhocOrderData)
    
    if (!adhocOrderData.warehouseId || !adhocOrderData.hostId || adhocOrderData.swagItemIds.length === 0) {
      console.log('Validation failed:', {
        warehouseId: adhocOrderData.warehouseId,
        hostId: adhocOrderData.hostId,
        swagItemIds: adhocOrderData.swagItemIds
      })
      toast({
        title: "Missing Information",
        description: "Please select a warehouse, host, and at least one swag item",
        variant: "destructive",
      })
      return
    }

    setIsCreatingOrder(true)
    setLastError(null) // Clear previous errors
    try {
      // Get access token first
      const tokenResponse = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      })

      if (!tokenResponse.ok) {
        throw new Error('Failed to get access token')
      }

      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token

      if (!accessToken) {
        throw new Error('No access token received')
      }

      // Find selected data
      const warehouse = warehouses.find(w => w.id === adhocOrderData.warehouseId)
      const host = hosts.find(h => h.id === adhocOrderData.hostId)
      const selectedSwagItems = swagItems.filter(s => adhocOrderData.swagItemIds.includes(s.id))

      if (!warehouse || !host || selectedSwagItems.length === 0) {
        throw new Error('Selected data not found')
      }

      // Create line items
      const lineItems = selectedSwagItems.map(swagItem => ({
        sku: swagItem.sku || swagItem.name,
        quantity: 1,
        price: "0.00"
      }))

      // Generate order number
      const orderNumber = `ADHOC-${Date.now()}`

      // Use tomorrow's date
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const orderDate = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format

      const orderData = {
        order_number: orderNumber,
        shop_name: "Warehouse Tours - Adhoc",
        fulfillment_status: "pending",
        order_date: orderDate,
        total_tax: "0.00",
        subtotal: "0.00",
        total_discounts: "0.00",
        total_price: "0.00",
        shipping_lines: {
          title: "Generic Shipping",
          price: "0.00",
          carrier: "Generic Carrier",
          method: "Generic Label"
        },
        shipping_address: {
          first_name: warehouse.name,
          last_name: "Warehouse",
          company: warehouse.name,
          address1: warehouse.address,
          address2: warehouse.address2 || '',
          city: warehouse.city,
          state: warehouse.state === 'Georgia' ? 'GA' : warehouse.state,
          state_code: warehouse.state === 'Georgia' ? 'GA' : warehouse.state,
          zip: warehouse.zip,
          country: 'US',
          country_code: 'US',
          email: host.email,
          phone: "5555555555"
        },
        billing_address: {
          first_name: host.first_name,
          last_name: host.last_name,
          company: '',
          address1: warehouse.address,
          address2: warehouse.address2 || '',
          city: warehouse.city,
          state: warehouse.state === 'Georgia' ? 'GA' : warehouse.state,
          state_code: warehouse.state === 'Georgia' ? 'GA' : warehouse.state,
          zip: warehouse.zip,
          country: 'US',
          country_code: 'US',
          email: host.email,
          phone: "5555555555"
        },
        line_items: lineItems.map((item, index) => ({
          sku: item.sku,
          partner_line_item_id: `${orderNumber}-${index + 1}`,
          quantity: item.quantity,
          price: item.price,
          product_name: item.sku,
          fulfillment_status: "pending",
          quantity_pending_fulfillment: item.quantity,
          warehouse_id: warehouse.shiphero_warehouse_id
        })),
        required_ship_date: orderDate
      }

      console.log('Creating adhoc order with data:', JSON.stringify(orderData, null, 2))
      console.log('Selected warehouse:', warehouse)
      console.log('Selected host:', host)
      console.log('Selected swag items:', selectedSwagItems)

      // Create sales order
      console.log('Making request to /api/shiphero/orders with access token:', accessToken ? 'Present' : 'Missing')
      
      let orderResponse
      try {
        orderResponse = await fetch('/api/shiphero/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
                  body: JSON.stringify({
          type: 'sales_order',
          data: orderData
        })
        })
        console.log('Order response status:', orderResponse.status, orderResponse.statusText)
      } catch (fetchError) {
        console.error('Fetch error:', fetchError)
        throw new Error(`Network error: ${fetchError.message}`)
      }

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json()
        console.error('Order creation error:', errorData)
        
        // Show detailed error in toast
        toast({
          title: "Order Creation Failed",
          description: (
            <div className="space-y-2">
              <p><strong>Status:</strong> {orderResponse.status} {orderResponse.statusText}</p>
              <p><strong>Error:</strong> {errorData.error || 'Unknown error'}</p>
              {errorData.details && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600">Show Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {typeof errorData.details === 'string' 
                      ? errorData.details 
                      : JSON.stringify(errorData.details, null, 2)
                    }
                  </pre>
                </details>
              )}
            </div>
          ),
          variant: "destructive",
        })
        
        const errorMessage = `Order creation failed: ${orderResponse.status} - ${errorData.error || errorData.details || 'Unknown error'}`
        setLastError(errorMessage)
        throw new Error(errorMessage)
      }

      const orderResult = await orderResponse.json()
      console.log('🎉 ShipHero order creation response:', JSON.stringify(orderResult, null, 2))
      
      // Create ShipHero order link
      const orderId = orderResult.data?.order_create?.order?.id
      const legacyId = orderResult.data?.order_create?.order?.legacy_id
      const createdOrderNumber = orderResult.data?.order_create?.order?.order_number || orderNumber
      const shipheroLink = orderId ? `https://app.shiphero.com/orders/${orderId}` : null
      
      console.log('📦 Order created successfully!', {
        orderId,
        legacyId,
        createdOrderNumber,
        shipheroLink
      })
      
      toast({
        title: "Adhoc Order Created Successfully!",
        description: (
          <div className="space-y-2">
            <p><strong>Order:</strong> {createdOrderNumber}</p>
            <p><strong>Host:</strong> {host.first_name} {host.last_name}</p>
            {orderId && <p><strong>ShipHero ID:</strong> {orderId}</p>}
            {legacyId && <p><strong>Legacy ID:</strong> {legacyId}</p>}
            {shipheroLink ? (
              <a 
                href={shipheroLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline block"
              >
                View Order in ShipHero →
              </a>
            ) : (
              <p className="text-amber-600">⚠️ No ShipHero link available (check console for order ID)</p>
            )}
          </div>
        ),
      })

      // Reset form
      setAdhocOrderData({
        warehouseId: '',
        hostId: '',
        swagItemIds: [],
        notes: ''
      })
      setShowAdhocOrder(false)

    } catch (error: any) {
      console.error('Adhoc order creation error:', error)
      
      const errorMessage = error.message || "Failed to create adhoc order"
      setLastError(errorMessage)
      
      toast({
        title: "Order Creation Failed",
        description: (
          <div className="space-y-2">
            <p><strong>Error:</strong> {errorMessage}</p>
            <details className="text-xs">
              <summary className="cursor-pointer text-blue-600">Show Full Error</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          </div>
        ),
        variant: "destructive",
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ShipHero API</CardTitle>
          <CardDescription>
            Enter and manage your ShipHero refresh token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="refresh-token">Refresh Token</Label>
            <div className="flex items-center gap-2">
              <Input
                id="refresh-token"
                type={showToken ? "text" : "password"}
                placeholder="Enter your ShipHero refresh token..."
                value={refreshToken}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value)
                  setRefreshToken(e.target.value)
                }}
                className="font-mono text-xs"
                autoComplete="off"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveToken} disabled={!refreshToken}>
              <Save className="h-4 w-4 mr-2" />
              Save Token
            </Button>
            
            <Button
              onClick={handleRefreshToken}
              disabled={isRefreshing || !refreshToken}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Refreshing..." : "Get New Access Token"}
            </Button>
            
            <Button
              onClick={handleConnectionTest}
              disabled={isTesting || !refreshToken}
              variant="outline"
            >
              <TestTube className={`h-4 w-4 mr-2 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
          </div>



          {testResults && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-3">Connection Test Results</h4>
              {testResults.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  <strong>Error:</strong> {testResults.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-blue-700">
                    <strong>Status:</strong> Connected successfully
                    {testResults.warehouses?.data?.account?.data?.warehouses && (
                      <span className="ml-2">
                        • <strong>{testResults.warehouses.data.account.data.warehouses.length}</strong> warehouses found
                      </span>
                    )}
                    {testResults.products?.data?.account?.data?.products?.edges && (
                      <span className="ml-2">
                        • <strong>{testResults.products.data.account.data.products.edges.length}</strong> products found
                      </span>
                    )}
                  </div>
                  
                  {/* Debug: Show raw data structure */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Debug: All data (warehouses & products)</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(testResults, null, 2)}
                    </pre>
                  </details>
                  
                  {testResults.warehouses?.data?.account?.data?.warehouses && Array.isArray(testResults.warehouses.data.account.data.warehouses) && testResults.warehouses.data.account.data.warehouses.length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testResults.warehouses.data.account.data.warehouses.map((warehouse: any, index: number) => {
                            // Ensure warehouse is an object and has the expected structure
                            if (!warehouse || typeof warehouse !== 'object') {
                              return (
                                <TableRow key={index}>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    Invalid warehouse data
                                  </TableCell>
                                </TableRow>
                              )
                            }
                            
                            return (
                              <TableRow key={warehouse.id || index}>
                                <TableCell className="font-mono text-xs">{String(warehouse.id || '-')}</TableCell>
                                <TableCell className="font-medium">
                                  {String(
                                    warehouse.address?.name || 
                                    warehouse.name || 
                                    warehouse.title || 
                                    warehouse.display_name || 
                                    warehouse.identifier || 
                                    '-'
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {warehouse.address ? (
                                    <div>
                                      {typeof warehouse.address === 'object' ? (
                                        <div>
                                          <div>{String(warehouse.address.address1 || warehouse.address.address || '-')}</div>
                                          {warehouse.address.address2 && (
                                            <div>{String(warehouse.address.address2)}</div>
                                          )}
                                          {warehouse.address.city && warehouse.address.state && (
                                            <div className="text-muted-foreground">
                                              {String(warehouse.address.city)}, {String(warehouse.address.state)} {String(warehouse.address.zip || '')}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div>{String(warehouse.address)}</div>
                                      )}
                                    </div>
                                  ) : '-'}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {testResults.data?.account?.data?.warehouses && testResults.data.account.data.warehouses.length === 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                      No warehouses found in your ShipHero account
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adhoc Sales Order</CardTitle>
          <CardDescription>
            Create a sales order manually using existing warehouses, hosts, and swag items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => {
              setShowAdhocOrder(!showAdhocOrder)
              if (!showAdhocOrder) {
                loadAdhocOrderData()
              }
            }}
            variant="outline"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {showAdhocOrder ? "Hide" : "Create Adhoc Order"}
          </Button>

          {showAdhocOrder && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              {lastError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                  <h5 className="font-medium text-red-800 mb-2">❌ Last Error:</h5>
                  <p className="text-red-700 text-sm">{lastError}</p>
                  <button 
                    onClick={() => setLastError(null)}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Clear Error
                  </button>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="warehouse-select">Warehouse *</Label>
                  <Select
                    value={adhocOrderData.warehouseId}
                    onValueChange={(value) => setAdhocOrderData({ ...adhocOrderData, warehouseId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
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

                <div className="grid gap-2">
                  <Label htmlFor="host-select">Host *</Label>
                  <Select
                    value={adhocOrderData.hostId}
                    onValueChange={(value) => setAdhocOrderData({ ...adhocOrderData, hostId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select host" />
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
              </div>

              <div className="grid gap-2">
                <Label>Swag Items *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                  {swagItems.map((swagItem) => (
                    <label key={swagItem.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={adhocOrderData.swagItemIds.includes(swagItem.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAdhocOrderData({
                              ...adhocOrderData,
                              swagItemIds: [...adhocOrderData.swagItemIds, swagItem.id]
                            })
                          } else {
                            setAdhocOrderData({
                              ...adhocOrderData,
                              swagItemIds: adhocOrderData.swagItemIds.filter(id => id !== swagItem.id)
                            })
                          }
                        }}
                      />
                      <span className="text-sm">{swagItem.name} ({swagItem.sku})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={adhocOrderData.notes}
                  onChange={(e) => setAdhocOrderData({ ...adhocOrderData, notes: e.target.value })}
                  placeholder="Additional notes for this order..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleCreateAdhocOrder}
                disabled={isCreatingOrder || !adhocOrderData.warehouseId || !adhocOrderData.hostId || adhocOrderData.swagItemIds.length === 0}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreatingOrder ? "Creating Order..." : "Create Sales Order"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
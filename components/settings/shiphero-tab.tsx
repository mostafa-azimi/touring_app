"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RefreshCw, TestTube, Plus, ShoppingCart } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { generateSalesOrderName, generatePurchaseOrderName } from "@/lib/shiphero/naming-utils"
import { ShipHeroOrderService } from "@/lib/shiphero/order-service"

export function ShipHeroTab() {
  const [refreshToken, setRefreshToken] = useState("")
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [showAdhocOrder, setShowAdhocOrder] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [showAdhocPO, setShowAdhocPO] = useState(false)
  const [isCreatingPO, setIsCreatingPO] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [hosts, setHosts] = useState<any[]>([])
  const [swagItems, setSwagItems] = useState<any[]>([])
  const [adhocOrderData, setAdhocOrderData] = useState({
    warehouseId: '',
    hostId: '',
    swagItemIds: [] as string[],
    notes: '',
    orderDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] // Tomorrow's date
  })
  const [adhocPOData, setAdhocPOData] = useState({
    warehouseId: '',
    hostId: '',
    swagItemIds: [] as string[],
    swagQuantities: {} as Record<string, number>,
    notes: '',
    poDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] // Tomorrow's date
  })
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastOrderResponse, setLastOrderResponse] = useState<any>(null)
  const [lastPOResponse, setLastPOResponse] = useState<any>(null)

  const { toast } = useToast()

  useEffect(() => {
    const savedToken = localStorage.getItem('shiphero_refresh_token') || ''
    const savedExpiresAt = localStorage.getItem('shiphero_token_expires_at')
    setRefreshToken(savedToken)
    setTokenExpiresAt(savedExpiresAt)
    
    // Calculate initial countdown
    if (savedExpiresAt) {
      calculateCountdown(savedExpiresAt)
    }

    // Load data when component mounts
    loadAdhocOrderData()
  }, [])

  // Update countdown every second for live timer
  useEffect(() => {
    if (!tokenExpiresAt) return

    const updateCountdown = () => {
      calculateCountdown(tokenExpiresAt)
    }

    // Update immediately
    updateCountdown()

    // Update every second for live countdown
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [tokenExpiresAt])

  const calculateCountdown = (expiresAt: string) => {
    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expirationDate.getTime() - now.getTime()
    
    if (diffTime <= 0) {
      setCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      })
      setDaysRemaining(0)
      return
    }

    // Calculate time components
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)

    setCountdown({
      days,
      hours,
      minutes,
      seconds,
      isExpired: false
    })
    
    // Keep the old days calculation for compatibility
    setDaysRemaining(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))))
  }



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
          
          // Store expiration date in localStorage
          localStorage.setItem('shiphero_token_expires_at', expirationDate.toISOString())
          setTokenExpiresAt(expirationDate.toISOString())
          
          // Calculate and set countdown (should be 28 days)
          calculateCountdown(expirationDate.toISOString())
          
          // Show success modal
          setShowSuccessModal(true)
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
      
      // Test connection by querying warehouses only
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
      setTestResults(warehousesResult)
      
      const warehouseCount = warehousesResult.data?.account?.data?.warehouses?.length || 0
      
      toast({
        title: "Connection Test Successful",
        description: `Connected to ShipHero API! Found ${warehouseCount} warehouse${warehouseCount !== 1 ? 's' : ''}`,
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

      // Generate order number using naming convention
      const orderNumber = generateSalesOrderName(host.first_name, host.last_name, warehouse.name, warehouse.code)

      // Use the selected date from the form
      const orderDate = adhocOrderData.orderDate

      const orderData = {
        order_number: orderNumber,
        shop_name: "Warehouse Tours - Adhoc",
        fulfillment_status: "Tour_Orders",
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
          fulfillment_status: "Tour_Orders",
          quantity_pending_fulfillment: item.quantity,
          warehouse_id: warehouse.shiphero_warehouse_id
        })),
        required_ship_date: orderDate,
        tags: [warehouse.code || ""].filter(Boolean) // Add airport code as tag
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
        let message = 'Unknown network error'
        if (fetchError instanceof Error) {
          message = fetchError.message
        }
        throw new Error(`Network error: ${message}`)
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
      
      // Store the response for display including GraphQL query
      setLastOrderResponse({
        request: {
          originalData: orderData,
          graphqlQuery: orderResult._request?.query || 'Query not available',
          graphqlVariables: orderResult._request?.variables || {},
          type: orderResult._request?.type || 'sales_order'
        },
        response: orderResult
      })
      
      // Create ShipHero order link
      const orderId = orderResult.data?.order_create?.order?.id
      const legacyId = orderResult.data?.order_create?.order?.legacy_id
      const createdOrderNumber = orderResult.data?.order_create?.order?.order_number || orderNumber
      const shipheroLink = legacyId ? `https://app.shiphero.com/dashboard/orders/details/${legacyId}` : null
      
      console.log('📦 Order created successfully!', {
        orderId,
        legacyId,
        createdOrderNumber,
        shipheroLink
      })
      
      toast({
        title: "🎉 Adhoc Order Created Successfully!",
        description: (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="font-semibold text-green-800">Order Details:</p>
              <p><strong>Order Number:</strong> {createdOrderNumber}</p>
              <p><strong>Host:</strong> {host.first_name} {host.last_name}</p>
              {legacyId && (
                <p className="text-lg font-bold text-green-700">
                  <strong>ShipHero Order ID:</strong> {legacyId}
                </p>
              )}
              {orderId && (
                <p className="text-xs text-gray-600"><strong>Internal ID:</strong> {orderId}</p>
              )}
            </div>
            {shipheroLink ? (
              <a 
                href={shipheroLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
              >
                📦 View Order in ShipHero →
              </a>
            ) : (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                <p className="text-amber-700">
                  ⚠️ ShipHero link not available
                  {legacyId ? ` (Order ID: ${legacyId})` : ' (check console for details)'}
                </p>
              </div>
            )}
          </div>
        ),
      })

      // Reset form
      setAdhocOrderData({
        warehouseId: '',
        hostId: '',
        swagItemIds: [],
        notes: '',
        orderDate: ''
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

  const handleCreateAdhocPO = async () => {
    console.log('🚀🚀🚀 handleCreateAdhocPO called with data:', adhocPOData)
    
    if (!adhocPOData.warehouseId || !adhocPOData.hostId || adhocPOData.swagItemIds.length === 0) {
      console.log('PO Validation failed:', {
        warehouseId: adhocPOData.warehouseId,
        hostId: adhocPOData.hostId,
        swagItemIds: adhocPOData.swagItemIds
      })
      toast({
        title: "Missing Information",
        description: "Please select a warehouse, host, and at least one swag item",
        variant: "destructive",
      })
      return
    }

    setIsCreatingPO(true)
    setLastError(null)
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
      const warehouse = warehouses.find(w => w.id === adhocPOData.warehouseId)
      const host = hosts.find(h => h.id === adhocPOData.hostId)
      const selectedSwagItems = swagItems.filter(s => adhocPOData.swagItemIds.includes(s.id))

      if (!warehouse || !host || selectedSwagItems.length === 0) {
        throw new Error('Selected data not found')
      }

      // Create line items for PO
      const lineItems = selectedSwagItems.map(swagItem => ({
        sku: swagItem.sku || swagItem.name,
        quantity: adhocPOData.swagQuantities[swagItem.id] || 1,
        expected_weight_in_lbs: "1.00",
        vendor_id: "1076735",
        quantity_received: 0,
        quantity_rejected: 0,
        price: "0.00",
        product_name: swagItem.name,
        fulfillment_status: "Tour_Orders",
        sell_ahead: 0
      }))

      // Generate PO number using naming convention
      const poNumber = generatePurchaseOrderName(host.last_name, warehouse.code)
      
      // Use the selected date from the form
      const poDate = adhocPOData.poDate

      const poData = {
        po_date: poDate,
        po_number: poNumber,
        subtotal: "0.00",
        shipping_price: "0.00",
        total_price: "0.00",
        warehouse_id: warehouse.shiphero_warehouse_id,
        line_items: lineItems,
        fulfillment_status: "Tour_Orders",
        discount: "0.00",
        vendor_id: "1076735"
      }

      console.log('Creating adhoc PO with data:', JSON.stringify(poData, null, 2))

      // Create purchase order
      const poResponse = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          type: 'purchase_order',
          data: poData
        })
      })

      if (!poResponse.ok) {
        const errorData = await poResponse.json()
        console.error('PO creation error:', errorData)
        throw new Error(errorData.error || errorData.details || 'Failed to create purchase order')
      }

      const poResult = await poResponse.json()
      console.log('🎉 ShipHero PO creation response:', JSON.stringify(poResult, null, 2))
      
      // Store the response for display including GraphQL query
      setLastPOResponse({
        request: {
          originalData: poData,
          graphqlQuery: poResult._request?.query || 'Query not available',
          graphqlVariables: poResult._request?.variables || {},
          type: poResult._request?.type || 'purchase_order'
        },
        response: poResult
      })
      
      const poId = poResult.data?.purchase_order_create?.purchase_order?.id
      const poLegacyId = poResult.data?.purchase_order_create?.purchase_order?.legacy_id
      const createdPONumber = poResult.data?.purchase_order_create?.purchase_order?.po_number || poNumber
      const shipheroPOLink = poLegacyId ? `https://app.shiphero.com/dashboard/purchase-orders/details/${poLegacyId}` : null
      
      console.log('📦 PO created successfully!', {
        poId,
        poLegacyId,
        createdPONumber,
        shipheroPOLink
      })
      
      toast({
        title: "🎉 Adhoc Purchase Order Created Successfully!",
        description: (
          <div className="space-y-3">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded">
              <p className="font-semibold text-purple-800">Purchase Order Details:</p>
              <p><strong>PO Number:</strong> {createdPONumber}</p>
              <p><strong>Host:</strong> {host.first_name} {host.last_name}</p>
              {poLegacyId && (
                <p className="text-lg font-bold text-purple-700">
                  <strong>ShipHero PO ID:</strong> {poLegacyId}
                </p>
              )}
              {poId && (
                <p className="text-xs text-gray-600"><strong>Internal ID:</strong> {poId}</p>
              )}
            </div>
            {shipheroPOLink ? (
              <a 
                href={shipheroPOLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors cursor-pointer"
              >
                📦 View PO in ShipHero →
              </a>
            ) : (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                <p className="text-amber-700">
                  ⚠️ ShipHero PO link not available
                  {poLegacyId ? ` (PO ID: ${poLegacyId})` : ' (check console for details)'}
                </p>
              </div>
            )}
          </div>
        ),
      })

      // Reset form
      setAdhocPOData({
        warehouseId: '',
        hostId: '',
        swagItemIds: [],
        swagQuantities: {},
        notes: '',
        poDate: ''
      })
      setShowAdhocPO(false)

    } catch (error: any) {
      console.error('Adhoc PO creation error:', error)
      
      const errorMessage = error.message || "Failed to create adhoc purchase order"
      setLastError(errorMessage)
      
      toast({
        title: "Purchase Order Creation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreatingPO(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ShipHero API Connection</CardTitle>
          <CardDescription>
            {refreshToken ? 
              "Connected to ShipHero API. Generate a new access token or test your connection." : 
              "Enter your ShipHero refresh token below to enable API access and tour finalization."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Refresh Token Input Section */}
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="refreshToken">ShipHero Refresh Token</Label>
              <div className="flex gap-2">
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="Paste your ShipHero refresh token here"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    localStorage.setItem('shiphero_refresh_token', refreshToken)
                    // Clear expiration data when manually saving a new refresh token
                    localStorage.removeItem('shiphero_token_expires_at')
                    setTokenExpiresAt(null)
                    setDaysRemaining(null)
                    toast({
                      title: "Refresh Token Saved",
                      description: "Your ShipHero refresh token has been saved securely. Generate a new access token to start the 28-day countdown.",
                    })
                  }}
                  disabled={!refreshToken.trim()}
                  variant="outline"
                >
                  Save Token
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your ShipHero refresh token to enable API access. This token is stored locally and securely in your browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefreshToken}
              disabled={isRefreshing || !refreshToken}
              variant="default"
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Generating..." : "Generate New Access Token"}
            </Button>
            
            <Button
              onClick={handleConnectionTest}
              disabled={isTesting || !refreshToken}
              variant="outline"
              className="flex-1"
            >
              <TestTube className={`h-4 w-4 mr-2 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
          </div>
          
          {refreshToken && (
            <div className="text-sm bg-muted p-4 rounded-lg space-y-2">
              <p className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>API credentials are configured and stored securely</span>
              </p>
              {countdown !== null ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2">
                    <span className={`text-lg ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                      ⏰
                    </span>
                    <span className={countdown.days <= 3 ? 'text-red-600 font-medium' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}>
                      {countdown.isExpired ? 'Token has expired! Generate a new one immediately.' :
                       countdown.days === 0 ? 'Token expires today! Generate a new one immediately.' :
                       `Token expires in ${countdown.days} day${countdown.days !== 1 ? 's' : ''}`}
                    </span>
                  </p>
                  {!countdown.isExpired && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Live Countdown:</p>
                      <div className="flex items-center gap-4 font-mono text-lg">
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.days.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">DAYS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.hours.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">HOURS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.minutes.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">MINS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.seconds.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">SECS</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2">
                  <span className="text-blue-600">💡</span>
                  <span>Generate a new access token to start the 28-day countdown</span>
                </p>
              )}
            </div>
          )}

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
                    {testResults.data?.account?.data?.warehouses && (
                      <span className="ml-2">
                        • <strong>{testResults.data.account.data.warehouses.length}</strong> warehouses found
                      </span>
                    )}
                  </div>
                  
                  {/* Debug: Show raw data structure */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Debug: Warehouse data</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(testResults, null, 2)}
                    </pre>
                  </details>
                  
                  {testResults.data?.account?.data?.warehouses && Array.isArray(testResults.data.account.data.warehouses) && testResults.data.account.data.warehouses.length > 0 && (
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
                          {testResults.data.account.data.warehouses.map((warehouse: any, index: number) => {
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
              
              <div className="grid gap-2 mb-4">
                <Label htmlFor="order-date">Order Date *</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={adhocOrderData.orderDate}
                  onChange={(e) => setAdhocOrderData({...adhocOrderData, orderDate: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="warehouse-select">Warehouse *</Label>
                  <Select
                    value={adhocOrderData.warehouseId}
                    onValueChange={(value) => setAdhocOrderData({ ...adhocOrderData, warehouseId: value })}
                  >
                    <SelectTrigger id="warehouse-select">
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
                    <SelectTrigger id="host-select">
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
                    <label key={swagItem.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adhocOrderData.swagItemIds.includes(swagItem.id)}
                        className="cursor-pointer"
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
              
              {lastOrderResponse && (
                <div className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📤 GraphQL Query Sent</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {lastOrderResponse.request?.graphqlQuery || 'Query not available'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📦 Original Request Data</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(lastOrderResponse.request?.originalData, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📥 ShipHero Response</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(lastOrderResponse.response, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adhoc Purchase Order Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create Adhoc Purchase Order</CardTitle>
          <CardDescription>
            Create a test purchase order using existing warehouse, host, and swag item data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              if (!showAdhocPO) {
                await loadAdhocOrderData()
              }
              setShowAdhocPO(!showAdhocPO)
            }}
            variant="outline"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {showAdhocPO ? "Hide" : "Create Adhoc Purchase Order"}
          </Button>

          {showAdhocPO && (
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
              
              <div className="grid gap-2 mb-4">
                <Label htmlFor="po-date">Purchase Order Date *</Label>
                <Input
                  id="po-date"
                  type="date"
                  value={adhocPOData.poDate}
                  onChange={(e) => setAdhocPOData({...adhocPOData, poDate: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="po-warehouse-select">Warehouse *</Label>
                  <Select
                    value={adhocPOData.warehouseId}
                    onValueChange={(value) => setAdhocPOData({ ...adhocPOData, warehouseId: value })}
                  >
                    <SelectTrigger id="po-warehouse-select">
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
                  <Label htmlFor="po-host-select">Host *</Label>
                  <Select
                    value={adhocPOData.hostId}
                    onValueChange={(value) => setAdhocPOData({ ...adhocPOData, hostId: value })}
                  >
                    <SelectTrigger id="po-host-select">
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
                <div className="space-y-3">
                  {swagItems.map((swagItem) => (
                    <div key={swagItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`po-swag-${swagItem.id}`}
                          checked={adhocPOData.swagItemIds.includes(swagItem.id)}
                          className="cursor-pointer"
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...adhocPOData.swagItemIds, swagItem.id]
                              : adhocPOData.swagItemIds.filter(id => id !== swagItem.id)
                            
                            // Reset quantity when unchecking
                            const newQuantities = { ...adhocPOData.swagQuantities }
                            if (!e.target.checked) {
                              delete newQuantities[swagItem.id]
                            } else {
                              newQuantities[swagItem.id] = 1 // Default to 1
                            }
                            
                            setAdhocPOData({ 
                              ...adhocPOData, 
                              swagItemIds: newIds,
                              swagQuantities: newQuantities
                            })
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`po-swag-${swagItem.id}`} className="text-sm font-medium cursor-pointer">
                          {swagItem.name} ({swagItem.sku})
                        </Label>
                      </div>
                      
                      {adhocPOData.swagItemIds.includes(swagItem.id) && (
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm text-gray-600">Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="999"
                            value={adhocPOData.swagQuantities[swagItem.id] || 1}
                            onChange={(e) => {
                              const quantity = Math.max(1, parseInt(e.target.value) || 1)
                              setAdhocPOData({
                                ...adhocPOData,
                                swagQuantities: {
                                  ...adhocPOData.swagQuantities,
                                  [swagItem.id]: quantity
                                }
                              })
                            }}
                            className="w-20 h-8"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="po-notes">Notes</Label>
                <Textarea
                  id="po-notes"
                  placeholder="Optional notes for the purchase order..."
                  value={adhocPOData.notes}
                  onChange={(e) => setAdhocPOData({ ...adhocPOData, notes: e.target.value })}
                />
              </div>

              <Button
                onClick={handleCreateAdhocPO}
                disabled={isCreatingPO || !adhocPOData.warehouseId || !adhocPOData.hostId || adhocPOData.swagItemIds.length === 0}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreatingPO ? "Creating Purchase Order..." : "Create Purchase Order"}
              </Button>
              
              {lastPOResponse && (
                <div className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📤 GraphQL Query Sent</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {lastPOResponse.request?.graphqlQuery || 'Query not available'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📦 Original Request Data</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(lastPOResponse.request?.originalData, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📥 ShipHero Response</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(lastPOResponse.response, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-green-600 text-2xl">🎉</span>
              Access Token Generated Successfully!
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>Your new ShipHero access token has been generated and is now active.</p>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 font-medium">✅ Token Details:</span>
                </div>
                <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
                  <li>• <strong>Validity:</strong> 28 days from now</li>
                  <li>• <strong>Expires:</strong> {tokenExpiresAt ? new Date(tokenExpiresAt).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Unknown'}</li>
                  <li>• <strong>Status:</strong> Active & ready for use</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 font-medium">⏰ Live Countdown:</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  The countdown timer has been reset and is now actively tracking your token expiration in real-time!
                </p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                You can now use all ShipHero features. Remember to generate a new token before this one expires!
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              onClick={() => setShowSuccessModal(false)}
              className="bg-green-600 hover:bg-green-700"
            >
              Awesome! Let's Go 🚀
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Package, Plus, Trash2, ShoppingCart } from "lucide-react"

interface Product {
  id: string
  sku: string
  name: string
  available: number
  warehouse_id: string
  warehouse_name: string
}

interface OrderItem {
  product: Product
  quantity: number
}

interface Warehouse {
  id: string
  name: string
  code: string
}

interface Host {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function SimpleOrderCreator() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [hosts, setHosts] = useState<Host[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [selectedHost, setSelectedHost] = useState<string>("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  
  const { toast } = useToast()
  const supabase = createClient()

  // Load warehouses and hosts on mount
  useEffect(() => {
    loadWarehousesAndHosts()
  }, [])

  // Load products when warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      loadProducts()
    } else {
      setProducts([])
      setOrderItems([])
    }
  }, [selectedWarehouse])

  const loadWarehousesAndHosts = async () => {
    try {
      // Load warehouses from ShipHero API and sync to database
      const { tokenManager } = await import('@/lib/shiphero/token-manager')
      const accessToken = await tokenManager.getValidAccessToken()
      
      if (accessToken) {
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
          
          // Sync warehouses to database using upsert
          const warehousesToUpsert = shipHeroWarehouses.map((warehouse: any) => ({
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
          
          const { data: syncedWarehouses, error: syncError } = await supabase
            .from('warehouses')
            .upsert(warehousesToUpsert, {
              onConflict: 'shiphero_warehouse_id',
              ignoreDuplicates: false
            })
            .select('id, name, code, address, address2, city, state, zip, country, shiphero_warehouse_id')
          
          if (!syncError) {
            setWarehouses(syncedWarehouses || [])
          }
        }
      }

      // Load hosts
      const { data: hostsData, error: hostsError } = await supabase
        .from("team_members")
        .select("*")
        .order("first_name")

      if (hostsError) throw hostsError
      setHosts(hostsData || [])

    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load warehouses and hosts",
        variant: "destructive",
      })
    }
  }

  const loadProducts = async () => {
    if (!selectedWarehouse) return
    
    setIsLoadingProducts(true)
    try {
      const response = await fetch('/api/shiphero/inventory')
      if (!response.ok) throw new Error('Failed to fetch products')
      
      const data = await response.json()
      
      // Filter products for selected warehouse
      const warehouse = warehouses.find(w => w.id === selectedWarehouse)
      const filteredProducts = data.products
        .filter((p: any) => p.warehouse_identifier === warehouse?.code)
        .map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          available: p.inventory?.available || 0,
          warehouse_id: selectedWarehouse,
          warehouse_name: warehouse?.name || ''
        }))
        .filter((p: Product) => p.available > 0) // Only show products with inventory
        .sort((a, b) => a.name.localeCompare(b.name))

      setProducts(filteredProducts)
      
    } catch (error) {
      console.error("Error loading products:", error)
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const addProductToOrder = (product: Product) => {
    const existing = orderItems.find(item => item.product.sku === product.sku)
    if (existing) {
      toast({
        title: "Product already added",
        description: "This product is already in your order",
        variant: "destructive",
      })
      return
    }

    setOrderItems(prev => [...prev, { product, quantity: 1 }])
  }

  const updateQuantity = (sku: string, quantity: number) => {
    if (quantity < 1) return
    
    setOrderItems(prev => 
      prev.map(item => 
        item.product.sku === sku 
          ? { ...item, quantity: Math.min(quantity, item.product.available) }
          : item
      )
    )
  }

  const removeProduct = (sku: string) => {
    setOrderItems(prev => prev.filter(item => item.product.sku !== sku))
  }

  const createPurchaseOrder = async () => {
    if (!selectedWarehouse || !selectedHost || orderItems.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select warehouse, host, and at least one product",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouse)
      const host = hosts.find(h => h.id === selectedHost)

      // Create line items for PO
      const lineItems = orderItems.map(item => ({
        sku: item.product.sku,
        quantity: item.quantity,
        expected_weight_in_lbs: "1.00",
        vendor_id: "1076735", // Default vendor
        quantity_received: 0,
        quantity_rejected: 0,
        price: "0.00",
        product_name: item.product.name,
        fulfillment_status: "Tour_Orders",
        sell_ahead: 0
      }))

      // Generate PO number
      const poNumber = `PO-${host?.first_name}-${host?.last_name}-${warehouse?.code}-${Date.now()}`

      const poData = {
        po_number: poNumber,
        warehouse_id: warehouse?.code,
        vendor_id: "1076735",
        po_date: new Date().toISOString().split('T')[0],
        fulfillment_status: "Tour_Orders",
        order_type: "purchase_order",
        priority_flag: false,
        po_note: notes || `Tour PO for ${host?.first_name} ${host?.last_name}`,
        line_items: lineItems
      }

      console.log('Creating PO:', poData)

      const response = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'purchase_order',
          data: poData
        })
      })

      if (!response.ok) throw new Error('Failed to create purchase order')
      
      const result = await response.json()
      
      toast({
        title: "Success",
        description: `Purchase Order ${poNumber} created successfully`,
      })

      // Reset form
      setOrderItems([])
      setNotes("")
      
    } catch (error) {
      console.error("Error creating PO:", error)
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createSalesOrder = async () => {
    if (!selectedWarehouse || !selectedHost || orderItems.length === 0) {
      toast({
        title: "Missing Information", 
        description: "Please select warehouse, host, and at least one product",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouse)
      const host = hosts.find(h => h.id === selectedHost)

      // Create line items for Sales Order
      const lineItems = orderItems.map(item => ({
        sku: item.product.sku,
        quantity: item.quantity,
        price: "0.00"
      }))

      // Generate order number
      const orderNumber = `SO-${host?.first_name}-${host?.last_name}-${warehouse?.code}-${Date.now()}`

      const orderData = {
        order_number: orderNumber,
        shop_name: "Tour Orders",
        fulfillment_status: "Tour_Orders",
        order_date: new Date().toISOString(),
        total_tax: "0.00",
        subtotal: "0.00", 
        total_discounts: "0.00",
        total_price: "0.00",
        warehouse_id: warehouse?.code,
        required_ship_date: new Date().toISOString().split('T')[0], // Default to today for manual orders
        shipping_address: {
          first_name: host?.first_name,
          last_name: host?.last_name,
          company: "Tour Participant",
          address1: warehouse?.name,
          city: "Tour Location",
          state: "CA",
          zip: "90210",
          country: "US",
          email: host?.email
        },
        billing_address: {
          first_name: host?.first_name,
          last_name: host?.last_name,
          company: "Tour Participant", 
          address1: warehouse?.name,
          city: "Tour Location",
          state: "CA", 
          zip: "90210",
          country: "US",
          email: host?.email
        },
        line_items: lineItems
      }

      console.log('Creating Sales Order:', orderData)

      const response = await fetch('/api/shiphero/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sales_order',
          data: orderData
        })
      })

      if (!response.ok) throw new Error('Failed to create sales order')
      
      const result = await response.json()
      
      toast({
        title: "Success",
        description: `Sales Order ${orderNumber} created successfully`,
      })

      // Reset form
      setOrderItems([])
      setNotes("")
      
    } catch (error) {
      console.error("Error creating Sales Order:", error)
      toast({
        title: "Error", 
        description: "Failed to create sales order",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-600" />
          Simple Order Creator
        </h1>
        <p className="text-slate-600">Select products, set quantities, and create purchase orders or sales orders.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Warehouse & Host Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Select warehouse and host for the order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Select value={selectedHost} onValueChange={setSelectedHost}>
                <SelectTrigger>
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map(host => (
                    <SelectItem key={host.id} value={host.id}>
                      {host.first_name} {host.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Available Products</CardTitle>
            <CardDescription>
              {selectedWarehouse ? "Click to add products to your order" : "Select a warehouse first"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedWarehouse ? (
              <p className="text-muted-foreground text-center py-8">Select a warehouse to load products</p>
            ) : isLoadingProducts ? (
              <p className="text-muted-foreground text-center py-8">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No products with inventory found</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map(product => (
                  <div 
                    key={product.sku}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => addProductToOrder(product)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{product.available} available</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      {orderItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Items ({orderItems.length})</CardTitle>
            <CardDescription>Review and adjust quantities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderItems.map(item => (
                <div key={item.product.sku} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">{item.product.sku}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`qty-${item.product.sku}`} className="text-sm">Qty:</Label>
                    <Input
                      id={`qty-${item.product.sku}`}
                      type="number"
                      min="1"
                      max={item.product.available}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product.sku, parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">/ {item.product.available}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeProduct(item.product.sku)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t">
              <Button 
                onClick={createPurchaseOrder}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Creating..." : "Create Purchase Order"}
              </Button>
              <Button 
                onClick={createSalesOrder}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {isLoading ? "Creating..." : "Create Sales Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

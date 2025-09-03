"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Product {
  sku: string
  name: string
  active: boolean
  price: string
  kit: boolean
  kit_build: boolean
  inventory: {
    available: number
    on_hand: number
    allocated: number
    warehouse_id: string | null
    warehouse_identifier: string | null
    warehouse_name: string
  }
}

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  const handleFetchProducts = async () => {
    setIsLoading(true)
    console.log('📦 Fetching products from ShipHero...')
    
    try {
      // Get access token from localStorage
      const accessToken = localStorage.getItem('shiphero_access_token')
      
      if (!accessToken) {
        throw new Error('No access token available. Please generate a new access token in the ShipHero tab first.')
      }

      console.log('🔍 Using access token from localStorage')

      const response = await fetch('/api/shiphero/inventory', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('📦 Products API response:', {
        status: response.status,
        ok: response.ok
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('❌ Products API error details:', {
          status: response.status,
          error: result.error,
          details: result.details,
          fullResult: result
        })
        
        if (result.details && Array.isArray(result.details)) {
          console.error('🚨 ShipHero specific errors:', result.details)
          result.details.forEach((error: any, index: number) => {
            console.error(`Error ${index + 1}:`, error)
          })
        }
        
        throw new Error(result.error || 'Failed to fetch products')
      }

      if (result.success && result.products) {
        setProducts(result.products)
        setLastUpdated(new Date())
        
        toast({
          title: "Products Loaded",
          description: `Found ${result.products.length} products (${result.products.filter((p: Product) => p.inventory.available > 0).length} with available inventory)`,
        })

        console.log('✅ Products loaded successfully:', {
          totalProducts: result.products.length,
          productsWithInventory: result.products.filter((p: Product) => p.inventory.available > 0).length
        })
      } else {
        throw new Error('Invalid response format')
      }

    } catch (error: any) {
      console.error('❌ Failed to fetch products:', error)
      toast({
        title: "Failed to Load Products",
        description: error.message,
        variant: "destructive",
      })
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load products on component mount if access token exists
  useEffect(() => {
    const accessToken = localStorage.getItem('shiphero_access_token')
    if (accessToken && products.length === 0) {
      console.log('🔄 Auto-loading products on component mount')
      handleFetchProducts()
    }
  }, [])

  const activeProducts = products.filter(p => p.active)
  const productsWithInventory = products.filter(p => p.inventory.available > 0)
  const productsWithoutWarehouse = products.filter(p => !p.inventory.warehouse_id)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Catalog
          </CardTitle>
          <CardDescription>
            View all products from your ShipHero account with real-time inventory levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleFetchProducts} 
                disabled={isLoading}
                className="cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading Products...' : 'Refresh Products'}
              </Button>
              
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Badge variant="outline">
                Total: {products.length}
              </Badge>
              <Badge variant="outline">
                Active: {activeProducts.length}
              </Badge>
              <Badge variant="outline">
                Available: {productsWithInventory.length}
              </Badge>
              {productsWithoutWarehouse.length > 0 && (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Warehouse: {productsWithoutWarehouse.length}
                </Badge>
              )}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products loaded yet.</p>
              <p className="text-sm">Click "Refresh Products" to load your ShipHero product catalog.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">SKU</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-24 text-center">Available</TableHead>
                    <TableHead className="w-24 text-center">On Hand</TableHead>
                    <TableHead className="w-24 text-center">Allocated</TableHead>
                    <TableHead className="w-40">Warehouse</TableHead>
                    <TableHead className="w-24 text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
                    <TableRow key={product.sku || index}>
                      <TableCell className="font-mono text-xs">
                        {product.sku}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name || 'Unnamed Product'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.active ? "default" : "secondary"}>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <span className={product.inventory.available > 0 ? "text-green-600" : "text-muted-foreground"}>
                          {product.inventory.available}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {product.inventory.on_hand}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {product.inventory.allocated}
                      </TableCell>
                      <TableCell className="text-sm">
                        {product.inventory.warehouse_name || product.inventory.warehouse_identifier || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {product.price ? `$${product.price}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

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
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)
  const { toast } = useToast()

  const handleFetchProducts = async (autoRefresh = false) => {
    setIsLoading(true)
    setIsAutoRefresh(autoRefresh)
    console.log(`📦 ${autoRefresh ? 'Auto-' : ''}Fetching products from ShipHero...`)
    
    try {
      // Use centralized data service for better caching and performance
      const { shipHeroDataService } = await import('@/lib/shiphero/data-service')
      const activeProducts = await shipHeroDataService.getActiveProducts(!autoRefresh) // Force refresh for manual requests
      
      // Sort by available quantity (highest to lowest)
      const sortedProducts = activeProducts
        .sort((a, b) => b.inventory.available - a.inventory.available)
      
      setProducts(sortedProducts)
      setLastUpdated(new Date())
      
      // Only show toast for manual refresh, not auto-refresh
      if (!autoRefresh) {
        toast({
          title: "Products Loaded",
          description: `Found ${sortedProducts.length} active products (${sortedProducts.filter(p => p.inventory.available > 0).length} with available inventory)`,
        })
      }

      console.log('✅ Products loaded and sorted by available quantity:', {
        totalProducts: sortedProducts.length,
        productsWithInventory: sortedProducts.filter(p => p.inventory.available > 0).length,
        topAvailableQuantities: sortedProducts.slice(0, 5).map(p => `${p.sku}: ${p.inventory.available}`),
        cached: autoRefresh // Auto-refresh likely uses cache
      })

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
      setIsAutoRefresh(false)
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

  // Auto-refresh every hour during business hours (8 AM - 8 PM Eastern)
  useEffect(() => {
    const checkAndRefresh = () => {
      const now = new Date()
      const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
      const hour = easternTime.getHours()
      
      // Only refresh between 8 AM and 8 PM Eastern
      if (hour >= 8 && hour < 20) {
        const accessToken = localStorage.getItem('shiphero_access_token')
        if (accessToken && products.length > 0) {
          console.log(`🕐 Auto-refreshing products at ${easternTime.toLocaleTimeString()} ET (${hour}:00)`)
          handleFetchProducts(true) // Pass true for auto-refresh
        }
      } else {
        console.log(`⏸️ Outside business hours (${hour}:00 ET) - skipping auto-refresh`)
      }
    }

    // Set up hourly interval
    const interval = setInterval(checkAndRefresh, 60 * 60 * 1000) // Every hour

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [products.length]) // Re-run when products change (to avoid refreshing empty state)

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
            View active products from your ShipHero account with real-time inventory levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => handleFetchProducts(false)} 
                disabled={isLoading}
                className="cursor-pointer"
                variant="default"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading 
                  ? (isAutoRefresh ? 'Auto-Refreshing...' : 'Refreshing...')
                  : 'Refresh Inventory'
                }
              </Button>
              
              <div className="flex flex-col gap-1">
                {lastUpdated && (
                  <span className="text-sm text-muted-foreground">
                    Last updated: {lastUpdated.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Auto-refreshes hourly (8 AM - 8 PM ET)
                </span>
              </div>
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
                    <TableHead className="w-[15%]">SKU</TableHead>
                    <TableHead className="w-[35%]">Product Name</TableHead>
                    <TableHead className="w-[15%] text-center">Available</TableHead>
                    <TableHead className="w-[12%] text-center hidden md:table-cell">On Hand</TableHead>
                    <TableHead className="w-[12%] text-center hidden lg:table-cell">Allocated</TableHead>
                    <TableHead className="w-[11%] hidden xl:table-cell">Warehouse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
                    <TableRow key={product.sku || index}>
                      <TableCell className="font-mono text-xs">
                        <div className="truncate" title={product.sku}>
                          {product.sku}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="truncate" title={product.name || 'Unnamed Product'}>
                          {product.name || 'Unnamed Product'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <div className="space-y-1">
                          <span className={product.inventory.available > 0 ? "text-green-600" : "text-muted-foreground"}>
                            {product.inventory.available}
                          </span>
                          {/* Show additional info on mobile */}
                          <div className="md:hidden text-xs text-muted-foreground">
                            On Hand: {product.inventory.on_hand} | Allocated: {product.inventory.allocated}
                          </div>
                          <div className="xl:hidden text-xs text-muted-foreground truncate">
                            {product.inventory.warehouse_name || product.inventory.warehouse_identifier || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden md:table-cell">
                        {product.inventory.on_hand}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden lg:table-cell">
                        {product.inventory.allocated}
                      </TableCell>
                      <TableCell className="text-sm hidden xl:table-cell">
                        <div className="truncate" title={product.inventory.warehouse_name || product.inventory.warehouse_identifier || 'N/A'}>
                          {product.inventory.warehouse_name || product.inventory.warehouse_identifier || 'N/A'}
                        </div>
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

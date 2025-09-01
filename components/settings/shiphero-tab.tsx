"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Save, ExternalLink, RefreshCw, TestTube, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createShipHeroClient } from "@/lib/shiphero/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ShipHeroTab() {
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [showTokens, setShowTokens] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [showTestResults, setShowTestResults] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Load tokens from localStorage on component mount
    const savedAccessToken = localStorage.getItem('shiphero_access_token') || ''
    const savedRefreshToken = localStorage.getItem('shiphero_refresh_token') || ''
    setAccessToken(savedAccessToken)
    setRefreshToken(savedRefreshToken)
  }, [])

  const handleSaveTokens = async () => {
    console.log('Save tokens clicked', { accessToken: accessToken ? '***' : 'empty', refreshToken: refreshToken ? '***' : 'empty' })
    setIsSaving(true)
    try {
      // Save tokens to localStorage (in production, consider a more secure approach)
      localStorage.setItem('shiphero_access_token', accessToken)
      localStorage.setItem('shiphero_refresh_token', refreshToken)
      
      console.log('Tokens saved to localStorage')
      
      toast({
        title: "Success",
        description: "ShipHero tokens saved successfully",
      })
    } catch (error) {
      console.error('Error saving tokens:', error)
      toast({
        title: "Error",
        description: "Failed to save tokens",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTokenVisibility = () => {
    setShowTokens(!showTokens)
  }

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      console.log('Refreshing token via API route...')
      
      // Use our API route to avoid CORS issues
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
        
        // Update the access token
        setAccessToken(newAccessToken)
        localStorage.setItem('shiphero_access_token', newAccessToken)
        
        toast({
          title: "Token Refreshed",
          description: "Access token has been successfully refreshed",
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to refresh token')
      }
    } catch (error: any) {
      console.error('Token refresh error:', error)
      toast({
        title: "Token Refresh Failed",
        description: error.message || "Failed to refresh access token. Please check your refresh token.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleConnectionTest = async () => {
    setIsTesting(true)
    try {
      console.log('Starting connection test...')
      console.log('Access token available:', !!accessToken)
      console.log('Refresh token available:', !!refreshToken)
      
      // Use our API route to avoid CORS issues
      console.log('Testing via API route...')
      console.log('API URL:', '/api/shiphero/warehouses')
      console.log('Access token:', accessToken ? 'Present' : 'Missing')
      
      const response = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Fetch response status:', response.status)
      console.log('Fetch response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('Direct fetch result:', result)
      
      setTestResults(result)
      setShowTestResults(true)
      
      toast({
        title: "Connection Test Successful",
        description: `Found ${result.data?.account?.data?.warehouses?.length || 0} warehouses in ShipHero`,
      })
    } catch (error: any) {
      console.error('Connection test error:', error)
      setTestResults({ error: error.message, details: error })
      setShowTestResults(true)
      
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to ShipHero API",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">ShipHero Integration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your ShipHero API credentials to enable order creation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Credentials</CardTitle>
          <CardDescription>
            Enter your ShipHero access and refresh tokens. You can find these in your ShipHero dashboard under Settings → API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="access-token">Access Token</Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showTokens ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter your ShipHero access token"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={toggleTokenVisibility}
                >
                  {showTokens ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="refresh-token">Refresh Token</Label>
              <div className="relative">
                <Input
                  id="refresh-token"
                  type={showTokens ? "text" : "password"}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Enter your ShipHero refresh token"
                  className="pr-10"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveTokens}
                disabled={isSaving || !accessToken || !refreshToken}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Tokens"}
              </Button>
              
              <Button
                onClick={handleRefreshToken}
                disabled={isRefreshing || !refreshToken}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Refreshing..." : "Refresh Token"}
              </Button>
            </div>
            
            <Button variant="outline" asChild>
              <a 
                href="https://public-api.shiphero.com/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                ShipHero API Docs
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection Test</CardTitle>
          <CardDescription>
            Test your ShipHero API connection and view available warehouses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleConnectionTest}
            disabled={isTesting || !accessToken}
            className="w-full"
          >
            <TestTube className={`h-4 w-4 mr-2 ${isTesting ? 'animate-pulse' : ''}`} />
            {isTesting ? "Testing Connection..." : "Test Connection"}
          </Button>

          {testResults && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => setShowTestResults(!showTestResults)}
                className="w-full"
              >
                {showTestResults ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Test Results
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show Test Results
                  </>
                )}
              </Button>

              {showTestResults && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium mb-3">Test Results:</h4>
                  
                  {testResults.error ? (
                    <div className="text-red-600 text-sm space-y-2">
                      <div><strong>Error:</strong> {testResults.error}</div>
                      {testResults.details && (
                        <div className="text-xs text-muted-foreground">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(testResults.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ) : testResults.data?.account?.data?.warehouses ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Found {testResults.data.account.data.warehouses.length} warehouses:
                      </p>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Identifier</TableHead>
                              <TableHead>Address</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testResults.data.account.data.warehouses.map((warehouse: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-xs">{warehouse.id}</TableCell>
                                <TableCell>{warehouse.address?.name || 'N/A'}</TableCell>
                                <TableCell>{warehouse.identifier || 'N/A'}</TableCell>
                                <TableCell className="text-sm">
                                  {warehouse.address ? (
                                    <div>
                                      <div>{warehouse.address.address1}</div>
                                      {warehouse.address.city && warehouse.address.state && (
                                        <div className="text-muted-foreground">
                                          {warehouse.address.city}, {warehouse.address.state}
                                        </div>
                                      )}
                                    </div>
                                  ) : 'No address'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(testResults, null, 2)}</pre>
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
          <CardTitle>Integration Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Create sales orders for individual participants</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Generate purchase orders for tour inventory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Automatic order creation when tours are finalized</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log into your ShipHero account</li>
            <li>Navigate to Settings → API Settings</li>
            <li>Generate or copy your Access Token and Refresh Token</li>
            <li>Paste the tokens above and click "Save Tokens"</li>
            <li>Ensure your warehouses have ShipHero Warehouse IDs configured</li>
            <li>Make sure your swag items have valid SKUs that exist in ShipHero</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

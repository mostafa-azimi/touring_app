"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, RefreshCw, Eye, EyeOff, Copy, Check, TestTube } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

export function ShipHeroTab() {
  const [refreshToken, setRefreshToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    const savedToken = localStorage.getItem('shiphero_refresh_token') || ''
    setRefreshToken(savedToken)
  }, [])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Token copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
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
          // Store the new access token temporarily for display
          setNewToken(newAccessToken)
          
          // Calculate expiration date
          const expirationDate = new Date(Date.now() + (expiresIn * 1000))
          
          toast({
            title: "Token Refreshed Successfully",
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
      
      // Now test the connection with the access token
      const response = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      setTestResults(result)
      
      toast({
        title: "Connection Test Successful",
        description: `Found ${result.data?.account?.data?.warehouses?.length || 0} warehouses in ShipHero`,
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

          {newToken && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">New Access Token Generated</h4>
              <p className="text-sm text-green-700 mb-3">
                This access token is valid for 28 days. The refresh token remains the same.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={newToken}
                  readOnly
                  className="font-mono text-xs bg-white"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(newToken)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
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
                  
                  {testResults.data?.account?.data?.warehouses && testResults.data.account.data.warehouses.length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testResults.data.account.data.warehouses.map((warehouse: any, index: number) => (
                            <TableRow key={warehouse.id || index}>
                              <TableCell className="font-mono text-xs">{warehouse.id}</TableCell>
                              <TableCell className="font-medium">{warehouse.name}</TableCell>
                              <TableCell className="font-mono text-xs">{warehouse.code || '-'}</TableCell>
                              <TableCell className="text-sm">
                                {warehouse.address ? (
                                  <div>
                                    <div>{warehouse.address}</div>
                                    {warehouse.city && warehouse.state && (
                                      <div className="text-muted-foreground">
                                        {warehouse.city}, {warehouse.state} {warehouse.zip}
                                      </div>
                                    )}
                                  </div>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
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
    </div>
  )
}
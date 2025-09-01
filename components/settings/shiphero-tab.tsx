"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ShipHeroTab() {
  const [refreshToken, setRefreshToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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
        const newRefreshToken = data.refresh_token || refreshToken
        
        setRefreshToken(newRefreshToken)
        localStorage.setItem('shiphero_refresh_token', newRefreshToken)
        setNewToken(newRefreshToken)
        
        toast({
          title: "Token Refreshed",
          description: "New refresh token generated",
        })
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ShipHero API</CardTitle>
          <CardDescription>
            Manage your ShipHero refresh token for order creation
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
                onChange={(e) => setRefreshToken(e.target.value)}
                className="font-mono text-xs"
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
              {isRefreshing ? "Refreshing..." : "Refresh Token"}
            </Button>
          </div>

          {newToken && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">New Token Generated</h4>
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
        </CardContent>
      </Card>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Save, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ShipHeroTab() {
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [showTokens, setShowTokens] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Load tokens from localStorage on component mount
    const savedAccessToken = localStorage.getItem('shiphero_access_token') || ''
    const savedRefreshToken = localStorage.getItem('shiphero_refresh_token') || ''
    setAccessToken(savedAccessToken)
    setRefreshToken(savedRefreshToken)
  }, [])

  const handleSaveTokens = async () => {
    setIsSaving(true)
    try {
      // Save tokens to localStorage (in production, consider a more secure approach)
      localStorage.setItem('shiphero_access_token', accessToken)
      localStorage.setItem('shiphero_refresh_token', refreshToken)
      
      toast({
        title: "Success",
        description: "ShipHero tokens saved successfully",
      })
    } catch (error) {
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

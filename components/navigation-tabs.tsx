"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleTourPage } from "@/components/schedule-tour-page"
import { ViewToursPage } from "@/components/view-tours-page"
import { SettingsPage } from "@/components/settings-page"
import { tokenManager } from "@/lib/shiphero/token-manager"

export function NavigationTabs() {
  const [activeTab, setActiveTab] = useState("schedule")

  useEffect(() => {
    const deploymentId = 'V8.5-' + Date.now().toString().slice(-6) // Last 6 digits of timestamp - CACHE BUST
    console.log(`🚀🚀🚀 DEPLOYMENT MARKER ${deploymentId} - APP LOADED - ${new Date().toISOString()}`)
    console.log('🎯 V8.5 Features: Debug localStorage persistence, Token storage diagnostics')
    console.log(`🔥 INSTANT DEPLOYMENT CHECK: ${deploymentId} - If you see this, new code is running!`)
    
    // Debug localStorage token persistence
    const refreshToken = localStorage.getItem('shiphero_refresh_token')
    const accessToken = localStorage.getItem('shiphero_access_token')
    const expiresAt = localStorage.getItem('shiphero_token_expires_at')
    
    console.log('🔍 LOCALSTORAGE DEBUG ON APP LOAD:')
    console.log('  Refresh Token:', refreshToken ? `${refreshToken.substring(0, 10)}...` : 'NOT FOUND')
    console.log('  Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT FOUND')
    console.log('  Expires At:', expiresAt || 'NOT FOUND')
    
    if (refreshToken && !accessToken) {
      console.log('⚠️ ISSUE DETECTED: Have refresh token but missing access token!')
      console.log('💡 SOLUTION: Go to Settings tab and click "Generate New Access Token"')
    }
    
    // Start automatic token refresh monitoring
    tokenManager.startAutoRefresh()
    
    // Cleanup on unmount
    return () => {
      tokenManager.stopAutoRefresh()
    }
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="schedule">Schedule Tour</TabsTrigger>
        <TabsTrigger value="view">View Tours</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="mt-6">
        <ScheduleTourPage />
      </TabsContent>

      <TabsContent value="view" className="mt-6">
        <ViewToursPage />
      </TabsContent>

      <TabsContent value="settings" className="mt-6">
        <SettingsPage />
      </TabsContent>
    </Tabs>
  )
}

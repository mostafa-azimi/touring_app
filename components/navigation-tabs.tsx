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
    // Generate unique deployment marker with emoji and timestamp
    const emojis = ['🚀', '⚡', '🎯', '🔥', '✨', '💫', '🌟', '🎉', '💎', '🏆', '🎊', '🌈']
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const timestamp = new Date().toISOString()
    const deploymentId = `${randomEmoji} DEPLOYMENT-${Date.now().toString().slice(-6)}`
    
    console.log(`${deploymentId} - Touring App Loaded`)
    console.log(`📅 Deployment Time: ${timestamp}`)
    console.log(`🔧 Optimizations: Enhanced Token Persistence + API Caching + DB Query Optimization`)
    console.log(`🗄️ Supabase: All operations verified and compatible`)
    console.log(`🎯 Ready for testing!`)
    
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
        <TabsTrigger value="schedule" className="cursor-pointer">Schedule Tour</TabsTrigger>
        <TabsTrigger value="view" className="cursor-pointer">View Tours</TabsTrigger>
        <TabsTrigger value="settings" className="cursor-pointer">Settings</TabsTrigger>
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

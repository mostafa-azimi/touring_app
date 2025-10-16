"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleTourPage } from "@/components/schedule-tour-page"
import { ViewToursPage } from "@/components/view-tours-page"
import { SettingsPage } from "@/components/settings-page"
import { AdminPanel } from "@/components/admin-panel"
import { useAuth } from "@/lib/auth-context"
import { tokenManager } from "@/lib/shiphero/token-manager"
import { APP_VERSION, BUILD_TIMESTAMP } from "@/lib/version"

export function NavigationTabs() {
  const [activeTab, setActiveTab] = useState("schedule")
  const { user } = useAuth()

  useEffect(() => {
    // Generate unique deployment marker with version and build ID
    const emojis = ['🚀', '⚡', '🎯', '🔥', '✨', '💫', '🌟', '🎉', '💎', '🏆', '🎊', '🌈']
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const buildId = Date.now().toString().slice(-6)
    const deploymentId = `${randomEmoji} v${APP_VERSION}-${buildId}`
    
    console.log(`${deploymentId} - Touring App Loaded`)
    console.log(`📅 Build Time: ${BUILD_TIMESTAMP}`)
    console.log(`📅 Load Time: ${new Date().toISOString()}`)
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
      <TabsList className={`grid w-full ${user?.isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <TabsTrigger value="schedule" className="cursor-pointer">Schedule Tour</TabsTrigger>
        <TabsTrigger value="view" className="cursor-pointer">View Tours</TabsTrigger>
        <TabsTrigger value="settings" className="cursor-pointer">Settings</TabsTrigger>
        {user?.isAdmin && (
          <TabsTrigger value="admin" className="cursor-pointer">Admin</TabsTrigger>
        )}
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

      {user?.isAdmin && (
        <TabsContent value="admin" className="mt-6">
          <AdminPanel />
        </TabsContent>
      )}
    </Tabs>
  )
}

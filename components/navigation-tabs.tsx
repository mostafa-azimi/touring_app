"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleTourPage } from "@/components/schedule-tour-page"
import { ViewToursPage } from "@/components/view-tours-page"
import { SettingsPage } from "@/components/settings-page"

export function NavigationTabs() {
  const [activeTab, setActiveTab] = useState("schedule")

  useEffect(() => {
    const deploymentId = 'V8.1-' + Date.now().toString().slice(-6) // Last 6 digits of timestamp
    console.log(`🚀🚀🚀 DEPLOYMENT MARKER ${deploymentId} - APP LOADED - ${new Date().toISOString()}`)
    console.log('🎯 V8.1 Features: Warehouse sync fixed, JS errors fixed, Full tour finalization working, Unique deployment markers')
    console.log(`🔥 INSTANT DEPLOYMENT CHECK: ${deploymentId} - If you see this, new code is running!`)
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

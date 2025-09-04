"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleTourPage } from "@/components/schedule-tour-page"
import { ViewToursPage } from "@/components/view-tours-page"
import { SettingsPage } from "@/components/settings-page"

export function NavigationTabs() {
  const [activeTab, setActiveTab] = useState("schedule")

  useEffect(() => {
    console.log('🚀🚀🚀 DEPLOYMENT MARKER V7 - APP LOADED - TIMESTAMP:', new Date().toISOString())
    console.log('🎯 V7 Features: CORS Fixed, All SKUs from UI, No hardcoded items')
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

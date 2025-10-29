"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WarehousesTab } from "@/components/settings/warehouses-tab"
import { HostsTab } from "@/components/settings/hosts-tab"
import { ShipHeroTab } from "@/components/settings/shiphero-tab"
import { TenantConfigTab } from "@/components/settings/tenant-config-tab"

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("warehouses")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage warehouses, hosts, and ShipHero integration</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="warehouses" className="cursor-pointer">Warehouses</TabsTrigger>
          <TabsTrigger value="hosts" className="cursor-pointer">Hosts</TabsTrigger>
          <TabsTrigger value="shiphero" className="cursor-pointer">ShipHero</TabsTrigger>
          <TabsTrigger value="config" className="cursor-pointer">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>

        <TabsContent value="hosts">
          <HostsTab />
        </TabsContent>

        <TabsContent value="shiphero">
          <ShipHeroTab />
        </TabsContent>

        <TabsContent value="config">
          <TenantConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WarehousesTab } from "@/components/settings/warehouses-tab"
import { HostsTab } from "@/components/settings/hosts-tab"
import { SwagItemsTab } from "@/components/settings/swag-items-tab"
import { ShipHeroTab } from "@/components/settings/shiphero-tab"

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("warehouses")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage warehouses, hosts, swag items, and ShipHero integration</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="hosts">Hosts</TabsTrigger>
          <TabsTrigger value="swag-items">Swag Items</TabsTrigger>
          <TabsTrigger value="shiphero">ShipHero</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>

        <TabsContent value="hosts">
          <HostsTab />
        </TabsContent>

        <TabsContent value="swag-items">
          <SwagItemsTab />
        </TabsContent>

        <TabsContent value="shiphero">
          <ShipHeroTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WarehousesTab } from "@/components/settings/warehouses-tab"
import { TeamMembersTab } from "@/components/settings/team-members-tab"
import { SwagItemsTab } from "@/components/settings/swag-items-tab"

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("warehouses")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage warehouses, team members, and swag items</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="team-members">Team Members</TabsTrigger>
            <TabsTrigger value="swag-items">Swag Items</TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses" className="mt-6">
            <WarehousesTab />
          </TabsContent>

          <TabsContent value="team-members" className="mt-6">
            <TeamMembersTab />
          </TabsContent>

          <TabsContent value="swag-items" className="mt-6">
            <SwagItemsTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

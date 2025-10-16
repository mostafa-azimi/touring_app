'use client'

import { NavigationTabs } from "@/components/navigation-tabs"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"

function AppHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">ShipHero Warehouse Tours</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.firstName} {user?.lastName}
            {user?.isAdmin && <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Admin</span>}
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}

export function HomePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="container mx-auto px-4 py-6">
          <NavigationTabs />
        </main>
      </div>
    </ProtectedRoute>
  )
}

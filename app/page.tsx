import { NavigationTabs } from "@/components/navigation-tabs"

// Force dynamic rendering to avoid build-time Supabase client creation issues
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">ShipHero Warehouse Tours</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <NavigationTabs />
      </main>
    </div>
  )
}

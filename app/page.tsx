import { NavigationTabs } from "@/components/navigation-tabs"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Warehouse Tours</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <NavigationTabs />
      </main>
    </div>
  )
}

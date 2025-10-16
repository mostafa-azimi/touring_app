import { HomePage } from "@/components/home-page"

// Force dynamic rendering to avoid build-time Supabase client creation issues
export const dynamic = 'force-dynamic'

export default function Page() {
  return <HomePage />
}

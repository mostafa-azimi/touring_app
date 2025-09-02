import { createClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    
    const { data: warehouses, error } = await supabase
      .from('warehouses')
      .select('id, name, code')
      .order('name')
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      warehouses,
      message: 'Warehouse codes from database',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

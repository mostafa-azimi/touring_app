// Quick test to verify warehouse codes in database
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testWarehouseCode() {
  console.log('🔍 Testing warehouse codes...')
  
  const { data: warehouses, error } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .order('name')
  
  if (error) {
    console.error('❌ Error fetching warehouses:', error)
    return
  }
  
  console.log('🏢 Warehouses in database:')
  warehouses.forEach(warehouse => {
    console.log(`  - ${warehouse.name}: code="${warehouse.code}" (${warehouse.code ? '✅' : '❌ MISSING'})`);
  })
}

testWarehouseCode()

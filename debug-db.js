// Quick database debug script
import { createClient } from '@supabase/supabase-js'

// You'll need to add your actual Supabase URL and anon key here
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
  console.log('Testing database connection...')
  
  // Test 1: Check if we can read warehouses
  try {
    const { data: warehouses, error: warehouseError } = await supabase
      .from('warehouses')
      .select('*')
      .limit(1)
    
    console.log('Warehouses test:', { data: warehouses, error: warehouseError })
  } catch (e) {
    console.error('Warehouses error:', e)
  }

  // Test 2: Try to insert a simple warehouse
  try {
    const testWarehouse = {
      name: 'Debug Test Warehouse',
      code: 'DBG',
      address: '123 Debug St',
      city: 'Debug City',
      state: 'CA',
      zip: '12345',
      country: 'US'
    }
    
    const { data, error } = await supabase
      .from('warehouses')
      .insert([testWarehouse])
      .select()
    
    console.log('Insert test:', { data, error })
  } catch (e) {
    console.error('Insert error:', e)
  }
}

testDatabase()

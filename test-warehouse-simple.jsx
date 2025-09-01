// Test component - add this temporarily to test basic warehouse creation
// Copy this into your warehouses-tab.tsx handleSubmit function as a test

const testSimpleWarehouse = {
  name: formData.name,
  address: formData.address || 'Test Address'
};

console.log("Testing simple warehouse insert:", testSimpleWarehouse);

const { data: simpleData, error: simpleError } = await supabase
  .from("warehouses")
  .insert([testSimpleWarehouse])
  .select();

console.log("Simple insert result:", { data: simpleData, error: simpleError });

// If this works, then the issue is with the new fields
// If this fails, then there's a basic connection/permission issue

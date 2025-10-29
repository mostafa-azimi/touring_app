-- Set workflow defaults based on user's screenshot configuration
-- This ensures the defaults match the user's preferred settings

-- Clear any existing tenant_config rows to avoid multiple row issues
DELETE FROM public.tenant_config;

-- Insert the exact configuration from the user's screenshot
INSERT INTO public.tenant_config (
  shiphero_vendor_id,
  shop_name,
  company_name,
  default_fulfillment_status,
  enable_hold_until,
  workflow_defaults,
  created_at,
  updated_at
) VALUES (
  NULL,
  'Tour Orders',
  'Tour Company', 
  'pending',
  false,
  '{
    "standard_receiving": {
      "orderCount": 1,
      "skuQuantities": {
        "Blue Raspberry Airhead": 10,
        "Sour Watermelon Airhead": 10
      }
    },
    "bulk_shipping": {
      "orderCount": 15,
      "skuQuantities": {
        "Swag 4": 1
      }
    },
    "single_item_batch": {
      "orderCount": 5,
      "skuQuantities": {
        "PB_Crackers": 1,
        "Cheese_crackers": 1
      }
    },
    "multi_item_batch": {
      "orderCount": 8,
      "skuQuantities": {
        "Swag 2": 1,
        "Swag 1": 1,
        "Swag 3": 1
      }
    },
    "pack_to_light": {
      "orderCount": 5,
      "skuQuantities": {
        "Graph_composition_book": 1,
        "Wide_Rule_composition": 1
      }
    }
  }'::jsonb,
  NOW(),
  NOW()
);

-- Add comment
COMMENT ON TABLE public.tenant_config IS 'Stores tenant configuration including workflow defaults from user screenshot';

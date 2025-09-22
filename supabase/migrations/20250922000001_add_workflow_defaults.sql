-- Add workflow_defaults column to tenant_config table
-- This will store default configurations for each workflow type that can be loaded when creating tours

ALTER TABLE public.tenant_config 
ADD COLUMN IF NOT EXISTS workflow_defaults JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.tenant_config.workflow_defaults IS 'JSON object containing default workflow configurations including SKU quantities for each workflow type (e.g., {"standard_receiving": {"orderCount": 5, "skuQuantities": {"SKU123": 10}}, "bulk_shipping": {"orderCount": 3, "skuQuantities": {"SKU456": 2}}})';

-- Create an index on workflow_defaults for better query performance
CREATE INDEX IF NOT EXISTS idx_tenant_config_workflow_defaults ON public.tenant_config USING GIN (workflow_defaults);

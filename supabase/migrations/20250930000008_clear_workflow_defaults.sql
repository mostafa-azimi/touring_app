-- Clear workflow defaults to remove stale SKUs
-- Users will need to reconfigure workflows with current SKUs
UPDATE public.tenant_config 
SET workflow_defaults = '{}'::jsonb
WHERE workflow_defaults IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.tenant_config.workflow_defaults IS 'Workflow configurations with SKUs - should only contain current inventory SKUs';


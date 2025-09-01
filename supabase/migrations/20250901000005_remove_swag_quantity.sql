-- Remove quantity column from swag_items since inventory tracking is not needed
ALTER TABLE public.swag_items DROP COLUMN IF EXISTS quantity;

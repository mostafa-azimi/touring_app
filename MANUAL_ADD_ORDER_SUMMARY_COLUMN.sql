-- ===============================================
-- MANUAL DATABASE UPDATE - RUN IN SUPABASE SQL EDITOR
-- ===============================================
-- This adds the order_summary column to the tours table
-- Copy and paste this into your Supabase SQL Editor and run it

-- Add order_summary column to tours table for comprehensive order tracking
DO $$ 
BEGIN
    -- Check if column exists before adding it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' 
        AND column_name = 'order_summary'
        AND table_schema = 'public'
    ) THEN
        -- Add the JSONB column
        ALTER TABLE public.tours ADD COLUMN order_summary JSONB;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.tours.order_summary IS 'JSON object containing comprehensive order details including sales orders and purchase orders with ShipHero IDs and legacy IDs for tour summary display';
        
        -- Add GIN index for better JSONB query performance
        CREATE INDEX idx_tours_order_summary ON public.tours USING GIN(order_summary);
        
        RAISE NOTICE 'SUCCESS: Added order_summary column to tours table';
    ELSE
        RAISE NOTICE 'INFO: Column order_summary already exists in tours table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tours' 
AND column_name = 'order_summary'
AND table_schema = 'public';

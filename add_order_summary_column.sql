-- Add order_summary column to tours table
-- This should be run directly in the Supabase SQL editor

DO $$ 
BEGIN
    -- Check if column exists before adding it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' 
        AND column_name = 'order_summary'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tours ADD COLUMN order_summary JSONB;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.tours.order_summary IS 'JSON object containing comprehensive order details including sales orders and purchase orders with ShipHero IDs and legacy IDs for tour summary display';
        
        -- Add index for better query performance
        CREATE INDEX IF NOT EXISTS idx_tours_order_summary ON public.tours USING GIN(order_summary);
        
        RAISE NOTICE 'Column order_summary added successfully to tours table';
    ELSE
        RAISE NOTICE 'Column order_summary already exists in tours table';
    END IF;
END $$;

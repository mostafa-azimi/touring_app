-- Show all constraints on warehouses table
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname, contype 
        FROM pg_constraint 
        WHERE conrelid = 'public.warehouses'::regclass
    LOOP
        RAISE NOTICE 'Found constraint: % (type: %)', constraint_record.conname, constraint_record.contype;
    END LOOP;
END $$;

-- Drop ANY unique constraint on the code column
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.warehouses'::regclass 
        AND a.attname = 'code'
        AND c.contype = 'u'
    LOOP
        EXECUTE format('ALTER TABLE public.warehouses DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;


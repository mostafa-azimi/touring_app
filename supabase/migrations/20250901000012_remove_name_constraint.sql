-- Remove name constraint from tour_participants
ALTER TABLE public.tour_participants 
  ALTER COLUMN name DROP NOT NULL;

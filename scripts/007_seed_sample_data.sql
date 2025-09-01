-- Insert sample warehouses
INSERT INTO public.warehouses (name, address) VALUES
  ('Main Distribution Center', '123 Industrial Blvd, City, State 12345'),
  ('West Coast Facility', '456 Warehouse Way, Los Angeles, CA 90210'),
  ('East Coast Hub', '789 Logistics Lane, New York, NY 10001')
ON CONFLICT DO NOTHING;

-- Insert sample team members
INSERT INTO public.team_members (name, email) VALUES
  ('John Smith', 'john.smith@company.com'),
  ('Sarah Johnson', 'sarah.johnson@company.com'),
  ('Mike Davis', 'mike.davis@company.com'),
  ('Emily Chen', 'emily.chen@company.com')
ON CONFLICT (email) DO NOTHING;

-- Insert sample swag items
INSERT INTO public.swag_items (name, quantity) VALUES
  ('Company T-Shirt', 100),
  ('Water Bottle', 75),
  ('Laptop Stickers', 200),
  ('Tote Bag', 50),
  ('Coffee Mug', 80)
ON CONFLICT DO NOTHING;

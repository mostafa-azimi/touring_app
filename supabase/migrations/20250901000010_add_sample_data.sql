-- Add sample data for testing

-- Add sample warehouse
INSERT INTO public.warehouses (name, address, city, state, zip, country, code, shiphero_warehouse_id) 
VALUES ('Convenience Counter', '100 Milton Park Ct', 'Alpharetta', 'GA', '30022', 'US', 'ATL', 'V2FyZWhvdXNlOjExOTM0Mw==')
ON CONFLICT DO NOTHING;

-- Add sample host
INSERT INTO public.team_members (name, first_name, last_name, email) 
VALUES ('Mike Azimi', 'Mike', 'Azimi', 'mmazimi1@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Add sample swag items
INSERT INTO public.swag_items (name, sku) 
VALUES 
  ('Swag 1', 'SWAG-001'),
  ('Swag 2', 'SWAG-002')
ON CONFLICT (sku) DO NOTHING;

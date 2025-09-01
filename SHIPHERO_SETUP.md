# ShipHero Integration Setup

## Token Configuration

You can configure your ShipHero API tokens directly in the application:

1. Go to **Settings → ShipHero** tab
2. Enter your **Access Token** and **Refresh Token**
3. Click **Save Tokens**

## Alternative: Environment Variables

You can also set these as environment variables in your `.env.local` file:

```bash
# ShipHero API Configuration
SHIPHERO_ACCESS_TOKEN=your_shiphero_access_token
SHIPHERO_REFRESH_TOKEN=your_shiphero_refresh_token
```

## Getting Your ShipHero Tokens

1. Log into your ShipHero account
2. Go to Settings → API Settings
3. Generate or copy your Access Token and Refresh Token
4. Add them to your environment variables or use the UI

## Integration Features

This integration focuses on **order creation only**:

- **Sales Orders**: Creates individual orders for each tour participant with their allocated swag items
- **Purchase Orders**: Creates consolidated purchase orders for all swag items needed for a tour
- **No Syncing**: Warehouses and products are managed manually in the app UI

## Setup Requirements

1. **ShipHero Tokens**: Get your access and refresh tokens from ShipHero dashboard
2. **Warehouse IDs**: Manually enter ShipHero Warehouse IDs in Settings → Warehouses
3. **Swag Item SKUs**: Ensure your swag items have valid SKUs that exist in ShipHero

## Usage

1. Configure your tokens in Settings → ShipHero
2. Set up warehouses with ShipHero Warehouse IDs
3. Create tours with participants and swag allocations
4. In View Tours, click "Create Sales Orders" and "Create Purchase Order" buttons

## API Endpoints Used

- `order_create` - Create sales orders for participants
- `purchase_order_create` - Create purchase orders for inventory

## Notes

- Orders are created directly in ShipHero when you click the buttons
- Each participant gets their own sales order with their allocated swag items
- Purchase orders aggregate all swag requirements for the entire tour
- Make sure your warehouse has a valid ShipHero Warehouse ID configured
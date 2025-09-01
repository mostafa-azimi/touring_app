# ShipHero Integration Setup

## Environment Variables

Add these to your `.env.local` file:

```bash
# ShipHero API Configuration
SHIPHERO_ACCESS_TOKEN=your_shiphero_access_token
SHIPHERO_REFRESH_TOKEN=your_shiphero_refresh_token
```

## Getting Your ShipHero Tokens

1. Log into your ShipHero account
2. Go to Settings → API Settings
3. Generate or copy your Access Token and Refresh Token
4. Add them to your environment variables

## Usage

### Sync Warehouses from ShipHero

```typescript
import { WarehouseSyncService } from '@/lib/shiphero/warehouse-sync'

const syncService = new WarehouseSyncService()
const result = await syncService.syncWarehousesFromShipHero()
```

### Check Sync Status

```typescript
const status = await syncService.getWarehouseSyncStatus()
console.log(`${status.synced}/${status.total} warehouses synced`)
```

## API Endpoints Used

- `warehouses` - Fetch all warehouses
- `warehouse(id)` - Fetch specific warehouse details
- `products` - Fetch products/inventory

## Notes

- Warehouses are automatically synced from ShipHero to your local database
- Creating new warehouses in ShipHero must be done manually through their dashboard
- The sync service maps ShipHero warehouse data to your local warehouse schema

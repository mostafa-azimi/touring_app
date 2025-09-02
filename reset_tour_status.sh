#!/bin/bash

# Reset Tour Status Script
# This script resets a specific tour back to 'scheduled' status if finalization failed

echo "🔄 Tour Status Reset Tool"
echo "========================"
echo ""

if [ -z "$1" ]; then
    echo "Usage: $0 <tour_id>"
    echo ""
    echo "Example: $0 17c5d832-cd82-407e-a8ce-e3a5bc4765e6"
    echo ""
    echo "This will reset the tour status back to 'scheduled'"
    exit 1
fi

TOUR_ID="$1"

echo "🎯 Resetting tour $TOUR_ID to 'scheduled' status..."

# Create temporary SQL file
cat > temp_reset.sql << EOF
UPDATE public.tours 
SET status = 'scheduled'
WHERE id = '$TOUR_ID';

-- Show the updated tour
SELECT id, status, date, time 
FROM public.tours 
WHERE id = '$TOUR_ID';
EOF

# Run the query
supabase db query --file temp_reset.sql

# Clean up
rm -f temp_reset.sql

echo ""
echo "✅ Tour status reset complete!"
echo "💡 You can now try finalizing the tour again after configuring ShipHero tokens"

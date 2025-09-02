#!/bin/bash

# Check Tour Data Status
# This script shows the current state of tour-related data

echo "📊 Current Tour Data Status"
echo "=========================="
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "🔍 Checking tour data counts..."
echo ""

# Create a temporary SQL file to check counts
cat > temp_check.sql << EOF
SELECT 
  'tours' as table_name,
  COUNT(*) as record_count
FROM public.tours
UNION ALL
SELECT 
  'tour_participants' as table_name,
  COUNT(*) as record_count  
FROM public.tour_participants
ORDER BY table_name;
EOF

# Run the query
supabase db query --file temp_check.sql

# Clean up temp file
rm -f temp_check.sql

echo ""
echo "💡 Note: Zero counts indicate clean data ready for production"
echo "   Non-zero counts indicate test data that should be cleared"

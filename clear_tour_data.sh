#!/bin/bash

# Clear Tour Data for Production
# This script safely clears all tour-related test data while preserving structure

echo "🧹 Clearing tour test data for production deployment..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Run the migration with include-all flag to apply new migrations
echo "📋 Running data cleanup migration..."
supabase db push --include-all

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Tour data cleanup completed successfully!"
    echo ""
    echo "📊 What was cleared:"
    echo "   • All tours and tour participants (test data)"
    echo ""
    echo "🔒 What was preserved:"
    echo "   • Database structure and tables"
    echo "   • Warehouse configuration"
    echo "   • Team members/hosts"
    echo "   • Swag items inventory"
    echo "   • All policies and security settings"
    echo ""
    echo "🚀 Your application is now ready for production with clean data!"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

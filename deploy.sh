#!/bin/bash

# Auto-deployment script for touring app
# This script automatically commits and pushes changes to trigger Vercel deployment

echo "🚀 Starting auto-deployment..."

# Increment version number
echo "📈 Incrementing version..."
node scripts/increment-version.js

# Add all changes (including updated version)
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit"
    exit 0
fi

# Get current timestamp for commit message
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create commit message with timestamp
COMMIT_MSG="Auto-deploy: Updates at $TIMESTAMP"

# Commit changes
git commit -m "$COMMIT_MSG"

# Push to test/vercel-preview branch
echo "📤 Pushing to test/vercel-preview branch..."
git push origin test/vercel-preview

echo "✅ Auto-deployment complete! Vercel will build and deploy automatically."
echo "🔗 Check your Vercel dashboard for deployment status."

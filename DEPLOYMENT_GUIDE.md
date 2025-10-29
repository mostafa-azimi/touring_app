# 🚀 ShipHero Warehouse Tours - Deployment Guide

## Architecture: Single-Tenant Per Deployment

This app uses a **single-tenant-per-deployment** model:
- Each customer gets their own dedicated Vercel deployment
- Each customer gets their own isolated Supabase database
- **Zero possibility of data mixing** between customers
- Simple, secure, and scales perfectly

---

## 🆕 Setting Up for a New Customer

### Prerequisites
- GitHub account
- Vercel account  
- Supabase account

### Step 1: Clone the Repository

```bash
# Clone for new customer
git clone https://github.com/mostafa-azimi/touring_app.git customer-name-touring-app
cd customer-name-touring-app

# Create new GitHub repo for this customer (optional but recommended)
gh repo create customer-name-touring-app --private --source=. --push
```

### Step 2: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it: `customer-name-touring`
4. Choose region closest to customer
5. Generate a strong database password (save it!)
6. Wait for project to finish setting up (~2 minutes)

### Step 3: Get Supabase Credentials

In your new Supabase project:
1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` 
   - `anon public` key
   - `service_role` key (click "Reveal" first)

### Step 4: Configure Environment Variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi... (your anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (your service_role key)

# Database connection (for Supabase CLI)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres
```

### Step 5: Run Database Migrations

```bash
# Link to your new Supabase project
supabase link --project-ref your-project-ref

# Push all migrations to create tables
supabase db push
```

This creates all necessary tables:
- `warehouses` - Customer's warehouse locations
- `team_members` (hosts) - Tour hosts
- `tours` - Scheduled tours
- `tour_participants` - Tour attendees
- `tenant_config` - App configuration
- `shiphero_tokens` - ShipHero API tokens
- `extras` - Demo customers for additional orders

### Step 6: Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy (creates new project automatically)
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: customer-name-touring-app
# - Deploy? Yes
```

### Step 7: Add Environment Variables to Vercel

In Vercel dashboard:
1. Go to your new project
2. **Settings** → **Environment Variables**
3. Add these (use same values from `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Select all environments (Production, Preview, Development)
5. Click **Save**

### Step 8: Redeploy

```bash
# Trigger new deployment with env vars
vercel --prod
```

### Step 9: Customer Setup

Send your customer the Vercel URL. They need to:
1. Open the app
2. Go to **Settings** → **ShipHero** tab
3. Paste their ShipHero API refresh token
4. Click "Generate Access Token"
5. Start creating tours!

---

## 🔄 Updating All Customer Deployments

When you make improvements to the app:

```bash
# In main repo
git add .
git commit -m "Add new feature"
git push origin main

# For each customer deployment:
cd ../customer-name-touring-app
git pull origin main
vercel --prod
```

Or set up automatic deployments from GitHub in Vercel.

---

## 🎯 Benefits of This Approach

✅ **Complete Data Isolation** - Physically separate databases  
✅ **No Multi-Tenancy Complexity** - No RLS, user_id filtering, etc.  
✅ **Custom Domains** - Each customer can have their own domain  
✅ **Independent Scaling** - Heavy users don't affect others  
✅ **Easier Debugging** - One customer's issues don't affect others  
✅ **Simpler Security** - No risk of data leaks between tenants  

---

## 💰 Cost Considerations

**Per Customer:**
- Vercel: Free tier or ~$20/month for Pro
- Supabase: Free tier (500MB database, 2GB bandwidth) or ~$25/month for Pro

**Scales linearly:** 10 customers = 10 separate deployments

---

## 🆘 Troubleshooting

### Migration Errors
```bash
# Reset and reapply migrations
supabase db reset
supabase db push
```

### Environment Variables Not Working
- Make sure they're set in Vercel dashboard
- Redeploy after adding them
- Check for typos in variable names

### ShipHero Token Issues
- Verify the refresh token is correct
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set
- Look at browser console for error messages

---

## 📞 Support

For issues or questions, contact the development team.

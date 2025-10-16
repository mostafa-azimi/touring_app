# Authentication System Setup

## ✅ Deployed Features
- User registration with email/password
- Login with session management  
- Password reset functionality
- Admin panel for user management
- Complete multi-tenant data isolation

## 🔑 Required Environment Variables

You need to add this to your Vercel project:

### `SUPABASE_SERVICE_ROLE_KEY`

This is the service role key that bypasses Row Level Security (RLS) for auth operations.

**How to get it:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Find the **service_role** key (NOT the anon key)
4. Copy the full key

**How to add it to Vercel:**
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `[paste your service role key]`
   - Select all environments (Production, Preview, Development)
4. Click **Save**
5. Redeploy your app

## 🗄️ Database Migrations

Run these migrations in your Supabase SQL editor (in order):

1. `supabase/migrations/20251001000001_create_users_table.sql`
2. `supabase/migrations/20251001000002_add_user_id_to_tables.sql`
3. `supabase/migrations/20251001000003_enable_rls_policies.sql`

## 👤 Creating the First Admin User

The first user you register will need to be made an admin manually:

### Option 1: Via Supabase Dashboard
1. Go to **Table Editor** → **users**
2. Find your user
3. Edit the `is_admin` column to `true`

### Option 2: Via SQL
```sql
UPDATE users 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

## 🧪 Testing

1. **Register a new account** - go to your app, click Register tab
2. **Make yourself admin** - use one of the methods above
3. **Login** - you should see your name in the header and an "Admin" tab
4. **Admin Panel** - you can now manage users and reset passwords

## 🔒 Security Notes

- Passwords are hashed with bcrypt (12 rounds)
- Sessions expire after 24 hours
- Service role key should NEVER be exposed to the client
- All user data is isolated via RLS policies
- Each user can only see their own tours, warehouses, etc.

## 🐛 Troubleshooting

### "Failed to create user" error
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Verify migrations have been run
- Check Supabase logs for RLS policy errors

### Can't login after registration
- Make sure you're using the same email/password
- Check browser console for errors
- Verify session cookie is being set

### Admin panel not showing
- Confirm `is_admin` is set to `true` for your user
- Logout and login again to refresh session

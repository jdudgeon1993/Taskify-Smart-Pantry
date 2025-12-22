# Smart Pantry - Deployment Guide

## Overview

Smart Pantry v2.0 includes cloud sync functionality powered by a Node.js backend API and PostgreSQL database hosted on Render.

## Architecture

- **Frontend**: Static HTML/CSS/JavaScript (can be hosted anywhere)
- **Backend**: Node.js + Express API (server.js)
- **Database**: PostgreSQL with JSONB storage
- **Authentication**: KITCH-XXXXXX token system (no passwords required)

## Step-by-Step Deployment

### 1. Deploy PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "PostgreSQL"
3. Configure database:
   - **Name**: `smart-pantry-db` (or your choice)
   - **Database**: `smartpantry`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is fine to start
4. Click "Create Database"
5. **Copy the "Internal Database URL"** - you'll need this next

### 2. Deploy Backend API on Render

1. Push your code to GitHub (if not already done)
2. Go to Render Dashboard → "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `smart-pantry-api`
   - **Root Directory**: Leave blank (or `.` if needed)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free tier

5. Add Environment Variable:
   - Click "Advanced" → "Add Environment Variable"
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied
   - **Key**: `NODE_ENV`
   - **Value**: `production`

6. Click "Create Web Service"
7. Wait for deployment (usually 2-3 minutes)
8. **Copy your service URL** (e.g., `https://smart-pantry-api.onrender.com`)

### 3. Update Frontend Configuration

1. Open `app.js` in your code
2. Find line 3: `const API_BASE_URL = 'https://your-render-api.onrender.com';`
3. Replace with your actual Render API URL
4. Save and commit the change

### 4. Deploy Frontend

You have several options:

#### Option A: GitHub Pages (Free)
```bash
# In your repository
git add .
git commit -m "Update API URL"
git push

# Enable GitHub Pages in repository settings
# Settings → Pages → Source: main branch → Save
```
Your app will be available at: `https://yourusername.github.io/Taskify-Smart-Pantry/`

#### Option B: Render Static Site (Free)
1. Render Dashboard → "New +" → "Static Site"
2. Connect your GitHub repository
3. Build Command: Leave blank
4. Publish Directory: `.` (root)

#### Option C: Netlify/Vercel (Free)
Follow their standard static site deployment process

### 5. Test the Deployment

1. Open your deployed frontend URL
2. Go to Settings tab
3. Click "Generate New Token"
4. You should see a KITCH-XXXXXX token
5. Add some ingredients or recipes
6. Open the app in a different browser/device
7. Login with your token
8. Verify your data syncs!

## Database Schema

The backend automatically creates these tables on first run:

```sql
pantry_users (id, token, created_at)
pantry_ingredients (user_token, data JSONB, updated_at)
pantry_recipes (user_token, data JSONB, updated_at)
pantry_shopping (user_token, data JSONB, updated_at)
pantry_mealplan (user_token, data JSONB, updated_at)
```

## Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=3001
NODE_ENV=production
```

## API Endpoints

### Authentication
- `POST /api/pantry/register` - Generate new token
- `POST /api/pantry/login` - Validate existing token

### Data Sync
- `GET /api/pantry/ingredients/:token` - Get ingredients
- `POST /api/pantry/ingredients/:token` - Update ingredients
- `GET /api/pantry/recipes/:token` - Get recipes
- `POST /api/pantry/recipes/:token` - Update recipes
- `GET /api/pantry/shopping/:token` - Get shopping list
- `POST /api/pantry/shopping/:token` - Update shopping list
- `GET /api/pantry/mealplan/:token` - Get meal plan
- `POST /api/pantry/mealplan/:token` - Update meal plan

## Troubleshooting

### Backend won't start
- Check DATABASE_URL is set correctly
- Verify PostgreSQL database is running
- Check Render logs for errors

### Frontend can't connect
- Verify API_BASE_URL in app.js matches your Render URL
- Check CORS is enabled in server.js (it is by default)
- Open browser console for error messages

### Token not working
- Tokens are case-insensitive (auto-converted to uppercase)
- Format must be KITCH-XXXXXX
- Check database `pantry_users` table to verify token exists

### Sync not working
- Check browser console for network errors
- Verify you're logged in (Settings tab shows token)
- Try "Sync Now" button manually
- Check Render logs for API errors

## Costs

- **Render Free Tier**:
  - PostgreSQL: 1GB storage, 97 hours/month compute
  - Web Service: 750 hours/month
  - Static Sites: Unlimited

- **After Free Tier**:
  - PostgreSQL: $7/month for 1GB
  - Web Service: $7/month for 512MB RAM

## Security Notes

- Tokens are NOT encrypted - treat like passwords
- No rate limiting implemented (add if scaling up)
- CORS allows all origins (restrict in production if needed)
- Database uses SSL in production
- No PII (personally identifiable information) is stored

## Sharing Data

Users can share their pantry data by sharing their KITCH-XXXXXX token. Anyone with the token can view and edit the data.

**To revoke access**: There's currently no way to regenerate tokens. You would need to:
1. Export your data
2. Generate a new token
3. Import your data
4. Don't share the old token anymore

## Maintenance

### View Database
```bash
# Connect to your Render PostgreSQL
# Get connection details from Render dashboard

psql $DATABASE_URL

# View all users
SELECT * FROM pantry_users;

# View a user's data
SELECT data FROM pantry_recipes WHERE user_token = 'KITCH-ABC123';
```

### Backup Database
Render provides automatic daily backups on paid plans. On free tier:
1. Users can export their data via the app
2. Or connect and pg_dump manually

## Support

For issues:
1. Check browser console for errors
2. Check Render logs for backend errors
3. Verify database connection
4. Test API endpoints directly with Postman/curl

## Next Steps

Consider adding:
- Token regeneration feature
- Shared pantry (multiple users, one pantry)
- Recipe ratings/reviews
- Nutritional information API integration
- Barcode scanning for ingredients

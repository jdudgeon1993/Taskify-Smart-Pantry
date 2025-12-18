# Smart Pantry Integration with Existing rtd-n-line-api

## Overview

Instead of deploying a separate server, we're adding Smart Pantry endpoints to your existing **rtd-n-line-api** server on Render. This means:
- ✅ One server handles RTD transit, Calendar/Commute, AND Smart Pantry
- ✅ One PostgreSQL database for all apps
- ✅ No additional hosting costs
- ✅ Simplified maintenance

## Step 1: Update Your rtd-n-line-api Repository

### Replace server.js

1. Go to your **rtd-n-line-api** repository on GitHub
2. Replace the contents of `server.js` with the file: `UPDATED_server.js` (created in this directory)
3. The updated server includes:
   - All your existing RTD transit endpoints
   - All your existing Calendar/Commute planner endpoints
   - NEW Smart Pantry endpoints (`/api/pantry/*`)

### What Changed?

**Added Functions:**
```javascript
// New token generator for Smart Pantry
function generateKitchToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'KITCH-';
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
```

**Added Database Tables:**
- `pantry_users` - Stores KITCH-XXXXXX tokens
- `pantry_ingredients` - Pantry/fridge/freezer items (JSONB)
- `pantry_recipes` - Recipe data (JSONB)
- `pantry_shopping` - Shopping list (JSONB)
- `pantry_mealplan` - Weekly meal plan (JSONB)

**Added Endpoints:**
- `POST /api/pantry/register` - Generate KITCH token
- `POST /api/pantry/login` - Validate KITCH token
- `GET/POST /api/pantry/ingredients/:token` - Sync ingredients
- `GET/POST /api/pantry/recipes/:token` - Sync recipes
- `GET/POST /api/pantry/shopping/:token` - Sync shopping list
- `GET/POST /api/pantry/mealplan/:token` - Sync meal plan

### Commit & Push

```bash
cd /path/to/rtd-n-line-api
git add server.js
git commit -m "Add Smart Pantry endpoints to API server"
git push
```

Render will automatically redeploy your server (takes ~2-3 minutes).

## Step 2: Update Smart Pantry Frontend

### Find Your Render API URL

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Find your **rtd-n-line-api** service
3. Copy the URL (e.g., `https://rtd-n-line-api.onrender.com`)

### Update app.js

Open `/home/user/Taskify-Smart-Pantry/app.js` and change line 3:

**Before:**
```javascript
const API_BASE_URL = 'https://your-render-api.onrender.com';
```

**After:**
```javascript
const API_BASE_URL = 'https://rtd-n-line-api.onrender.com';  // Your actual Render URL
```

## Step 3: Test the Integration

### Test 1: Health Check
```bash
curl https://rtd-n-line-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "rtd": "available",
    "planner": "available",
    "pantry": "available"
  }
}
```

### Test 2: Generate Token
```bash
curl -X POST https://rtd-n-line-api.onrender.com/api/pantry/register
```

Expected response:
```json
{
  "success": true,
  "token": "KITCH-ABC123"
}
```

### Test 3: Frontend Integration

1. Open your Smart Pantry app (index.html)
2. Go to Settings tab
3. Click "Generate New Token"
4. You should see a KITCH-XXXXXX token
5. Add some ingredients or recipes
6. Check Render logs - you should see sync requests

## Step 4: Deploy Smart Pantry Frontend

You can deploy the frontend anywhere. Options:

### Option A: GitHub Pages (Free)
```bash
cd /home/user/Taskify-Smart-Pantry
git add app.js  # With updated API_BASE_URL
git commit -m "Update API URL to point to Render"
git push

# Enable GitHub Pages in repository settings
```

### Option B: Render Static Site
1. Render Dashboard → New → Static Site
2. Connect Taskify-Smart-Pantry repository
3. Publish directory: `.` (root)
4. Deploy

### Option C: Netlify Drop
1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag folder containing index.html, app.js, styles.css
3. Instant deployment

## Database Structure

Your PostgreSQL database now contains:

### Calendar/Commute Tables
- `planner_users` (PLAN-XXXXXX tokens)
- `planner_tasks`
- `planner_settings`
- `planner_stats`
- `sync_tokens`

### Smart Pantry Tables
- `pantry_users` (KITCH-XXXXXX tokens)
- `pantry_ingredients`
- `pantry_recipes`
- `pantry_shopping`
- `pantry_mealplan`

Both apps use the same database but different table prefixes for separation.

## Verification Checklist

- [ ] Updated server.js in rtd-n-line-api repository
- [ ] Committed and pushed changes
- [ ] Render redeployed successfully (check dashboard)
- [ ] Health check endpoint returns all services as "available"
- [ ] Updated API_BASE_URL in Smart Pantry app.js
- [ ] Can generate KITCH token from frontend
- [ ] Data syncs across devices with same token
- [ ] Both Calendar/Commute and Smart Pantry work simultaneously

## What Didn't Change

- Your existing Calendar/Commute apps continue to work unchanged
- RTD transit endpoints remain the same
- Database connection/credentials stay the same
- PLAN-XXXXXX tokens for Calendar/Commute still work
- No migration of existing data needed

## Benefits

1. **Unified Infrastructure** - One server, one database, one deployment
2. **Cost Savings** - No additional Render services needed
3. **Easier Maintenance** - Update one server for all apps
4. **Shared Database** - Potential for future cross-app features
5. **Consistent Patterns** - All apps use same auth/sync mechanism

## Troubleshooting

### Backend Issues

**Database tables not created:**
- Check Render logs: `Server running... Database initialized`
- Verify DATABASE_URL environment variable is set
- Tables are created automatically on server startup

**Endpoints returning 503:**
- Database connection failed
- Check Render dashboard → Environment → DATABASE_URL
- Ensure PostgreSQL instance is running

### Frontend Issues

**"Network error" when generating token:**
- Verify API_BASE_URL is correct (no trailing slash)
- Check browser console for CORS errors
- Ensure Render service is running

**Token generated but sync fails:**
- Check Render logs for errors
- Verify token format is KITCH-XXXXXX
- Test API directly with curl

### Mixed Issues

**Calendar/Commute stopped working:**
- Verify you copied the UPDATED_server.js completely
- Old endpoints should still be there unchanged
- Check Render logs for startup errors

## Next Steps

Once integrated and tested:

1. Remove the standalone `server.js` and `package.json` from Smart Pantry repo (no longer needed)
2. Keep `index.html`, `app.js`, `styles.css` for frontend only
3. Update README to document the shared backend
4. Consider adding monitoring/logging for all endpoints

## Questions?

The integration preserves everything that was working before while adding Smart Pantry capabilities. All three apps (RTD Transit, Calendar/Commute, Smart Pantry) now share one robust backend infrastructure.

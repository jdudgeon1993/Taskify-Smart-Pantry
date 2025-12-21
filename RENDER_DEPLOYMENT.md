# Deploy Smart Pantry to Render

This guide will help you deploy your Smart Pantry app to Render in just a few steps!

## 🚀 Quick Start (Easiest Method)

### Option 1: One-Click Deploy with Blueprint

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Deploy to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select `Taskify-Smart-Pantry`
   - Click "Apply"
   - Render will automatically:
     - Create PostgreSQL database
     - Create web service
     - Connect them together
     - Deploy your app!

3. **Done!** Your app will be live at: `https://smart-pantry.onrender.com` (or similar)

---

## 📋 Manual Deployment (Alternative)

If you prefer manual setup:

### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `smart-pantry-db`
   - **Database**: `smartpantry`
   - **Region**: Choose closest to you
   - **Plan**: Free
4. Click "Create Database"
5. **Copy the "Internal Database URL"** from the database page

### Step 2: Deploy Web Service

1. In Render Dashboard, click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `smart-pantry`
   - **Root Directory**: Leave blank
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. Add Environment Variables:
   - Click "Advanced"
   - Add variable:
     - **Key**: `DATABASE_URL`
     - **Value**: Paste the Internal Database URL
   - Add another:
     - **Key**: `NODE_ENV`
     - **Value**: `production`

5. Click "Create Web Service"

### Step 3: Wait for Deployment

- First deployment takes 2-5 minutes
- You'll see the build logs in real-time
- When complete, you'll get a URL like: `https://smart-pantry-xyz.onrender.com`

### Step 4: Test Your App

1. Open your Render URL
2. Go to Settings tab
3. Click "Generate New Token"
4. You should see a KITCH-XXXXXX token
5. Add some recipes or ingredients
6. Open in another browser and login with your token
7. Verify data syncs!

---

## ⚙️ Configuration

### Current API Setup

The app currently uses: `https://rtd-n-line-api.onrender.com`

To use your own Render deployment, update `app.js` line 3:

```javascript
// Change from:
const API_BASE_URL = 'https://rtd-n-line-api.onrender.com';

// To your new Render URL:
const API_BASE_URL = 'https://your-app-name.onrender.com';

// Or use same origin (recommended):
const API_BASE_URL = window.location.origin;
```

Then commit and push the change - Render will auto-deploy!

---

## 🔧 Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Render)
- `NODE_ENV` - Set to `production`

Optional:
- `PORT` - Defaults to 3001 (Render auto-assigns)

---

## 📊 Monitoring

- **Free tier**: App sleeps after 15 minutes of inactivity
- **First request after sleep**: Takes ~30 seconds to wake up
- **Solution**: Upgrade to paid plan ($7/month) for always-on

Check status:
- Render Dashboard shows logs and metrics
- Health check endpoint: `https://your-app.onrender.com/health`

---

## 🆘 Troubleshooting

### App won't start
- Check logs in Render Dashboard
- Verify DATABASE_URL is set correctly
- Ensure `npm install` completed successfully

### Database connection error
- Verify DATABASE_URL includes proper SSL settings
- Check database is in same region as web service
- Ensure database is "Available" status

### 502 Bad Gateway
- App is waking up from sleep (wait 30 seconds)
- Check if build succeeded in logs

### Data not syncing
- Check browser console for errors
- Verify API_BASE_URL points to your Render service
- Test `/health` endpoint

---

## 🎉 You're Done!

Your Smart Pantry app is now:
- ✅ Deployed on Render
- ✅ Using PostgreSQL database
- ✅ Auto-deploying on git push
- ✅ Accessible from anywhere

Share your URL with family/friends to collaborate on meal planning!

---

## 💡 Next Steps

- **Custom Domain**: Add your own domain in Render settings
- **HTTPS**: Automatically enabled on Render
- **Monitoring**: Set up notifications for downtime
- **Backup**: Regular database backups (paid plans)

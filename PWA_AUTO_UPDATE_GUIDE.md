# PWA Auto-Update Guide

## ✅ Implementation Complete

Your PWA now has **seamless auto-updates** with the hybrid approach:

### Features Implemented

1. **Hybrid Caching Strategy**
   - **Network-first** for HTML and JavaScript (always fresh code)
   - **Cache-first** for static assets (CSS, images, fonts) for performance
   - Automatic background cache updates

2. **Timestamp-Based Cache Versioning**
   - Cache version includes timestamp: `apparel-modest-20251217-120000`
   - Update timestamp on each deployment to invalidate old cache

3. **Aggressive Update Checking**
   - Checks for updates every **1 minute**
   - Automatically activates new service workers

4. **Seamless Reload (No Visual Interruption)**
   - Only reloads when:
     - Tab is hidden (user switched apps/tabs)
     - User is idle (no activity for 30 seconds)
   - **No annoying constant refreshing** - respects user activity

## 📋 What You Need to Do on Each Deployment

### Step 1: Update Cache Version in `service-worker.js`

When you deploy new code, update the timestamp in `service-worker.js`:

```javascript
// Change this line (around line 3-4):
const CACHE_VERSION = '20251217-120000';  // OLD

// To current date/time:
const CACHE_VERSION = '20251217-150000';  // NEW (update date/time)
```

**Format:** `YYYYMMDD-HHMMSS`

**Example:**
- December 17, 2025 at 3:00 PM = `20251217-150000`
- December 18, 2025 at 10:30 AM = `20251218-103000`

### Step 2: Commit and Push

```bash
git add service-worker.js
git commit -m "Update PWA cache version for new deployment"
git push
```

That's it! The service worker file change will trigger automatic updates.

## 🔄 How It Works

1. **Update Detection** (Every 1 minute)
   - Browser checks if `service-worker.js` file changed
   - If changed, downloads and installs new service worker

2. **Activation**
   - New service worker activates immediately (via `skipWaiting()`)
   - Old cache is deleted, new cache is created

3. **Seamless Reload**
   - System waits for safe moment to reload:
     - User switches tabs/apps → Reloads immediately
     - User is idle (30s) → Reloads automatically
     - User is active → Waits until idle or tab hidden

4. **User Experience**
   - **No notifications** - updates happen silently
   - **No interruption** - only reloads when safe
   - **Always fresh** - HTML/JS always from network
   - **Fast loading** - Static assets from cache

## 🧪 Testing

### Test Update Flow

1. **Make a change** to your code
2. **Update cache version** in `service-worker.js`
3. **Deploy** to production
4. **Wait 1-2 minutes** (update check interval)
5. **Switch tabs** or **wait 30 seconds idle** → Page reloads with new version

### Verify It's Working

Open browser console and you should see:
```
✅ Service Worker registered successfully: /
🔄 New service worker installed. Activating...
🔄 Service Worker updated. Reloading seamlessly...
```

### Manual Test (Development)

1. Change something in your code
2. Update `CACHE_VERSION` in `service-worker.js`
3. Open DevTools → Application → Service Workers
4. Click "Update" button
5. Watch console for update messages

## 📱 Mobile vs Desktop

Both work the same way:
- **Mobile**: Reloads when app goes to background or user is idle
- **Desktop**: Reloads when tab is hidden or user is idle

## ⚠️ Important Notes

1. **Always update cache version** when deploying - otherwise users won't get updates
2. **Service worker file must change** - browser only checks if file content changed
3. **First load after update** - May be slightly slower as new cache is built
4. **Offline support** - Still works, uses cached version when offline

## 🐛 Troubleshooting

### Updates Not Happening?

1. **Check cache version** - Did you update it?
2. **Check service worker file** - Did it actually change on server?
3. **Clear browser cache** - Sometimes needed for testing
4. **Check console** - Look for service worker errors

### Too Frequent Reloads?

- Increase idle time: Change `30000` (30 seconds) to `60000` (1 minute) in `index.html`
- Look for line: `return Date.now() - lastUserActivity > 30000;`

### Not Reloading?

- Check if user activity detection is working
- Try switching tabs manually
- Check console for errors

## 🎯 Best Practices

1. **Update cache version** on every deployment
2. **Test updates** in staging before production
3. **Monitor console** for service worker errors
4. **Use meaningful timestamps** (date + time of deployment)

---

**Your PWA will now automatically update within 1-2 minutes of deployment, with zero user interruption!** 🚀


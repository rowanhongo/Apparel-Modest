# PWA Force Update Guide - Mobile App Issues

## Problem
Mobile PWA apps downloaded to home screen are not updating even after manually clearing cache. This is a common issue with mobile browsers being very aggressive about caching service workers.

## Solutions Implemented

### 1. **Cache-Busting Query Parameters**
- Service worker registration now includes `?v=timestamp` to force fresh fetch
- Every registration attempt bypasses cache

### 2. **Version Checking System**
- Checks service worker file version every minute
- Compares stored version with server version
- Automatically forces update if version changed

### 3. **Force Update Function**
- Nuclear option: Unregisters all service workers, clears all caches, re-registers
- Can be triggered manually from console: `window.forcePWAUpdate()`

### 4. **Aggressive Cache Headers**
- Updated Netlify headers to prevent service worker caching
- `Cache-Control: no-cache, no-store, must-revalidate`

## How to Force Update on Mobile

### Option 1: Manual Update (Recommended)
1. Open the PWA app on mobile
2. Open browser console (if possible) or use remote debugging
3. Run: `window.forcePWAUpdate()`
4. App will reload with fresh version

### Option 2: Uninstall and Reinstall
1. Delete the PWA from home screen
2. Clear browser cache completely
3. Visit website in browser
4. Re-add to home screen

### Option 3: Browser Settings
1. Go to browser settings
2. Clear site data / storage
3. Clear cache
4. Reload app

### Option 4: Wait for Auto-Update
- System checks every 1 minute
- If version changed, automatically forces update
- May take 1-2 minutes after deployment

## For Users (Instructions to Share)

If users report outdated app:

1. **Quick Fix**: Close and reopen the app (wait 1-2 minutes)
2. **Medium Fix**: 
   - Open browser settings
   - Find "Site Settings" or "Storage"
   - Clear data for your website
   - Reload app
3. **Nuclear Fix**: 
   - Delete app from home screen
   - Clear browser cache
   - Re-add to home screen

## Testing

### Test Force Update
```javascript
// In browser console:
window.forcePWAUpdate()
```

### Check Current Version
```javascript
// Check stored version
localStorage.getItem('sw_version')

// Check service worker version
navigator.serviceWorker.getRegistration().then(reg => {
    console.log('SW registered:', reg);
});
```

## Deployment Checklist

When deploying updates:

1. ✅ Update `CACHE_VERSION` in `service-worker.js`
2. ✅ Commit and push to GitHub
3. ✅ Wait for Netlify deployment
4. ✅ Verify service worker file updated on server
5. ✅ Users will auto-update within 1-2 minutes

## Troubleshooting

### Still Not Updating?

1. **Check service worker file on server**
   - Visit: `https://yourdomain.com/service-worker.js`
   - Verify `CACHE_VERSION` is updated

2. **Check browser console**
   - Look for service worker errors
   - Check if version check is running

3. **Force unregister manually**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
       regs.forEach(reg => reg.unregister());
   });
   ```

4. **Clear all caches**
   ```javascript
   caches.keys().then(names => {
       names.forEach(name => caches.delete(name));
   });
   ```

## Advanced: Add Update Notification

If you want to notify users of updates:

```javascript
// In index.html, add after forceServiceWorkerUpdate:
if (storedVersion !== serverVersion) {
    // Show notification
    if (confirm('New version available! Reload now?')) {
        forceServiceWorkerUpdate();
    }
}
```

---

**The system now has multiple layers of update enforcement to ensure mobile PWAs get updates!**


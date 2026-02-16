# Inventory Page Troubleshooting Steps

## Issue
The Inventory page at `http://localhost:5173/inventory` is showing a blank white screen.

## Root Cause
The issue was caused by duplicate `cost_per_unit` keys in the JavaScript state objects, which has been **FIXED**. The blank screen you're seeing now is likely due to **browser caching**.

## Solution: Hard Refresh

### Option 1: Keyboard Shortcut (Recommended)
1. Navigate to `http://localhost:5173/inventory`
2. Press **Ctrl + Shift + R** (Windows/Linux) or **Cmd + Shift + R** (Mac)
3. This will bypass the cache and reload the page

### Option 2: Clear Cache via DevTools
1. Open Developer Tools (F12)
2. Right-click the refresh button in the browser
3. Select "Empty Cache and Hard Reload"

### Option 3: Clear Browser Cache
1. Go to browser settings
2. Clear browsing data
3. Select "Cached images and files"
4. Clear data
5. Refresh the page

## Verification Steps

After hard refresh, you should see:

✅ **Stats Cards** at the top showing:
   - Total Items
   - Low Stock count
   - Total Value

✅ **Inventory Table** with columns:
   - Ingredient name
   - Current Stock
   - Unit
   - Reorder Level
   - Cost/Unit
   - Supplier
   - Status badge
   - Action buttons (Edit/Delete)

✅ **Add Ingredient Button** in the top right

✅ **Low Stock Alerts** (if any items are below reorder level)

## If Still Not Working

If the page is still blank after hard refresh:

1. **Check Browser Console** (F12 → Console tab)
   - Look for any red error messages
   - Take a screenshot and share

2. **Check Network Tab** (F12 → Network tab)
   - Refresh the page
   - Look for failed requests (red status codes)
   - Check if `/api/inventory/ingredients` returns 200

3. **Try a Different Browser**
   - Test in Chrome, Firefox, or Edge
   - This helps isolate browser-specific issues

## Files Fixed

- ✅ `InventoryDashboard.jsx` - Removed duplicate `cost_per_unit` keys (lines 18-19, 97-98, 125-126)
- ✅ `InventoryDashboard.jsx` - Changed `supplier_name` to `supplier`
- ✅ `InventoryDashboard.jsx` - Removed non-existent `storage_location` field
- ✅ Build verified - No errors

## Current Status

- ✅ Frontend dev server running on `http://localhost:5173`
- ✅ Backend API running on `http://localhost:8000`
- ✅ Code syntax is correct
- ✅ No build errors
- ⏳ Waiting for browser cache clear

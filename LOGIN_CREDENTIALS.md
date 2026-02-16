# 🔐 Admin Login Credentials

## ✅ Account Created Successfully!

Your admin account has been created in the database.

### Login Credentials:
```
Username: admin
Password: admin123
```

### Restaurant Details:
- **Name**: Demo Restaurant
- **Address**: 123 Main Street
- **Phone**: 1234567890
- **Email**: demo@restaurant.com

---

## 🌐 Access the Application

**Frontend URL**: http://localhost:5173

---

## 🐛 Troubleshooting Blank Page

If you're seeing a blank page, try these steps:

### Step 1: Check Browser Console
1. Open http://localhost:5173
2. Press `F12` to open Developer Tools
3. Click on the **Console** tab
4. Look for any red error messages
5. Take a screenshot and share if you see errors

### Step 2: Hard Refresh
1. Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. This clears the cache and reloads

### Step 3: Check if Vite is Running
The frontend terminal should show:
```
VITE v5.4.21  ready in 811 ms

➜  Local:   http://localhost:5173/
```

### Step 4: Restart Frontend Server
If the page is still blank:
1. In the frontend terminal, press `Ctrl + C` to stop
2. Run: `npm run dev`
3. Wait for "ready" message
4. Try http://localhost:5173 again

### Step 5: Check Network Tab
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Check if `main.jsx` loads successfully (should be green/200 status)

---

## 🧪 Test Backend API

To verify the backend is working:

1. Open: http://localhost:8000/docs
2. You should see the Swagger API documentation
3. Try the `/api/auth/login` endpoint:
   - Click on it → "Try it out"
   - Enter:
     ```json
     {
       "username": "admin",
       "password": "admin123"
     }
     ```
   - Click "Execute"
   - You should get a token back

---

## 📝 Common Issues & Solutions

### Issue: "Cannot GET /"
**Solution**: Make sure you're going to http://localhost:5173 (not 8000)

### Issue: "This site can't be reached"
**Solution**: 
- Check if frontend is running (`npm run dev`)
- Check the port number (should be 5173)

### Issue: Blank white page
**Solution**:
- Check browser console for errors (F12)
- Try incognito/private mode
- Clear browser cache

### Issue: "Failed to fetch"
**Solution**:
- Make sure backend is running on port 8000
- Check `.env` file has correct settings

---

## 🎯 Next Steps After Login

Once you successfully log in:

1. **Add Ingredients** (Inventory module)
   - Tomato, Cheese, Flour, etc.
   - Set stock levels

2. **Create Menu Items** (Menu Management)
   - Add categories
   - Add items with BOM

3. **Test Order Flow**
   - Place order in POS Terminal
   - View in Kitchen Display
   - Watch inventory auto-deduct

---

## 📞 Need Help?

If you're still seeing a blank page:
1. Take a screenshot of the browser console (F12 → Console tab)
2. Share the error message
3. Check if both servers are running

Both servers should be running:
- ✅ Backend: http://localhost:8000
- ✅ Frontend: http://localhost:5173

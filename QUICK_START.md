# 🚀 Quick Start Guide - Restaurant POS System

## ✅ System Status

Both backend and frontend are **RUNNING** and ready to use!

- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Frontend App**: http://localhost:5173
- **Database**: SQLite (`restaurant_pos.db`)

---

## 🎯 First Time Setup (Already Done!)

✅ Backend dependencies installed
✅ Frontend dependencies installed (132 packages)
✅ SQLite database created with 15 tables
✅ Backend server running
✅ Frontend server running

---

## 📱 Using the Application

### Step 1: Open the Application
Open your browser and go to: **http://localhost:5173**

### Step 2: Register Your Restaurant
1. Click **"Need an account? Register"**
2. Fill in the registration form:
   - **Username**: Your admin username (e.g., `admin`)
   - **Email**: Your email address
   - **Full Name**: Your name
   - **Restaurant ID**: Create a unique ID (e.g., `rest001`)
   - **Password**: Choose a secure password
3. Click **Register**

### Step 3: Explore the Dashboard
After registration, you'll see the main dashboard with 6 modules:
- 🛒 **POS Terminal** - Take orders
- 👨‍🍳 **Kitchen Display** - View kitchen orders
- 📋 **Menu Management** - Manage menu items
- 📦 **Inventory** - Track ingredients
- 💳 **Billing** - Process payments
- 📊 **Reports** - View analytics

---

## 🔧 Common Tasks

### Add Ingredients (Required First!)
1. Go to **Inventory** module
2. Click **"+ Add Ingredient"**
3. Fill in:
   - Name (e.g., "Tomato", "Cheese", "Flour")
   - Unit (kg, g, ml, l, pcs)
   - Current Stock
   - Reorder Level
4. Click **Add Ingredient**

### Add Menu Items
1. Go to **Menu Management**
2. Create categories first
3. Add menu items with BOM (Bill of Materials)
   - Link each item to ingredients
   - Specify quantities needed

### Take an Order
1. Go to **POS Terminal**
2. Select menu items
3. Adjust quantities
4. Choose order type (Dine-in/Takeaway/Delivery)
5. Click **Place Order**
6. Inventory automatically deducts!

### View Kitchen Orders
1. Go to **Kitchen Display System (KDS)**
2. See all active orders
3. Update status:
   - **Start Preparing** → **Mark Ready** → **Complete**

---

## 🛑 Stop the Servers

When you're done working:

**Stop Frontend** (in frontend terminal):
- Press `Ctrl + C`

**Stop Backend** (in backend terminal):
- Press `Ctrl + C`

---

## 🔄 Restart the Servers

### Backend
```bash
cd c:\Users\Sujal Patel\Desktop\sujal-poss\backend
python main.py
```

### Frontend (in a new terminal)
```bash
cd c:\Users\Sujal Patel\Desktop\sujal-poss\frontend
npm run dev
```

---

## 📊 View Database

### Option 1: DB Browser for SQLite (Recommended)
1. Download: https://sqlitebrowser.org/
2. Open `restaurant_pos.db`
3. Browse all tables and data

### Option 2: VS Code Extension
1. Install "SQLite Viewer" extension
2. Right-click `restaurant_pos.db` → "Open Database"

---

## 🔄 Reset Database

If you want to start fresh:

```bash
cd c:\Users\Sujal Patel\Desktop\sujal-poss\backend
del restaurant_pos.db
python init_db.py
```

---

## 🎨 Key Features to Test

### 1. Ingredient-Level Inventory
- Add ingredients with stock levels
- Create menu items with BOM
- Place order → Watch inventory auto-deduct
- Cancel order → Watch inventory auto-rollback

### 2. Kitchen Display System
- Place order from POS
- View in KDS with color-coded urgency
- Update status in real-time

### 3. Low Stock Alerts
- Set reorder levels for ingredients
- When stock falls below → See alerts in Inventory dashboard

### 4. Order Lifecycle
- **Placed** → **Preparing** → **Ready** → **Served** → **Completed**

---

## 🐛 Troubleshooting

### Frontend won't load
- Check if frontend server is running
- Try: `npm run dev` in frontend folder

### Backend errors
- Check if backend server is running
- Try: `python main.py` in backend folder

### "Module not found" errors
- Backend: `pip install -r requirements.txt`
- Frontend: `npm install`

### Database locked
- Close any programs viewing `restaurant_pos.db`
- Restart backend server

---

## 📚 Documentation

- **Full README**: `README.md`
- **SQLite Setup**: `SETUP_SQLITE.md`
- **API Documentation**: http://localhost:8000/docs (when backend is running)

---

## 🎉 You're All Set!

Your production-ready Restaurant POS system is running!

**Next Steps:**
1. Open http://localhost:5173
2. Register your restaurant
3. Add some ingredients
4. Create menu items
5. Start taking orders!

Enjoy your POS system! 🚀

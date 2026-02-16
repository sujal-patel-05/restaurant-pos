# SQLite Database Setup Guide (Simple & Fast!)

SQLite is a file-based database that requires **NO installation** - it's perfect for development!

## ✅ Advantages of SQLite
- **No installation required** - works out of the box
- **No server setup** - just a file
- **No password management** - simple and secure
- **Perfect for development** - easy to reset and test
- **Portable** - entire database is a single file

## 🚀 Quick Setup (3 Steps)

### Step 1: Navigate to Backend Directory
```bash
cd c:\Users\Sujal Patel\Desktop\sujal-poss\backend
```

### Step 2: Activate Virtual Environment & Install Dependencies
```bash
# Activate virtual environment
venv\Scripts\activate

# Install dependencies (if not already done)
pip install -r requirements.txt
```

### Step 3: Initialize Database
```bash
python init_db.py
```

That's it! You should see:
```
Creating database tables...
✅ Database tables created successfully!
Database file: restaurant_pos.db
```

## 🎯 Start the Application

### Start Backend
```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Start Frontend (in a new terminal)
```bash
cd c:\Users\Sujal Patel\Desktop\sujal-poss\frontend
npm install
npm run dev
```

Frontend will run on: `http://localhost:5173`

## 📊 View Your Database

You can view/edit the SQLite database using:

### Option 1: DB Browser for SQLite (Recommended)
1. Download from: https://sqlitebrowser.org/
2. Open `restaurant_pos.db` file
3. Browse tables and data visually

### Option 2: VS Code Extension
1. Install "SQLite Viewer" extension in VS Code
2. Right-click on `restaurant_pos.db` → "Open Database"

### Option 3: Command Line
```bash
sqlite3 restaurant_pos.db
.tables  # List all tables
.schema users  # View table structure
SELECT * FROM users;  # Query data
.quit  # Exit
```

## 🔄 Reset Database

If you need to start fresh:

```bash
# Delete the database file
del restaurant_pos.db

# Recreate tables
python init_db.py
```

## 📁 Database Location

The database file `restaurant_pos.db` is created in:
```
c:\Users\Sujal Patel\Desktop\sujal-poss\backend\restaurant_pos.db
```

## ✅ Verify Setup

1. **Check if database file exists**:
   ```bash
   dir restaurant_pos.db
   ```

2. **Test API**:
   - Open browser: `http://localhost:8000/docs`
   - You should see the Swagger API documentation

3. **Test Frontend**:
   - Open browser: `http://localhost:5173`
   - You should see the login page

## 🎉 You're Ready!

Now you can:
1. Register a new restaurant and user
2. Add menu items and ingredients
3. Create orders
4. Use the Kitchen Display System
5. Track inventory

## 📝 Notes

- **Database file is gitignored** - won't be committed to version control
- **All data is stored locally** - in the `restaurant_pos.db` file
- **No network required** - completely offline
- **Fast and lightweight** - perfect for development

## 🔧 Troubleshooting

### Issue: "No module named 'models'"
**Solution**: Make sure you're in the backend directory and virtual environment is activated

### Issue: "Table already exists"
**Solution**: Delete `restaurant_pos.db` and run `python init_db.py` again

### Issue: "Database is locked"
**Solution**: Close any programs viewing the database file and restart the backend

## 🚀 Production Note

For production deployment, you can easily switch back to PostgreSQL by:
1. Updating `DATABASE_URL` in `.env`
2. Running the PostgreSQL schema
3. No code changes needed!

The system is designed to work with both SQLite (development) and PostgreSQL (production).

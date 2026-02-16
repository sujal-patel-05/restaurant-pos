# PostgreSQL Database Setup Guide

## Step 1: Open pgAdmin

1. Launch **pgAdmin 4** from your Windows Start menu
2. Enter your master password if prompted

## Step 2: Create Database

### Option A: Using pgAdmin GUI

1. In the left sidebar, expand **Servers** → **PostgreSQL**
2. Right-click on **Databases**
3. Select **Create** → **Database**
4. In the dialog:
   - **Database name**: `restaurant_pos`
   - **Owner**: `postgres` (or your username)
   - Click **Save**

### Option B: Using Query Tool

1. Right-click on **PostgreSQL** server → **Query Tool**
2. Run this command:
   ```sql
   CREATE DATABASE restaurant_pos;
   ```
3. Click the **Execute** button (▶️) or press F5

## Step 3: Run Database Schema

1. In pgAdmin, select your `restaurant_pos` database
2. Right-click on `restaurant_pos` → **Query Tool**
3. Click **Open File** (folder icon)
4. Navigate to: `c:\Users\Sujal Patel\Desktop\sujal-poss\backend\database\schema.sql`
5. Click **Open**
6. Click **Execute** (▶️) or press F5
7. You should see: "Query returned successfully"

## Step 4: Verify Tables Created

1. In the left sidebar, expand:
   - **Databases** → **restaurant_pos** → **Schemas** → **public** → **Tables**
2. You should see 15 tables:
   - restaurants
   - users
   - menu_categories
   - menu_items
   - ingredients
   - bom_mappings
   - inventory
   - inventory_transactions
   - orders
   - order_items
   - kot
   - payments
   - invoices
   - wastage_logs
   - discounts

## Step 5: Configure Backend Connection

1. Open: `c:\Users\Sujal Patel\Desktop\sujal-poss\backend\.env`
2. Update the `DATABASE_URL` line with your PostgreSQL password:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/restaurant_pos
   ```
   Replace `YOUR_PASSWORD` with your actual PostgreSQL password

## Step 6: Test Connection

1. Open terminal in the backend directory:
   ```bash
   cd c:\Users\Sujal Patel\Desktop\sujal-poss\backend
   ```

2. Activate virtual environment:
   ```bash
   venv\Scripts\activate
   ```

3. Install dependencies (if not already done):
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   python main.py
   ```

5. You should see:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000
   INFO:     Application startup complete.
   ```

6. Open browser and go to: `http://localhost:8000/docs`
   - You should see the API documentation (Swagger UI)

## Common Issues & Solutions

### Issue 1: "password authentication failed"
**Solution**: Check your PostgreSQL password in the `.env` file

### Issue 2: "database does not exist"
**Solution**: Make sure you created the `restaurant_pos` database in Step 2

### Issue 3: "could not connect to server"
**Solution**: 
- Make sure PostgreSQL service is running
- In Windows, check Services (Win + R → `services.msc`)
- Look for "postgresql-x64-XX" service and ensure it's running

### Issue 4: "relation does not exist"
**Solution**: Run the schema.sql file again (Step 3)

## Quick Connection Test

You can test the database connection directly in pgAdmin:

1. Right-click on `restaurant_pos` → **Query Tool**
2. Run this query:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
3. You should see all 15 tables listed

## Default PostgreSQL Credentials

If you just installed PostgreSQL:
- **Username**: `postgres`
- **Password**: The password you set during installation
- **Host**: `localhost`
- **Port**: `5432`

## Next Steps

After successful database setup:
1. Start the backend server (`python main.py`)
2. Start the frontend (`cd ../frontend && npm run dev`)
3. Open `http://localhost:5173` in your browser
4. Register a new restaurant and user
5. Start using the POS system!

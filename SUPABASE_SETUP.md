# 🗄️ Supabase Setup Guide — Step-by-Step

Follow these exact steps to create your Supabase database and connect it to 5ive POS.

---

## Step 1: Create a Supabase Account & Project

1. Go to **[https://supabase.com](https://supabase.com)** and click **Start your project**.
2. Sign in with your **GitHub account** (easiest option).
3. Click **New Project**.
4. Fill in the details:
   - **Organization**: Select your default org (or create one).
   - **Project Name**: `5ive-pos-db`
   - **Database Password**: Create a **strong password** and **COPY IT** somewhere safe. You will need it later.
   - **Region**: Choose the closest region to you (e.g., `Mumbai (ap-south-1)` for India).
5. Click **Create new project** and wait ~2 minutes for it to provision.

---

## Step 2: Get Your Connection String

1. Once your project is ready, click **⚙️ Project Settings** (gear icon on the left sidebar).
2. Click **Database** in the left menu.
3. Scroll down to **Connection string** → select the **URI** tab.
4. You will see something like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
5. **Replace `[YOUR-PASSWORD]`** with the password you created in Step 1.
6. **Copy this entire URI** — this is your `SUPABASE_DATABASE_URL`.

> ⚠️ **IMPORTANT**: Make sure to use the **port 6543** (Transaction pooler) version, NOT port 5432. The pooler is required for serverless environments like Render.

---

## Step 3: Run the Schema in Supabase SQL Editor

1. In the Supabase Dashboard, click **SQL Editor** (left sidebar).
2. Click **New Query**.
3. Open the file `backend/database/supabase_schema.sql` in your code editor.
4. **Copy the entire contents** and paste it into the Supabase SQL Editor.
5. Click **▶ Run**.
6. You should see a success message. All **19 tables** will be created (this includes the new `ai_chat_history` table!).

> 💡 You can also verify by going to **Table Editor** in the left sidebar — you should see all your tables listed (restaurants, users, menu_items, etc.).

---

## Step 4: Add the URL to Your `.env` File

Open `backend/.env` and add this line near the top:

```env
# Supabase Database (for migration script)
SUPABASE_DATABASE_URL=postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

> Do NOT change your `DATABASE_URL` yet. We will change it AFTER migration.

---

## Step 5: Run the Migration Script

Open your terminal in the `backend/` folder and run:

```bash
# Make sure you're in the virtual environment
# Windows:
.venv\Scripts\activate

# Run the migration
python migrate_to_supabase.py
```

You should see output like:
```
🚀 5ive POS Migration: SQLite → Supabase
✅ Connected to both databases!
📋 Step 1: Creating tables in Supabase...
   ✅ All 18 tables created successfully!
📋 Step 2: Migrating data...
   ✅ restaurants: 1/1 rows migrated
   ✅ users: 2/2 rows migrated
   ✅ menu_categories: 8/8 rows migrated
   ✅ menu_items: 25/25 rows migrated
   ...
🎉 MIGRATION COMPLETE!
```

---

## Step 6: Switch Your Backend to Supabase

Now that all data is safely in Supabase, update your `backend/.env` file:

```env
# ⬇️ COMMENT OUT the old SQLite line:
# DATABASE_URL=sqlite:///./restaurant_pos.db

# ⬇️ ADD the Supabase URL as your primary database:
DATABASE_URL=postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

---

## Step 7: Restart and Test

```bash
# Restart the backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open your frontend (`http://localhost:5173`) and verify:
- ✅ Login works
- ✅ Menu items load
- ✅ Ask AI responds
- ✅ Voice ordering works
- ✅ Dashboard shows data

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| `could not translate host name` | Check your Supabase URL for typos |
| `password authentication failed` | Replace `[YOUR-PASSWORD]` with your actual DB password |
| `relation "xxx" does not exist` | Re-run the schema in Supabase SQL Editor (Step 3) |
| `SSL error` | Add `?sslmode=require` to the end of your DATABASE_URL |
| `connection refused on port 5432` | Use port **6543** (Transaction Pooler), not 5432 |

---

## 🔒 Security Note

Never commit your Supabase password to Git! Your `.env` file should already be in `.gitignore`. Double-check:
```bash
# In .gitignore, make sure this line exists:
.env
```

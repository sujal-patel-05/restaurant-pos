# 🚀 Deployment Guide for 5ive POS

This guide outlines the recommended approach to deploy the 5ive POS system (FastAPI backend + React frontend) to production. We will use a modern, cost-effective serverless and platform-as-a-service (PaaS) architecture.

## 🏗️ Recommended Architecture Stack
- **Database**: **Supabase** (Managed PostgreSQL)
- **Backend API**: **Render** or **Railway** (Python/FastAPI)
- **Frontend App**: **Vercel** or **Netlify** (React/Vite)

---

## Step 1: Database Deployment (Supabase)
Since the system relies heavily on PostgreSQL (and you've previously explored migrating to Supabase), this is the optimal choice.

1. Create an account at [Supabase](https://supabase.com/).
2. Click **New Project**, choose an organization, and name it (e.g., `5ive-pos-db`).
3. Set a strong **Database Password** and select the nearest region to your users.
4. Click **Create new project**.
5. Once provisioned, go to **Project Settings** -> **Database**.
6. Find your **Connection String** (URI), which will look like: 
   `postgresql://postgres.xxx:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`
7. _Wait to run the database migrations until the backend is fully configured._

---

## Step 2: Backend Deployment (Render)
Render provides an easy way to deploy Python API services from a GitHub repository.

### Prerequisites (for Backend Repository)
Make sure your GitHub repository separates or provides a clear path to the `backend` directory. Your project already has a `requirements.txt` file which Render will automatically detect.

### Deployment Steps
1. Sign up for [Render](https://render.com/).
2. Click **New** -> **Web Service** -> **Build and deploy from a Git repository**.
3. Connect your GitHub account and select your `sujal-poss` repository. 
4. Configure the Web Service:
   - **Name**: `5ive-pos-backend`
   - **Root Directory**: `backend` (Important!)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Click **Advanced** and set the following **Environment Variables**:
   - `DATABASE_URL`: The Supabase URI you got from Step 1.
   - `SECRET_KEY`: Generate a random string (e.g., `openssl rand -hex 32`) for JWT decoding.
   - `GROQ_API_KEY` or `OPENAI_API_KEY`: Your key for AI functionality.
6. Click **Create Web Service**. 
7. Once deployed successfully, Render will give you a public URL (e.g., `https://5ive-pos-backend.onrender.com`). Keep this URL for Step 3.

### Run Database Migrations
Once your backend is live (or locally, pointing to the Supabase database), you need to initialize the tables:
```bash
# From your local backend directory, connected to the Supabase database:
# (Set your local .env DATABASE_URL to your new Supabase URI temporarily)
psql -d "YOUR_SUPABASE_DATABASE_URL" -f database/schema.sql
```

---

## Step 3: Frontend Deployment (Vercel)
Vercel is the creator of Next.js but is also specifically optimized for shipping Vite/React single-page applications.

### Deployment Steps
1. Push your latest code (including the frontend updates) to your GitHub repository.
2. Sign up for [Vercel](https://vercel.com/) and authorize your GitHub account.
3. Click **Add New** -> **Project** and select your `sujal-poss` repository.
4. Configure the Project:
   - **Project Name**: `5ive-pos`
   - **Framework Preset**: `Vite` (Vercel will usually auto-detect this).
   - **Root Directory**: Select `frontend` or type `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Open the **Environment Variables** panel and add:
   - **Name**: `VITE_API_URL`
   - **Value**: Your Render Backend URL from Step 2 (e.g., `https://5ive-pos-backend.onrender.com`). This ensures your `api.js` points to your production backend.
6. Click **Deploy**. 
7. Within minutes, Vercel will give you a public production URL (e.g., `https://5ive-pos.vercel.app`).

---

## 🚀 Post-Deployment Checklist

1. **Verify Database Authentication**: Go to your Vercel URL, open the developer tools (F12) to ensure network requests to your backend (`/api/auth/login`) are succeeding.
2. **CORS Settings**: If your backend API throws a `CORS error`, you must update FastAPI's CORS middleware inside `backend/main.py` and ensure the Vercel URL is added to your `origins` list:
   ```python
   origins = [
       "http://localhost:5173",
       "https://your-vercel-frontend-url.vercel.app"
   ]
   ```
   *If you do this, commit the change and push to GitHub, Render will automatically redeploy the backend.*
3. **Admin User Setup**: Create a new Restaurant or User account directly via the UI if you haven't seeded default admin credentials into the database yet.

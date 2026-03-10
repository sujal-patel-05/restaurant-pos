# SujalPOS — AI-Powered Restaurant Point-of-Sale System

**Project Title:** Intelligent Restaurant POS System with Multi-Agent AI Analytics  
**Developer:** Sujal Patel  
**Technology Stack:** FastAPI (Python) · React.js · SQLite · CrewAI · Groq LLM (Llama 3.3 70B) · NumPy  
**Course:** B.Tech Computer Science — AI/ML Specialization

---

## 1. Project Overview

SujalPOS is a **full-stack, production-grade Restaurant Point-of-Sale system** enhanced with multiple layers of Artificial Intelligence. Unlike traditional POS systems that only handle billing and order management, SujalPOS integrates **AI-driven analytics, natural language processing, multi-agent decision-making, and predictive forecasting** to transform raw restaurant data into actionable business intelligence.

The system simulates a real-world restaurant environment with 90 days of synthetic transaction data (7,000+ orders) and real-time online order simulation from platforms like Zomato and Swiggy.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React.js + Vite)               │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────────┐  │
│  │Dashboard │ POS      │ KDS      │ Reports  │ Ask AI Chat   │  │
│  │          │ Terminal  │ (Kitchen)│ + Charts │ (NLP Bot)     │  │
│  ├──────────┴──────────┴──────────┴──────────┴───────────────┤  │
│  │  Inventory Mgmt │ Menu Mgmt │ Billing │ Agent Insights    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  │  OnlineOrderNotification (Zomato/Swiggy Popup)            │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │ REST API
┌──────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI + Python)                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    AI LAYER (Core Focus)                    │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │ │
│  │  │ Ask AI      │  │ CrewAI       │  │ ML Forecasting    │  │ │
│  │  │ Chatbot     │  │ Multi-Agent  │  │ (NumPy Polynomial │  │ │
│  │  │ (NLP + LLM) │  │ System       │  │  Regression)      │  │ │
│  │  └──────┬──────┘  └──────┬───────┘  └───────────────────┘  │ │
│  │         │                │                                   │ │
│  │  ┌──────┴──────┐  ┌──────┴───────┐                          │ │
│  │  │ Groq LLM    │  │ 4 AI Agents  │                          │ │
│  │  │ (Llama 3.3  │  │ Inventory    │                          │ │
│  │  │  70B)       │  │ Sales        │                          │ │
│  │  │             │  │ Pricing      │                          │ │
│  │  │             │  │ Co-Pilot     │                          │ │
│  │  └─────────────┘  └──────────────┘                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   BUSINESS LOGIC LAYER                      │ │
│  │  OrderService · InventoryService · BillingService           │ │
│  │  ReportService · SnapshotService · OnlineOrderService       │ │
│  │  EmailService · PDFService · Scheduler (APScheduler)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    DATA LAYER (SQLite/SQLAlchemy)            │ │
│  │  Orders · OrderItems · KOTs · MenuItems · Categories        │ │
│  │  Ingredients · BOM · Payments · Invoices · DailySummary     │ │
│  │  WastageLog · InventoryTransactions · Users · Restaurants   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Features — Detailed Breakdown

### 3.1 Ask AI — Natural Language Chatbot (NLP + LLM)

**Purpose:** Allows restaurant staff to query business data using natural language instead of navigating complex dashboards.

**Architecture:** Hybrid 3-Layer NLP Pipeline

| Layer | Component | Technology | Purpose |
|-------|-----------|------------|---------|
| 1 | **Intent Classifier** | Rule-Based + LLM Fallback | Determines what the user is asking (sales, inventory, orders, menu, etc.) |
| 2 | **Query/Action Engine** | SQLAlchemy ORM | Translates intent into database queries or actions |
| 3 | **Response Generator** | Groq LLM (Llama 3.3 70B) | Generates natural language responses with formatting |

#### 3.1.1 Intent Classification (Hybrid Approach)

The system uses a **two-stage hybrid classifier**:

**Stage 1 — Rule-Based Classification (Fast Path)**
- Uses keyword pattern matching with weighted scoring
- 7 intent categories: `sales_query`, `inventory_query`, `order_status`, `menu_info`, `wastage_query`, `create_order`, `general`
- Entity extraction: time periods ("today", "this week", "last 30 days"), order numbers (ORD-XXXXXXXX-XXXX), item names, quantities
- Sub-100ms response time

**Stage 2 — LLM Classification (Complex Queries)**
- Falls back to Groq API when rule-based confidence is below threshold
- Uses carefully engineered prompt with few-shot examples
- Returns structured JSON with intent type, confidence score, and extracted entities

```
Example Flow:
User: "How much did we earn this week?"
  → Rule-Based: intent=sales_query, period=this_week, days=7 (confidence: 0.95)
  → Query Engine: SELECT SUM(total_amount) FROM orders WHERE created_at > 7_days_ago
  → Groq LLM: "📊 This week's revenue: ₹45,230 across 312 orders. Average order value: ₹145.
               That's a 12% increase from last week! Your top seller was Margherita Pizza (87 orders)."
```

#### 3.1.2 Query Engine

Translates classified intents into database queries:

| Intent | Query Type | Data Retrieved |
|--------|-----------|----------------|
| `sales_query` | Revenue aggregation with date filters | Total revenue, order count, AOV, daily trends, top items |
| `inventory_query` | Stock level + expiry checks | Low stock alerts, expiring items, reorder suggestions |
| `order_status` | Order lookup by number/status | Order details, items, timestamps, current status |
| `menu_info` | Menu item search (fuzzy matching) | Prices, availability, category, popularity |
| `wastage_query` | Wastage log aggregation | Total waste cost, top wasted items, reasons |

#### 3.1.3 Action Engine

Executes transactional operations via natural language:

- **"Create order: 2 burgers and 1 coke for table T5"**
  → Fuzzy matches menu items → Creates Order + OrderItems → Generates KOTs → Returns confirmation
- Uses SQLAlchemy transactions with rollback safety

#### 3.1.4 LLM Response Generation (Groq)

- **Model:** Llama 3.3 70B Versatile (via Groq Cloud API)
- **System Prompt:** Custom-engineered 100+ line prompt defining the AI's personality as a "restaurant consultant"
- **Features:** Markdown tables, bold highlights, chart data embedding, conversation history tracking
- **Fallback:** Template-based responses if LLM is unavailable

---

### 3.2 CrewAI Multi-Agent System (Autonomous AI Agents)

**Purpose:** Four specialized AI agents that work collaboratively to produce a daily planning brief — like having a team of consultants analyzing your restaurant 24/7.

**Framework:** CrewAI (Python) with Groq LLM backend  
**Trigger:** Scheduled daily at 8 AM via APScheduler (also manually triggerable)

#### Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CrewAI Orchestration                       │
│                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ 📦 Inventory  │  │ 💰 Sales      │  │ 🏷️ Pricing       │  │
│  │    Agent      │  │    Agent      │  │    Agent          │  │
│  │               │  │               │  │                    │  │
│  │ • Low stock   │  │ • Revenue     │  │ • Cost-per-dish   │  │
│  │ • Expiry risk │  │ • Peak hours  │  │ • Margin analysis │  │
│  │ • Wastage     │  │ • Item perf.  │  │ • Price suggest.  │  │
│  │ • Burn rates  │  │ • Trends      │  │ • Bundle ideas    │  │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬────────┘  │
│          │                  │                     │            │
│          └──────────────────┼─────────────────────┘            │
│                             ▼                                  │
│               ┌──────────────────────────┐                     │
│               │ 🎯 AI Co-Pilot Agent     │                     │
│               │    (Synthesizer)          │                     │
│               │                          │                     │
│               │ • Top 3 Priorities       │                     │
│               │ • Tomorrow's Forecast    │                     │
│               │ • Risk Alerts            │                     │
│               │ • Action Items           │                     │
│               └──────────────────────────┘                     │
│                             │                                  │
│                    ┌────────┴────────┐                          │
│                    │  Daily Brief    │                          │
│                    │  (Email + UI)   │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Agent Details

| Agent | Role | Tools Used | Output |
|-------|------|-----------|--------|
| **Inventory Agent** | Inventory Health Analyst | `get_low_stock_items`, `get_expiry_alerts`, `get_wastage_data`, `get_ingredient_usage` | Reorder alerts with urgency (CRITICAL/WARNING/OK), stockout ETA, FIFO recommendations |
| **Sales Agent** | Revenue Analyst | `get_sales_summary`, `get_peak_hours`, `get_item_performance`, `get_revenue_trends` | Top/bottom performers, peak hour staffing advice, growth trajectory |
| **Pricing Agent** | Dynamic Pricing Strategist | `get_cost_analysis`, `get_item_performance`, `get_peak_hours` | Price increase/decrease suggestions with expected revenue impact |
| **Co-Pilot Agent** | AI Restaurant Consultant | All context from above 3 agents | Unified daily brief with prioritized actions and forecasts |

#### Data Pre-Fetching Strategy

Instead of relying on LLM tool-calling (which can be unreliable), the system **pre-fetches all restaurant data** before agents start:
1. Queries all sales, inventory, and menu data from the database
2. Converts to JSON strings
3. Injects directly into agent task prompts
4. LLM agents only need to analyze — no tool calls needed

This makes the system **robust and deterministic**.

---

### 3.3 ML-Powered Sales Forecasting

**Purpose:** Predict future revenue trends using historical sales data.

**Algorithm:** Polynomial Regression (Degree-2) using NumPy

```python
# Actual implementation in report_service.py
coefficients = np.polyfit(x_values, y_revenue, deg=2)
polynomial = np.poly1d(coefficients)
forecast = polynomial(future_x_values)
```

| Parameter | Value |
|-----------|-------|
| Training Data | 30-90 days of daily revenue |
| Model | Quadratic polynomial (y = ax² + bx + c) |
| Forecast Horizon | 7 days |
| Output | Predicted daily revenue + confidence metrics (R², MAE) |
| Visualization | Interactive chart with actual vs predicted lines |

**Why Polynomial Regression?**
- Restaurant revenue follows cyclical patterns (weekday/weekend)
- Captures non-linear growth trends
- Lightweight — no ML framework dependencies (just NumPy)
- Interpretable coefficients for academic analysis

---

### 3.4 Online Order Simulation (Zomato/Swiggy)

**Purpose:** Simulates real-time food delivery platform orders to demonstrate a realistic multi-channel restaurant environment.

#### Flow

```
APScheduler (every 5 min) → Generates Random Order → Status: PENDING_ONLINE
     │
     ▼
Frontend Polling (every 10s) → Detects New Orders
     │
     ▼
Notification Popup (Platform-branded: 🔴 Zomato / 🟠 Swiggy)
  • Customer name, address, items, total
  • 2-minute countdown timer
  • Web Audio chime notification
     │
     ├─ [ACCEPT] → Status: PLACED → KOT Generated → Kitchen Display → Inventory Deducted
     │
     └─ [REJECT] → Status: CANCELLED (with reason)
```

#### Realistic Data Generation

| Feature | Implementation |
|---------|---------------|
| Customer Names | Pool of 28 Indian names (e.g., "Aarav Sharma", "Priya Patel") |
| Addresses | 15 realistic Indian residential addresses |
| Platform Split | 60% Zomato, 40% Swiggy (configurable) |
| Order Size | 1-4 items per order (weighted distribution) |
| Platform IDs | ZMT-XXXXXX / SWG-XXXXXX format |
| Special Instructions | "Extra spicy", "No onion garlic", "Jain-friendly", etc. |

---

### 3.5 Daily Snapshot Service (Data Warehousing)

**Purpose:** Pre-computes and stores daily aggregate metrics into a `DailySummary` table for fast historical queries. Enables period comparisons (this month vs last month) without expensive real-time aggregation.

**Computed Metrics per Day:** Total revenue, order count, average order value, top selling item, order type split, peak hour, payment mode distribution, wastage cost

---

### 3.6 Automated Email Briefing

**Purpose:** Sends the AI-generated daily planning brief as a premium HTML email to the restaurant owner every morning.

| Feature | Detail |
|---------|--------|
| Trigger | Daily cron job at 8 AM (configurable) |
| Content | Full Co-Pilot brief + individual agent reports |
| Format | Premium HTML email with styled sections, icons, colors |
| Delivery | SMTP via Gmail App Password |

---

## 4. Core POS Features (Non-AI)

| Module | Key Capabilities |
|--------|-----------------|
| **POS Terminal** | Place orders (dine-in/takeaway/delivery), item search, table management, special instructions |
| **Kitchen Display (KDS)** | Real-time KOT management, status updates (Placed → Preparing → Ready → Served), timer tracking |
| **Menu Management** | Categories, items, pricing, availability toggle, image upload |
| **Inventory Management** | Bill of Materials (BOM) per dish, stock tracking, auto-deduction on order, reorder levels, expiry dates, wastage logging |
| **Billing & Payments** | GST calculation, discounts, multi-mode payment (UPI/Cash/Card/Wallet), PDF invoice generation, email invoicing |
| **Reports Dashboard** | Sales trends (line charts), item-wise sales (bar charts), peak hours (heat map), wastage pie chart, cost-per-dish analysis, online vs offline analytics |
| **User Authentication** | JWT-based auth, role-based access (admin/staff), session management |

---

## 5. Technology Stack — Detailed

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React.js 18 + Vite | SPA with modern UI |
| **UI Charts** | Recharts | Interactive data visualizations |
| **Backend** | FastAPI (Python 3.11) | Async REST API |
| **ORM** | SQLAlchemy 2.0 | Database abstraction |
| **Database** | SQLite | Embedded, zero-config database |
| **AI Framework** | CrewAI | Multi-agent orchestration |
| **LLM Provider** | Groq Cloud (Llama 3.3 70B) | Fast inference for NLP tasks |
| **ML Library** | NumPy | Polynomial regression forecasting |
| **Scheduler** | APScheduler | Background jobs (daily brief, online orders) |
| **PDF Generation** | ReportLab | Invoice PDF creation |
| **Email** | smtplib + MIME | HTML email delivery |
| **Auth** | python-jose (JWT) | Token-based authentication |

---

## 6. Database Schema (13 Tables)

| Table | Records | Purpose |
|-------|---------|---------|
| `restaurants` | 1 | Restaurant configuration |
| `users` | 1+ | Staff accounts |
| `categories` | 5+ | Menu categories (Burgers, Pizzas, etc.) |
| `menu_items` | 10+ | Individual food items with prices |
| `ingredients` | 15+ | Raw materials inventory |
| `bill_of_materials` | 30+ | Recipe-to-ingredient mapping |
| `orders` | 7,000+ | All orders (3 months synthetic) |
| `order_items` | 12,000+ | Items within each order |
| `kots` | 12,000+ | Kitchen Order Tickets |
| `payments` | 6,500+ | Payment transactions |
| `invoices` | — | Generated PDF invoices |
| `wastage_log` | — | Food waste records |
| `daily_summary` | 90 | Pre-computed daily metrics |

---

## 7. AI Techniques Used — Academic Summary

| Technique | Application in SujalPOS | Classification |
|-----------|------------------------|----------------|
| **Natural Language Processing (NLP)** | Intent classification (rule-based + LLM), entity extraction, natural language understanding | Supervised / Unsupervised Hybrid |
| **Large Language Models (LLM)** | Response generation (Groq Llama 3.3 70B), intent fallback classification, data analysis | Transformer-based Generative AI |
| **Multi-Agent Systems (MAS)** | 4 autonomous agents (Inventory, Sales, Pricing, Co-Pilot) collaborating via CrewAI | Agent-Based AI |
| **Polynomial Regression** | Sales forecasting using historical revenue data | Machine Learning (Regression) |
| **Rule-Based AI** | Fast-path intent classification with keyword patterns | Expert Systems |
| **Fuzzy String Matching** | Menu item matching in voice/text orders (`ILIKE %term%`) | Information Retrieval |
| **Data Warehousing** | DailySummary table with pre-computed metrics | Database Optimization |
| **Prompt Engineering** | 100+ line system prompts for LLM personality and output formatting | AI Engineering |

---

## 8. How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API Key (free at [console.groq.com](https://console.groq.com))

### Backend
```bash
cd backend
pip install -r requirements.txt
pip install -r requirements_ai.txt
python create_admin.py          # Create admin user
python generate_sales_data.py   # Generate 90 days of data
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Opens at http://localhost:5173
```

### Environment Variables (backend/.env)
```
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
OWNER_EMAIL=owner@restaurant.com
SMTP_USER=your_gmail@gmail.com
SMTP_PASSWORD=your_app_password
AGENT_SCHEDULE_HOUR=8
ONLINE_ORDER_INTERVAL_MINUTES=5
```

---

## 9. Key Differentiators

| Feature | Traditional POS | SujalPOS |
|---------|----------------|----------|
| Data Analysis | Manual Excel exports | AI agents auto-analyze daily |
| Business Insights | None | Daily AI-generated planning brief |
| Chat Interface | Not available | Natural language querying ("How much did we earn today?") |
| Forecasting | None | ML-powered polynomial regression |
| Online Orders | Manual entry | Auto-simulated Zomato/Swiggy with approval workflow |
| Pricing Strategy | Owner's intuition | AI-driven margin analysis and price suggestions |
| Inventory Alerts | Basic reorder level | AI-computed burn rates, stockout ETAs, FIFO recommendations |

---

## 10. Future Scope

1. **Twilio Voice Integration** — Eva now handles real phone calls via Twilio.
2. **Computer Vision** — Camera-based plate recognition for automated billing
3. **Recommendation Engine** — Suggest upsells based on order history
4. **Real Zomato/Swiggy API Integration** — Replace simulation with live platform APIs
5. **Multi-Restaurant Support** — Chain management with centralized analytics
6. **Mobile App** — React Native version for on-the-go management

---

*Built with ❤️ by Sujal Patel — Demonstrating practical applications of AI in restaurant operations management.*

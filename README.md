# Restaurant POS System - Phase 1: Core POS (Production-Level)

A production-ready Restaurant Point of Sale system built with modern technologies, featuring ingredient-level inventory management with Bill of Materials (BOM), real-time kitchen display, comprehensive billing, and analytics.

## 🎯 Features

### Core POS Functionality
- **Order Management**: Complete order lifecycle from placement to completion
- **Kitchen Order Tickets (KOT)**: Auto-generated tickets for kitchen operations
- **Kitchen Display System (KDS)**: Real-time order display with color-coded urgency
- **Multi-Order Types**: Dine-in, Takeaway, Delivery support

### Inventory Management (Industry-Standard)
- **Ingredient-Level Tracking**: NOT item-based, uses ingredient-based inventory
- **Bill of Materials (BOM)**: Map menu items to ingredients with precise quantities
- **Auto-Deduction**: Automatic inventory deduction when orders are placed
- **Auto-Rollback**: Inventory restoration on order cancellation
- **Low Stock Alerts**: Notifications when ingredients below reorder level
- **Expiry Warnings**: Track ingredient expiration dates
- **Wastage Tracking**: Log expired/damaged/kitchen waste

### Billing & Payments
- **Multi-Payment Modes**: Cash, UPI, Card, Wallet
- **GST Calculation**: Configurable GST percentage
- **Discount System**: Percentage and fixed-value discounts with validation
- **Invoice Generation**: Auto-generated invoices with unique numbers
- **Payment History**: Complete transaction audit trail

### Reports & Analytics
- **Sales Reports**: Daily/weekly/monthly revenue analysis
- **Item-Wise Sales**: Best-selling items tracking
- **Peak Hours Analysis**: Identify busy periods
- **Ingredient Usage**: Track consumption patterns
- **Wastage Reports**: Cost analysis of wasted ingredients
- **Cost Per Dish**: Profit margin calculation via BOM

## 🏗️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT (JSON Web Tokens)
- **API Documentation**: Auto-generated OpenAPI/Swagger

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Styling**: Custom CSS with design system

## 📁 Project Structure

```
sujal-poss/
├── backend/
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic layer
│   ├── utils/           # Helper functions
│   ├── database/        # Database configuration
│   ├── config.py        # Settings management
│   ├── database.py      # DB connection
│   └── main.py          # FastAPI application
│
└── frontend/
    ├── src/
    │   ├── pages/       # React page components
    │   ├── services/    # API client
    │   ├── context/     # React context (auth)
    │   ├── App.jsx      # Main app component
    │   ├── main.jsx     # Entry point
    │   └── index.css    # Design system
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Linux/Mac
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   ```bash
   copy .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL`: PostgreSQL connection string
   - `SECRET_KEY`: JWT secret key (generate a secure random string)

5. **Create database**:
   ```bash
   # Using psql or pgAdmin, create a database:
   createdb restaurant_pos
   ```

6. **Run database schema**:
   ```bash
   psql -U postgres -d restaurant_pos -f database/schema.sql
   ```

7. **Start backend server**:
   ```bash
   python main.py
   ```
   
   Backend will run on `http://localhost:8000`
   API docs available at `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```
   
   Frontend will run on `http://localhost:5173`

## 📊 Database Schema

The system uses 15 normalized tables:

- `restaurants` - Multi-tenant restaurant data
- `users` - Authentication and user management
- `menu_categories` - Menu organization
- `menu_items` - Products/dishes
- `ingredients` - Raw materials with units
- `bom_mappings` - Bill of Materials (item → ingredients)
- `inventory` - Current stock levels
- `inventory_transactions` - Audit log for stock changes
- `orders` - Order headers
- `order_items` - Order line items
- `kot` - Kitchen Order Tickets
- `payments` - Payment records
- `invoices` - Generated invoices
- `wastage_logs` - Wastage tracking
- `discounts` - Discount configurations

## 🎨 Design System

The UI uses a locked color palette for consistent, premium appearance:

- **Primary Accent**: `#F63049` (Action buttons, highlights)
- **Secondary Accent**: `#D02752` (Active states, alerts)
- **Dark Accent**: `#8A244B` (Headers, urgency indicators)
- **Primary Dark**: `#111F35` (Main background)

Typography: Inter font family for modern, clean appearance

## 🔐 Authentication

1. **Register**: Create a new restaurant account
2. **Login**: Authenticate with username/password
3. **JWT Tokens**: Secure session management
4. **Protected Routes**: Automatic redirection for unauthorized access

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Menu
- `GET /api/menu/categories` - List categories
- `POST /api/menu/categories` - Create category
- `GET /api/menu/items` - List menu items
- `POST /api/menu/items` - Create menu item with BOM

### Inventory
- `GET /api/inventory/ingredients` - List ingredients
- `POST /api/inventory/ingredients` - Add ingredient
- `GET /api/inventory/alerts/low-stock` - Low stock alerts
- `POST /api/inventory/wastage` - Log wastage

### Orders
- `POST /api/orders/` - Create order (with stock validation)
- `GET /api/orders/` - List orders
- `PUT /api/orders/{id}/status` - Update order status
- `DELETE /api/orders/{id}` - Cancel order (with rollback)

### KDS
- `GET /api/kds/` - Get active KOTs
- `PUT /api/kds/{id}/status` - Update KOT status

### Billing
- `POST /api/billing/calculate/{order_id}` - Calculate bill
- `POST /api/billing/payment` - Process payment
- `POST /api/billing/invoice/{order_id}` - Generate invoice

### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/sales/items` - Item-wise sales
- `GET /api/reports/peak-hours` - Peak hours analysis
- `GET /api/reports/inventory/usage` - Ingredient usage
- `GET /api/reports/wastage` - Wastage report
- `GET /api/reports/cost-analysis/{item_id}` - Cost per dish

## 🔄 Key Workflows

### Order Placement Flow
1. Cashier selects menu items in POS Terminal
2. System validates ingredient availability via BOM
3. If stock sufficient, order is created
4. Inventory automatically deducted for each ingredient
5. KOT generated and sent to Kitchen Display
6. Kitchen staff updates status (Preparing → Ready → Completed)

### Order Cancellation Flow
1. Order cancelled before completion
2. System retrieves all inventory deduction transactions
3. Ingredients automatically restored to previous levels
4. Transaction logged for audit trail

### BOM-Based Inventory
Example: Pizza requires:
- Cheese: 100g
- Flour: 200g
- Sauce: 50g

When 1 Pizza ordered:
- Cheese stock: 5kg → 4.9kg
- Flour stock: 10kg → 9.8kg
- Sauce stock: 2kg → 1.95kg

## 🚨 Important Notes

- **Ingredient-Level Inventory**: This system uses ingredient-based inventory (NOT item-based)
- **BOM Required**: All menu items must have BOM mappings before they can be sold
- **Transaction Safety**: All inventory operations are transaction-safe to prevent race conditions
- **Multi-Tenant**: Each restaurant has isolated data

## 📈 Future Enhancements (Phase 2)

- AI-powered demand forecasting
- Automated reordering
- Customer loyalty program
- Table management
- Staff scheduling
- Mobile app for waiters
- Advanced analytics with ML

## 📄 License

This is a production-level system built for real-world restaurant operations.

## 👥 Support

For issues or questions, please refer to the API documentation at `/docs` when the backend is running.

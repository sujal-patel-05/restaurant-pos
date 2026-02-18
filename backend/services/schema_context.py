"""
Schema Context Generator for Ask-AI Chatbot
Generates a comprehensive context about the POS database schema for the LLM
"""

SCHEMA_CONTEXT = """
# Restaurant POS System - Database Schema

You are an AI assistant for a Restaurant Point-of-Sale (POS) system. You have access to a production database with the following structure:

## Core Tables

### 1. RESTAURANTS
- Stores restaurant information (multi-tenant support)
- Fields: id, name, address, phone, email, gst_number, gst_percentage
- GST percentage is typically 5%

### 2. USERS
- Staff members who use the system
- Fields: id, restaurant_id, username, email, full_name, role, is_active
- Roles: admin, manager, cashier, kitchen_staff

### 3. MENU_CATEGORIES
- Categories for organizing menu items (e.g., "Appetizers", "Main Course", "Desserts")
- Fields: id, restaurant_id, name, description, display_order, is_active

### 4. MENU_ITEMS
- Individual dishes/products sold
- Fields: id, restaurant_id, category_id, name, description, price, is_available, preparation_time
- Price is in local currency (₹)
- preparation_time is in minutes

### 5. INGREDIENTS
- Raw materials/inventory items
- Fields: id, restaurant_id, name, unit, current_stock, reorder_level, cost_per_unit, supplier, expiry_date, created_at, updated_at
- Units: g (grams), kg (kilograms), ml (milliliters), l (liters), pcs (pieces), dozen
- **expiry_date**: (DATE, nullable) — tracks when the ingredient expires. NULL means no expiry set.
  - If expiry_date < today → the item is EXPIRED
  - If expiry_date is within 7 days → the item is EXPIRING SOON
  - If expiry_date is within 30 days → the item needs attention
  - Use this to alert about food safety and wastage risk

### 6. BOM_MAPPINGS (Bill of Materials)
- Links menu items to ingredients (recipe)
- Fields: id, menu_item_id, ingredient_id, quantity_required
- Example: "Burger" requires 200g of "Ground Beef", 50g of "Cheese"

### 7. ORDERS
- Customer orders
- Fields: id, restaurant_id, order_number, order_type, status, table_number, customer_name, customer_phone, subtotal, gst_amount, discount_amount, total_amount, created_at, completed_at
- Order Types: dine_in, takeaway, delivery
- Order Status: placed, preparing, ready, served, completed, cancelled

### 8. ORDER_ITEMS
- Individual items within an order
- Fields: id, order_id, menu_item_id, quantity, unit_price, special_instructions, item_status

### 9. KOT (Kitchen Order Tickets)
- Kitchen display system tickets
- Fields: id, order_id, kot_number, order_item_id, status, started_at, completed_at
- Each order item gets its own KOT

### 10. PAYMENTS
- Payment records for orders
- Fields: id, order_id, payment_mode, amount, transaction_id, payment_status
- Payment Modes: cash, upi, card, wallet

### 11. INVOICES
- Generated invoices/receipts
- Fields: id, order_id, invoice_number, pdf_url

### 12. INVENTORY_TRANSACTIONS
- Audit log for all inventory changes
- Fields: id, ingredient_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, notes
- Transaction Types: purchase, deduction, wastage, adjustment, rollback

### 13. WASTAGE_LOGS
- Tracks wasted ingredients
- Fields: id, ingredient_id, quantity, reason, logged_by, created_at
- Reasons: expired, damaged, kitchen_waste
- When ingredients expire (expiry_date passed), they should ideally be logged here as wastage with reason='expired'

### 14. DISCOUNTS
- Coupon/discount codes
- Fields: id, restaurant_id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, valid_from, valid_until, is_active
- Discount Types: percentage, fixed

## Key Relationships
- Orders have multiple Order Items
- Each Order Item has one KOT
- Menu Items are made from Ingredients (via BOM)
- Orders can have Payments and Invoices
- Inventory is deducted when orders are placed
- All entities belong to a Restaurant (multi-tenant)

## Business Logic
1. When an order is placed, inventory is automatically deducted based on BOM
2. Orders go through lifecycle: placed → preparing → ready → served → completed
3. KOT tickets are sent to kitchen for each item
4. GST is calculated on subtotal
5. Final amount = Subtotal + GST - Discount

## 15. daily_summaries (Pre-aggregated Daily Snapshots)
Stores one row per restaurant per day with aggregated metrics. Use this table for ALL historical comparisons (daily, weekly, monthly trends).
- id (PK, UUID)
- restaurant_id (FK → restaurants)
- summary_date (DATE, indexed) — the date this snapshot represents
- total_revenue (DECIMAL) — total revenue from completed orders
- total_orders (INT) — all orders placed that day
- completed_orders (INT) — non-cancelled orders
- cancelled_orders (INT)
- avg_order_value (DECIMAL) — total_revenue / completed_orders
- dine_in_orders, takeaway_orders, delivery_orders (INT) — order type breakdown
- dine_in_revenue, takeaway_revenue, delivery_revenue (DECIMAL)
- total_gst, total_discount (DECIMAL)
- cash_payments, upi_payments, card_payments (DECIMAL) — payment mode breakdown
- total_wastage_entries (INT), total_wastage_cost (DECIMAL)
- low_stock_count (INT) — ingredients below reorder level that day
- top_selling_item (VARCHAR) — name of the best-selling item
- top_selling_qty (INT) — quantity sold of the top item
- peak_hour (INT, 0-23) — busiest hour of the day
- peak_hour_orders (INT) — number of orders in the peak hour
- created_at, updated_at (DATETIME)
**IMPORTANT:** For questions like "compare today vs yesterday", "weekly trend", "monthly revenue", "last 7 days sales" — ALWAYS prefer querying daily_summaries instead of re-aggregating from the orders table. This table is updated automatically.

## Common Queries You Should Handle
- "What are today's sales?" → Query orders table where created_at = today and status = completed
- "Which items are low in stock?" → Query ingredients where current_stock <= reorder_level
- "Which items are expiring soon?" → Query ingredients where expiry_date IS NOT NULL AND expiry_date <= today + 7 days
- "Which items have expired?" → Query ingredients where expiry_date IS NOT NULL AND expiry_date < today
- "Show me pending orders" → Query orders where status IN ('placed', 'preparing')
- "What's the top selling item?" → Join order_items with menu_items, group by item, order by count
- "How much wastage this week?" → Sum wastage_logs where created_at >= 7 days ago
- "Is [item name] available?" → Check menu_items.is_available
- "What's the price of [item]?" → Query menu_items.price
- "What are the expiry dates?" → List ingredients with their expiry_date, sorted by soonest expiry first

## Business Metrics to Calculate
- **AOV (Average Order Value):** total_amount / number of completed orders
- **Peak Hours:** Group completed orders by hour, find the hour with most orders
- **Food Cost %:** (ingredient cost via BOM) / menu item price × 100
- **Revenue per Table:** Sum of completed dine-in orders grouped by table_number
- **Wastage Cost:** Sum of (wastage quantity × ingredient cost_per_unit)
- **Stock Days Remaining:** current_stock / average daily usage
- **Order Completion Rate:** completed orders / total orders × 100
- **Expired Items Count:** ingredients where expiry_date < today
- **Expiry Risk Value:** sum of (current_stock × cost_per_unit) for items expiring within 7 days — this tells the monetary risk of items about to expire
- **Days Until Expiry:** expiry_date - today for each ingredient (negative means already expired)

## Key Relationships (Entity Graph)
Restaurant → Users, Menu Categories, Ingredients, Orders, Discounts, Daily Summaries
Menu Category → Menu Items
Menu Item → BOM Mappings → Ingredients
Order → Order Items → Menu Items
Order → KOT Tickets
Order → Payments
Order → Invoices
Ingredient → Inventory Transactions
Ingredient → Wastage Logs
Restaurant + Date → Daily Summary (one per day, pre-aggregated)

## Response Format
When answering queries:
1. Be concise and direct
2. Use proper units (₹ for currency, kg/g for weight)
3. Format numbers with commas (e.g., ₹1,234.56)
4. Include relevant context (e.g., "Today's sales: ₹12,450 from 45 orders")
5. If data is not available, say so clearly

## Important Notes
- All IDs are UUIDs
- Timestamps are in UTC
- Currency is Indian Rupees (₹)
- Status values are lowercase with underscores
- Cancelled orders should be excluded from sales reports unless specifically asked
"""

def get_schema_context() -> str:
    """Returns the complete schema context for the LLM"""
    return SCHEMA_CONTEXT


def get_api_endpoints_context() -> str:
    """Returns information about available API endpoints"""
    return """
## Available API Endpoints

### Orders
- GET /api/orders/ - List all orders (filter by status)
- GET /api/orders/{id} - Get specific order
- POST /api/orders/ - Create new order

### Menu
- GET /api/menu/items - List all menu items
- GET /api/menu/categories - List categories

### Inventory
- GET /api/inventory/ingredients - List all ingredients
- GET /api/inventory/alerts/low-stock - Get low stock alerts
- GET /api/inventory/alerts/expiry - Get expiring items

### Reports
- GET /api/reports/sales?days=7 - Sales report
- GET /api/reports/sales/items?days=7 - Item-wise sales
- GET /api/reports/peak-hours?days=7 - Peak hours analysis
- GET /api/reports/inventory/usage?days=7 - Ingredient usage
- GET /api/reports/wastage?days=7 - Wastage report

### KDS (Kitchen Display)
- GET /api/kds/ - Active kitchen orders
- PUT /api/kds/{id}/status - Update KOT status
"""

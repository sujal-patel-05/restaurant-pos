-- ============================================================
-- 5ive POS - Complete Supabase Schema
-- Run this ONCE when setting up a new Supabase project.
-- This includes ALL 19 tables including Voice Ordering, Analytics, & AI Chat.
-- ============================================================

-- ── 1. RESTAURANTS ──
CREATE TABLE IF NOT EXISTS restaurants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    gst_number VARCHAR(50),
    gst_percentage DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. USERS ──
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. MENU CATEGORIES ──
CREATE TABLE IF NOT EXISTS menu_categories (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. MENU ITEMS ──
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id VARCHAR(36) REFERENCES menu_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    preparation_time INTEGER DEFAULT 15,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. INGREDIENTS ──
CREATE TABLE IF NOT EXISTS ingredients (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    current_stock DECIMAL(10,2) DEFAULT 0,
    reorder_level DECIMAL(10,2) DEFAULT 0,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    supplier VARCHAR(255),
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. BOM MAPPINGS ──
CREATE TABLE IF NOT EXISTS bom_mappings (
    id VARCHAR(36) PRIMARY KEY,
    menu_item_id VARCHAR(36) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id VARCHAR(36) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_item_id, ingredient_id)
);

-- ── 7. INVENTORY TRANSACTIONS ──
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id VARCHAR(36) PRIMARY KEY,
    ingredient_id VARCHAR(36) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    previous_stock DECIMAL(10,2) NOT NULL,
    new_stock DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(36),
    notes TEXT,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 8. TABLE CONFIGS (Voice Ordering) ──
CREATE TABLE IF NOT EXISTS table_configs (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id VARCHAR(20) UNIQUE NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    table_name VARCHAR(100),
    capacity INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 9. TABLE SESSIONS (Voice Ordering) ──
CREATE TABLE IF NOT EXISTS table_sessions (
    id VARCHAR(100) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_config_id VARCHAR(36) REFERENCES table_configs(id),
    table_id VARCHAR(20) NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    session_token TEXT,
    pax INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 10. ORDERS ──
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in',
    order_source VARCHAR(20) NOT NULL DEFAULT 'pos',
    status VARCHAR(20) NOT NULL DEFAULT 'placed',
    table_number VARCHAR(20),
    delivery_address VARCHAR(500),
    platform_order_id VARCHAR(100),
    rejection_reason VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    special_instructions TEXT,
    waiter_name VARCHAR(255),
    session_id VARCHAR(100) REFERENCES table_sessions(id),
    voice_log_id VARCHAR(36),
    subtotal DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ── 11. ORDER ITEMS ──
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(36) NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    item_status VARCHAR(20) DEFAULT 'placed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 12. VOICE ORDER LOGS ──
CREATE TABLE IF NOT EXISTS voice_order_logs (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES table_sessions(id),
    table_id VARCHAR(20) NOT NULL,
    audio_file_path VARCHAR(500),
    raw_transcript TEXT,
    parsed_json TEXT,
    matched_json TEXT,
    confidence_avg FLOAT DEFAULT 0.0,
    order_id VARCHAR(36) REFERENCES orders(id),
    was_confirmed BOOLEAN DEFAULT FALSE,
    was_edited BOOLEAN DEFAULT FALSE,
    whisper_model VARCHAR(20) DEFAULT 'base',
    processing_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add FK for voice_log_id in orders (after voice_order_logs exists)
-- ALTER TABLE orders ADD CONSTRAINT fk_voice_log FOREIGN KEY (voice_log_id) REFERENCES voice_order_logs(id);

-- ── 13. KOT (Kitchen Order Tickets) ──
CREATE TABLE IF NOT EXISTS kot (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kot_number VARCHAR(50) UNIQUE NOT NULL,
    order_item_id VARCHAR(36) NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'placed',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 14. DISCOUNTS ──
CREATE TABLE IF NOT EXISTS discounts (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 15. PAYMENTS ──
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_mode VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_id VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 16. INVOICES ──
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 17. WASTAGE LOGS ──
CREATE TABLE IF NOT EXISTS wastage_logs (
    id VARCHAR(36) PRIMARY KEY,
    ingredient_id VARCHAR(36) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255),
    logged_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 18. DAILY SUMMARIES (Analytics) ──
CREATE TABLE IF NOT EXISTS daily_summaries (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    dine_in_orders INTEGER DEFAULT 0,
    takeaway_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    dine_in_revenue DECIMAL(12,2) DEFAULT 0,
    takeaway_revenue DECIMAL(12,2) DEFAULT 0,
    delivery_revenue DECIMAL(12,2) DEFAULT 0,
    total_gst DECIMAL(10,2) DEFAULT 0,
    total_discount DECIMAL(10,2) DEFAULT 0,
    cash_payments DECIMAL(12,2) DEFAULT 0,
    upi_payments DECIMAL(12,2) DEFAULT 0,
    card_payments DECIMAL(12,2) DEFAULT 0,
    total_wastage_entries INTEGER DEFAULT 0,
    total_wastage_cost DECIMAL(10,2) DEFAULT 0,
    low_stock_count INTEGER DEFAULT 0,
    top_selling_item VARCHAR(255),
    top_selling_qty INTEGER DEFAULT 0,
    peak_hour INTEGER,
    peak_hour_orders INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, summary_date)
);

-- ── INDEXES FOR PERFORMANCE ──
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant ON ingredients(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_ingredient ON inventory_transactions(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_kot_order ON kot(order_id);
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant ON table_sessions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_session ON voice_order_logs(session_id);

-- ── 19. AI CHAT HISTORY ──
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) DEFAULT 'New Chat',
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversation ON ai_chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_restaurant_user ON ai_chat_history(restaurant_id, user_id);


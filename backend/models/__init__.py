# Import all models for easy access
from models.restaurant import Restaurant, User, UserRole
from models.menu import MenuCategory, MenuItem
from models.inventory import Ingredient, BOMMaping, InventoryTransaction, WastageLog, UnitType
from models.order import Order, OrderItem, KOT, OrderStatus, OrderType
from models.billing import Payment, Invoice, Discount, PaymentMode

__all__ = [
    "Restaurant",
    "User",
    "UserRole",
    "MenuCategory",
    "MenuItem",
    "Ingredient",
    "BOMMaping",
    "InventoryTransaction",
    "WastageLog",
    "UnitType",
    "Order",
    "OrderItem",
    "KOT",
    "OrderStatus",
    "OrderType",
    "Payment",
    "Invoice",
    "Discount",
    "PaymentMode",
]

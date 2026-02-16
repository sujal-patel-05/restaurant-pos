from datetime import datetime

def generate_order_number(restaurant_id: str) -> str:
    """Generate unique order number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    import random
    suffix = random.randint(1000, 9999)
    return f"ORD-{timestamp[-8:]}-{suffix}"

def generate_kot_number(order_number: str, item_index: int) -> str:
    """Generate KOT number from order number"""
    return f"KOT-{order_number.split('-')[1]}-{item_index}"

def generate_invoice_number(restaurant_id: str) -> str:
    """Generate unique invoice number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"INV-{timestamp[-8:]}"

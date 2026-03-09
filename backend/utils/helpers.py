from datetime import datetime

def generate_order_number(restaurant_id: str) -> str:
    """Generate unique order number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    import random
    suffix = random.randint(1000, 9999)
    return f"ORD-{timestamp[-8:]}-{suffix}"

def generate_kot_number(order_number: str, item_index: int) -> str:
    """Generate KOT number from order number"""
    parts = order_number.split('-')
    if len(parts) >= 3:
        order_ref = f"{parts[1]}{parts[2]}"
    else:
        order_ref = datetime.now().strftime("%H%M%S%f")[-12:]
    return f"KOT-{order_ref}-{item_index}"

def generate_invoice_number(restaurant_id: str) -> str:
    """Generate unique invoice number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"INV-{timestamp[-8:]}"

"""
Script to convert all UUID fields to String(36) for SQLite compatibility
"""
import re
import os

def convert_file(filepath):
    """Convert UUID fields to String(36) in a Python file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove UUID import from postgresql
    content = re.sub(r'from sqlalchemy\.dialects\.postgresql import UUID\n', '', content)
    
    # Replace UUID(as_uuid=True) with String(36)
    content = re.sub(r'UUID\(as_uuid=True\)', 'String(36)', content)
    
    # Replace default=uuid.uuid4 with default=lambda: str(uuid.uuid4())
    content = re.sub(r'default=uuid\.uuid4\)', 'default=lambda: str(uuid.uuid4()))', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Converted: {os.path.basename(filepath)}")

# Convert all model files
model_files = [
    'models/menu.py',
    'models/inventory.py',
    'models/order.py',
    'models/billing.py'
]

for model_file in model_files:
    convert_file(model_file)

print("\n✅ All model files converted to SQLite-compatible format!")

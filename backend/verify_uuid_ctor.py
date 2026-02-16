
from uuid import uuid4, UUID
import sys

try:
    u1 = uuid4()
    print(f"u1 type: {type(u1)}, value: {u1}")
    
    # This is what I suspect is failing
    u2 = UUID(u1) 
    print(f"u2: {u2}")
    
except Exception as e:
    print(f"Caught expected error: {e}")
    import traceback
    traceback.print_exc()

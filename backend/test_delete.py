import requests

# Get all ingredients
r = requests.get('http://localhost:8000/api/inventory/ingredients')
ingredients = r.json()
print(f'Total ingredients: {len(ingredients)}')

if ingredients:
    # Get first ingredient
    ing = ingredients[0]
    ing_id = ing['id']
    ing_name = ing['name']
    
    print(f'\nTesting delete for: {ing_name}')
    print(f'ID: {ing_id}')
    
    # Try to delete
    del_r = requests.delete(f'http://localhost:8000/api/inventory/ingredients/{ing_id}')
    print(f'\nDelete Status Code: {del_r.status_code}')
    print(f'Delete Response: {del_r.text}')
    
    # Verify deletion
    r2 = requests.get('http://localhost:8000/api/inventory/ingredients')
    print(f'\nIngredients after delete: {len(r2.json())}')
else:
    print('No ingredients to delete')

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models import Ingredient, BOMMaping, InventoryTransaction, MenuItem
from decimal import Decimal
from typing import List, Dict
from uuid import UUID
from datetime import datetime

class InventoryService:
    """
    Core inventory service handling BOM-based automatic deduction
    """
    
    @staticmethod
    def check_stock_availability(db: Session, menu_item_id: UUID, quantity: int) -> Dict:
        """
        Check if sufficient ingredients are available for a menu item
        Returns: {available: bool, missing_ingredients: list}
        """
        # Get BOM mappings for the menu item
        # Ensure we use string for UUID lookup in SQLite
        bom_mappings = db.query(BOMMaping).filter(
            BOMMaping.menu_item_id == str(menu_item_id)
        ).all()
        
        if not bom_mappings:
            return {
                "available": False,
                "error": "No BOM mapping found for this item. Please configure BOM first."
            }
        
        missing_ingredients = []
        
        for bom in bom_mappings:
            ingredient = db.query(Ingredient).filter(
                Ingredient.id == bom.ingredient_id
            ).first()
            
            required_quantity = bom.quantity_required * quantity
            
            if ingredient.current_stock < required_quantity:
                missing_ingredients.append({
                    "ingredient_name": ingredient.name,
                    "required": float(required_quantity),
                    "available": float(ingredient.current_stock),
                    "unit": ingredient.unit.value
                })
        
        if missing_ingredients:
            return {
                "available": False,
                "missing_ingredients": missing_ingredients
            }
        
        return {"available": True}
    
    @staticmethod
    def deduct_inventory(
        db: Session, 
        menu_item_id: UUID, 
        quantity: int, 
        order_id: UUID,
        user_id: UUID = None
    ) -> bool:
        """
        Deduct ingredients from inventory based on BOM
        This is called when an order is placed
        """
        try:
            # Get BOM mappings
            bom_mappings = db.query(BOMMaping).filter(
                BOMMaping.menu_item_id == menu_item_id
            ).all()
            
            for bom in bom_mappings:
                ingredient = db.query(Ingredient).filter(
                    Ingredient.id == bom.ingredient_id
                ).first()
                
                deduction_quantity = bom.quantity_required * quantity
                previous_stock = ingredient.current_stock
                new_stock = previous_stock - deduction_quantity
                
                # Update ingredient stock
                ingredient.current_stock = new_stock
                ingredient.updated_at = datetime.utcnow()
                
                # Log transaction
                transaction = InventoryTransaction(
                    ingredient_id=ingredient.id,
                    transaction_type="deduction",
                    quantity=-deduction_quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reference_type="order",
                    reference_id=order_id,
                    notes=f"Auto-deduction for order",
                    created_by=user_id
                )
                db.add(transaction)
            
            db.commit()
            return True
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    @staticmethod
    def rollback_inventory(db: Session, order_id: UUID) -> bool:
        """
        Rollback inventory deductions when an order is cancelled
        """
        try:
            # Get all deduction transactions for this order
            transactions = db.query(InventoryTransaction).filter(
                InventoryTransaction.reference_type == "order",
                InventoryTransaction.reference_id == order_id,
                InventoryTransaction.transaction_type == "deduction"
            ).all()
            
            for transaction in transactions:
                ingredient = db.query(Ingredient).filter(
                    Ingredient.id == transaction.ingredient_id
                ).first()
                
                # Reverse the deduction
                rollback_quantity = abs(transaction.quantity)
                previous_stock = ingredient.current_stock
                new_stock = previous_stock + rollback_quantity
                
                # Update ingredient stock
                ingredient.current_stock = new_stock
                ingredient.updated_at = datetime.utcnow()
                
                # Log rollback transaction
                rollback_transaction = InventoryTransaction(
                    ingredient_id=ingredient.id,
                    transaction_type="rollback",
                    quantity=rollback_quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reference_type="order",
                    reference_id=order_id,
                    notes=f"Rollback for cancelled order"
                )
                db.add(rollback_transaction)
            
            db.commit()
            return True
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    @staticmethod
    def get_low_stock_alerts(db: Session, restaurant_id: UUID) -> List[Dict]:
        """
        Get ingredients that are below reorder level
        """
        ingredients = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant_id,
            Ingredient.current_stock <= Ingredient.reorder_level
        ).all()
        
        return [
            {
                "id": str(ingredient.id),
                "name": ingredient.name,
                "current_stock": float(ingredient.current_stock),
                "reorder_level": float(ingredient.reorder_level),
                "unit": ingredient.unit.value
            }
            for ingredient in ingredients
        ]
    
    @staticmethod
    def get_expiry_alerts(db: Session, restaurant_id: UUID, days: int = 7) -> List[Dict]:
        """
        Get ingredients expiring within specified days
        """
        from datetime import date, timedelta
        
        expiry_date = date.today() + timedelta(days=days)
        
        ingredients = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant_id,
            Ingredient.expiry_date.isnot(None),
            Ingredient.expiry_date <= expiry_date
        ).all()
        
        return [
            {
                "id": str(ingredient.id),
                "name": ingredient.name,
                "current_stock": float(ingredient.current_stock),
                "expiry_date": ingredient.expiry_date.isoformat(),
                "unit": ingredient.unit.value
            }
            for ingredient in ingredients
        ]

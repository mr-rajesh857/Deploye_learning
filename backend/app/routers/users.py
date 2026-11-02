from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, UserRole, LeaveBalance, LeaveType
from app.schemas import UserOut, LeaveBalanceOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[UserOut])
def list_users(
    department: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List employees directory"""
    query = db.query(User).filter(User.is_active == True)
    if department:
        query = query.filter(User.department == department)
    return query.order_by(User.full_name).all()

@router.get("/{user_id}", response_model=UserOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

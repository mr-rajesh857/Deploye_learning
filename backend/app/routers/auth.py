from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models import User, UserRole, LeaveBalance
from app.schemas import LoginRequest, Token, UserOut
from app.auth_utils import verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    # Support bearer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.email == payload["sub"]).first()
            if user and user.is_active:
                return user
    
    if x_user_id:
        try:
            uid = int(x_user_id)
            user = db.query(User).filter(User.id == uid, User.is_active == True).first()
            if user:
                return user
        except ValueError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in."
    )

@router.post("/login", response_model=Token)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    token = create_access_token(data={"sub": user.email, "role": user.role.value, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/demo-users", response_model=List[UserOut])
def get_demo_users(db: Session = Depends(get_db)):
    """Returns available users for fast persona switching in the demo UI"""
    return db.query(User).filter(User.is_active == True).order_by(User.id).all()

@router.post("/switch-user/{user_id}", response_model=Token)
def switch_user(user_id: int, db: Session = Depends(get_db)):
    """Generates an instant session token for the selected persona"""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_access_token(data={"sub": user.email, "role": user.role.value, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

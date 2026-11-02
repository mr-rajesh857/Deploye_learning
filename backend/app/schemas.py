from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models import UserRole, LeaveStatus, HalfDayPeriod

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    department: str
    designation: str
    phone: Optional[str] = None
    avatar_color: Optional[str] = "#4F46E5"

class UserCreate(UserBase):
    password: str
    manager_id: Optional[int] = None

class UserOut(UserBase):
    id: int
    manager_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Leave Type Schemas
class LeaveTypeBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    default_days: float
    color: str
    requires_attachment: bool = False
    is_active: bool = True

class LeaveTypeOut(LeaveTypeBase):
    id: int

    class Config:
        from_attributes = True

# Leave Balance Schemas
class LeaveBalanceOut(BaseModel):
    id: int
    user_id: int
    leave_type_id: int
    leave_type_name: str
    leave_type_code: str
    color: str
    year: int
    allocated_days: float
    used_days: float
    pending_days: float
    carry_forward_days: float
    available_days: float

    class Config:
        from_attributes = True

# Leave Request Schemas
class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    is_half_day: bool = False
    half_day_period: Optional[HalfDayPeriod] = HalfDayPeriod.NONE
    reason: str = Field(..., min_length=3, max_length=1000)
    emergency_contact: Optional[str] = None

class LeaveStatusUpdate(BaseModel):
    status: LeaveStatus
    manager_comment: Optional[str] = None

class AuditLogOut(BaseModel):
    id: int
    actor_id: int
    actor_name: Optional[str] = None
    action: str
    comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LeaveRequestOut(BaseModel):
    id: int
    request_number: str
    user_id: int
    user_name: str
    user_department: str
    user_email: str
    leave_type_id: int
    leave_type_name: str
    leave_type_code: str
    leave_type_color: str
    start_date: date
    end_date: date
    total_days: float
    is_half_day: bool
    half_day_period: HalfDayPeriod
    reason: str
    emergency_contact: Optional[str] = None
    status: LeaveStatus
    manager_comment: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    audit_logs: List[AuditLogOut] = []

    class Config:
        from_attributes = True

# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# Analytics & Dashboard Schemas
class DashboardStats(BaseModel):
    total_allocated_leaves: float
    total_used_leaves: float
    total_pending_leaves: float
    total_available_leaves: float
    pending_approvals_count: int
    team_members_count: int
    on_leave_today_count: int
    leaves_by_type: List[dict]
    recent_requests: List[LeaveRequestOut]

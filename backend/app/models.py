import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Float, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    HR_ADMIN = "hr_admin"

class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class HalfDayPeriod(str, enum.Enum):
    NONE = "none"
    FIRST_HALF = "first_half"
    SECOND_HALF = "second_half"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE, nullable=False)
    department = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    phone = Column(String(50), nullable=True)
    avatar_color = Column(String(50), default="#4F46E5")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    manager = relationship("User", remote_side=[id], backref="direct_reports")
    leave_requests = relationship("LeaveRequest", foreign_keys="LeaveRequest.user_id", back_populates="user", cascade="all, delete-orphan")
    reviewed_requests = relationship("LeaveRequest", foreign_keys="LeaveRequest.reviewed_by_id", back_populates="reviewer")
    balances = relationship("LeaveBalance", back_populates="user", cascade="all, delete-orphan")

class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False) # e.g. AL, SL, CL, ML, UL
    description = Column(Text, nullable=True)
    default_days = Column(Float, default=15.0)
    color = Column(String(20), default="#3B82F6") # hex tag color
    requires_attachment = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    balances = relationship("LeaveBalance", back_populates="leave_type", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="leave_type")

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, default=datetime.utcnow().year, nullable=False)
    allocated_days = Column(Float, default=0.0)
    used_days = Column(Float, default=0.0)
    pending_days = Column(Float, default=0.0)
    carry_forward_days = Column(Float, default=0.0)

    user = relationship("User", back_populates="balances")
    leave_type = relationship("LeaveType", back_populates="balances")

    @property
    def available_days(self) -> float:
        return max(0.0, (self.allocated_days + self.carry_forward_days) - (self.used_days + self.pending_days))

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Float, nullable=False)
    
    is_half_day = Column(Boolean, default=False)
    half_day_period = Column(Enum(HalfDayPeriod), default=HalfDayPeriod.NONE)
    
    reason = Column(Text, nullable=False)
    emergency_contact = Column(String(100), nullable=True)
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING, index=True)
    
    manager_comment = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="leave_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], back_populates="reviewed_requests")
    leave_type = relationship("LeaveType", back_populates="leave_requests")
    audit_logs = relationship("AuditLog", back_populates="leave_request", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False) # CREATED, APPROVED, REJECTED, CANCELLED
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    leave_request = relationship("LeaveRequest", back_populates="audit_logs")
    actor = relationship("User")

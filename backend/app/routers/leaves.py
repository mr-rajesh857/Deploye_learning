from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from app.database import get_db
from app.models import User, UserRole, LeaveType, LeaveBalance, LeaveRequest, LeaveStatus, HalfDayPeriod, AuditLog
from app.schemas import (
    LeaveRequestCreate, 
    LeaveRequestOut, 
    LeaveStatusUpdate, 
    LeaveTypeOut, 
    LeaveBalanceOut,
    AuditLogOut
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/leaves", tags=["Leaves"])

def calculate_working_days(start_date: date, end_date: date, is_half_day: bool) -> float:
    if is_half_day:
        return 0.5
    
    current = start_date
    days = 0.0
    while current <= end_date:
        # 0 = Monday, 6 = Sunday. Weekdays are 0 to 4
        if current.weekday() < 5:
            days += 1.0
        current += timedelta(days=1)
    
    # If the user selected a weekend date or single day, ensure at least 1.0 day
    return max(1.0, days)

def serialize_request(req: LeaveRequest) -> dict:
    return {
        "id": req.id,
        "request_number": req.request_number,
        "user_id": req.user_id,
        "user_name": req.user.full_name if req.user else "Unknown",
        "user_department": req.user.department if req.user else "General",
        "user_email": req.user.email if req.user else "",
        "leave_type_id": req.leave_type_id,
        "leave_type_name": req.leave_type.name if req.leave_type else "Leave",
        "leave_type_code": req.leave_type.code if req.leave_type else "LV",
        "leave_type_color": req.leave_type.color if req.leave_type else "#3B82F6",
        "start_date": req.start_date,
        "end_date": req.end_date,
        "total_days": req.total_days,
        "is_half_day": req.is_half_day,
        "half_day_period": req.half_day_period,
        "reason": req.reason,
        "emergency_contact": req.emergency_contact,
        "status": req.status,
        "manager_comment": req.manager_comment,
        "reviewed_by_id": req.reviewed_by_id,
        "reviewer_name": req.reviewer.full_name if req.reviewer else None,
        "reviewed_at": req.reviewed_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
        "audit_logs": [
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_name": log.actor.full_name if log.actor else "System",
                "action": log.action,
                "comments": log.comments,
                "created_at": log.created_at
            }
            for log in req.audit_logs
        ]
    }

@router.get("/types", response_model=List[LeaveTypeOut])
def get_leave_types(db: Session = Depends(get_db)):
    """Fetch all active leave types and policies"""
    return db.query(LeaveType).filter(LeaveType.is_active == True).order_by(LeaveType.id).all()

@router.get("/balances", response_model=List[LeaveBalanceOut])
def get_user_balances(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch current year leave balances for the authenticated user or target user"""
    target_id = user_id if (user_id and current_user.role in [UserRole.MANAGER, UserRole.HR_ADMIN]) else current_user.id
    current_year = datetime.utcnow().year

    balances = (
        db.query(LeaveBalance)
        .filter(LeaveBalance.user_id == target_id, LeaveBalance.year == current_year)
        .join(LeaveType)
        .all()
    )

    result = []
    for b in balances:
        result.append({
            "id": b.id,
            "user_id": b.user_id,
            "leave_type_id": b.leave_type_id,
            "leave_type_name": b.leave_type.name,
            "leave_type_code": b.leave_type.code,
            "color": b.leave_type.color,
            "year": b.year,
            "allocated_days": b.allocated_days,
            "used_days": b.used_days,
            "pending_days": b.pending_days,
            "carry_forward_days": b.carry_forward_days,
            "available_days": b.available_days
        })
    return result

@router.get("/", response_model=List[LeaveRequestOut])
def get_leave_requests(
    scope: Optional[str] = Query("my", description="Filter scope: 'my', 'team', or 'all'"),
    status: Optional[str] = None,
    leave_type_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve list of leave requests based on user role and filters"""
    query = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id)

    # Scoping logic
    if scope == "my" or current_user.role == UserRole.EMPLOYEE:
        query = query.filter(LeaveRequest.user_id == current_user.id)
    elif scope == "team" and current_user.role in [UserRole.MANAGER, UserRole.HR_ADMIN]:
        # Filter direct reports or same department
        subordinates = db.query(User.id).filter(
            or_(User.manager_id == current_user.id, User.department == current_user.department)
        ).subquery()
        query = query.filter(LeaveRequest.user_id.in_(subordinates))
    elif scope == "all" and current_user.role == UserRole.HR_ADMIN:
        pass # HR Admin sees everything
    else:
        query = query.filter(LeaveRequest.user_id == current_user.id)

    if status and status.upper() in LeaveStatus.__members__:
        query = query.filter(LeaveRequest.status == LeaveStatus[status.upper()])

    if leave_type_id:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    requests = query.order_by(desc(LeaveRequest.created_at)).all()
    return [serialize_request(r) for r in requests]

@router.post("/", response_model=LeaveRequestOut)
def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a new employee leave request with automatic balance deduction reservation"""
    if data.start_date > data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date cannot be after end date."
        )

    # Check leave type existence
    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id, LeaveType.is_active == True).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Selected leave type does not exist.")

    # Calculate total days
    days = calculate_working_days(data.start_date, data.end_date, data.is_half_day)

    # Check for overlapping requests in PENDING or APPROVED status
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == current_user.id,
        LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        and_(
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date
        )
    ).first()

    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a {overlap.status.value.lower()} leave request ({overlap.request_number}) covering this date range ({overlap.start_date} to {overlap.end_date})."
        )

    # Check leave balance
    current_year = data.start_date.year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == current_user.id,
        LeaveBalance.leave_type_id == data.leave_type_id,
        LeaveBalance.year == current_year
    ).first()

    if not balance:
        # Initialize balance if missing
        balance = LeaveBalance(
            user_id=current_user.id,
            leave_type_id=data.leave_type_id,
            year=current_year,
            allocated_days=leave_type.default_days,
            used_days=0.0,
            pending_days=0.0,
            carry_forward_days=0.0
        )
        db.add(balance)
        db.flush()

    if balance.available_days < days and leave_type.code != "UL": # Unpaid leave allows negative / special
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient leave balance. You requested {days} days, but only have {balance.available_days:.1f} days available for {leave_type.name}."
        )

    # Generate sequential unique request number
    count_today = db.query(LeaveRequest).filter(
        LeaveRequest.created_at >= datetime.utcnow().date()
    ).count() + 1
    req_number = f"LR-{datetime.utcnow().strftime('%Y%m%d')}-{count_today:04d}"

    new_request = LeaveRequest(
        request_number=req_number,
        user_id=current_user.id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=days,
        is_half_day=data.is_half_day,
        half_day_period=data.half_day_period or HalfDayPeriod.NONE,
        reason=data.reason,
        emergency_contact=data.emergency_contact,
        status=LeaveStatus.PENDING
    )
    db.add(new_request)

    # Reserve pending days
    balance.pending_days += days
    db.flush()

    # Add audit log
    db.add(AuditLog(
        leave_request_id=new_request.id,
        actor_id=current_user.id,
        action="REQUEST_SUBMITTED",
        comments=f"Submitted leave request for {days} day(s) from {data.start_date} to {data.end_date}"
    ))

    db.commit()
    db.refresh(new_request)
    return serialize_request(new_request)

@router.get("/{request_id}", response_model=LeaveRequestOut)
def get_leave_request_detail(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    # Only owner, manager, or HR admin can view
    if req.user_id != current_user.id and current_user.role not in [UserRole.MANAGER, UserRole.HR_ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    return serialize_request(req)

@router.post("/{request_id}/approve", response_model=LeaveRequestOut)
def approve_leave_request(
    request_id: int,
    comment: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a pending leave request, moving pending days to used days"""
    if current_user.role not in [UserRole.MANAGER, UserRole.HR_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Managers or HR Admins can approve leaves.")

    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot approve request with status {req.status.value}")

    # Update balance: pending -> used
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.leave_type_id == req.leave_type_id,
        LeaveBalance.year == req.start_date.year
    ).first()

    if balance:
        balance.pending_days = max(0.0, balance.pending_days - req.total_days)
        balance.used_days += req.total_days

    req.status = LeaveStatus.APPROVED
    req.manager_comment = comment or "Approved"
    req.reviewed_by_id = current_user.id
    req.reviewed_at = datetime.utcnow()

    db.add(AuditLog(
        leave_request_id=req.id,
        actor_id=current_user.id,
        action="REQUEST_APPROVED",
        comments=comment or "Approved"
    ))

    db.commit()
    db.refresh(req)
    return serialize_request(req)

@router.post("/{request_id}/reject", response_model=LeaveRequestOut)
def reject_leave_request(
    request_id: int,
    comment: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a pending leave request, reverting pending days"""
    if current_user.role not in [UserRole.MANAGER, UserRole.HR_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Managers or HR Admins can reject leaves.")

    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot reject request with status {req.status.value}")

    # Revert pending balance
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.leave_type_id == req.leave_type_id,
        LeaveBalance.year == req.start_date.year
    ).first()

    if balance:
        balance.pending_days = max(0.0, balance.pending_days - req.total_days)

    req.status = LeaveStatus.REJECTED
    req.manager_comment = comment or "Request rejected"
    req.reviewed_by_id = current_user.id
    req.reviewed_at = datetime.utcnow()

    db.add(AuditLog(
        leave_request_id=req.id,
        actor_id=current_user.id,
        action="REQUEST_REJECTED",
        comments=comment or "Request rejected"
    ))

    db.commit()
    db.refresh(req)
    return serialize_request(req)

@router.post("/{request_id}/cancel", response_model=LeaveRequestOut)
def cancel_leave_request(
    request_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee or Admin can cancel a pending or upcoming leave"""
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if req.user_id != current_user.id and current_user.role != UserRole.HR_ADMIN:
        raise HTTPException(status_code=403, detail="You can only cancel your own leave requests.")

    if req.status in [LeaveStatus.CANCELLED, LeaveStatus.REJECTED]:
        raise HTTPException(status_code=400, detail=f"Leave request is already {req.status.value.lower()}")

    # Restore balance
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.leave_type_id == req.leave_type_id,
        LeaveBalance.year == req.start_date.year
    ).first()

    if balance:
        if req.status == LeaveStatus.PENDING:
            balance.pending_days = max(0.0, balance.pending_days - req.total_days)
        elif req.status == LeaveStatus.APPROVED:
            balance.used_days = max(0.0, balance.used_days - req.total_days)

    req.status = LeaveStatus.CANCELLED
    req.manager_comment = reason or "Cancelled by user"

    db.add(AuditLog(
        leave_request_id=req.id,
        actor_id=current_user.id,
        action="REQUEST_CANCELLED",
        comments=reason or "Cancelled by user"
    ))

    db.commit()
    db.refresh(req)
    return serialize_request(req)

from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from app.database import get_db
from app.models import User, UserRole, LeaveRequest, LeaveBalance, LeaveType, LeaveStatus
from app.routers.auth import get_current_user
from app.routers.leaves import serialize_request

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard-summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    current_year = today.year

    # 1. User's leave balances
    balances = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == current_user.id,
        LeaveBalance.year == current_year
    ).join(LeaveType).all()

    total_allocated = sum(b.allocated_days + b.carry_forward_days for b in balances)
    total_used = sum(b.used_days for b in balances)
    total_pending = sum(b.pending_days for b in balances)
    total_available = max(0.0, total_allocated - (total_used + total_pending))

    # 2. Pending approvals count (for manager/admin or user's pending)
    if current_user.role in [UserRole.MANAGER, UserRole.HR_ADMIN]:
        pending_approvals_count = db.query(LeaveRequest).filter(
            LeaveRequest.status == LeaveStatus.PENDING
        ).count()
    else:
        pending_approvals_count = db.query(LeaveRequest).filter(
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.status == LeaveStatus.PENDING
        ).count()

    # 3. Total active team members
    team_members_count = db.query(User).filter(User.is_active == True).count()

    # 4. Out of office / On leave today
    on_leave_today = db.query(LeaveRequest).filter(
        LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).all()

    # 5. Breakdown by leave type for current user
    leaves_by_type = []
    for b in balances:
        leaves_by_type.append({
            "type_name": b.leave_type.name,
            "code": b.leave_type.code,
            "color": b.leave_type.color,
            "allocated": b.allocated_days + b.carry_forward_days,
            "used": b.used_days,
            "pending": b.pending_days,
            "available": b.available_days
        })

    # 6. Recent requests
    recent_query = db.query(LeaveRequest)
    if current_user.role == UserRole.EMPLOYEE:
        recent_query = recent_query.filter(LeaveRequest.user_id == current_user.id)
    recent_requests = recent_query.order_by(LeaveRequest.created_at.desc()).limit(5).all()

    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "department": current_user.department,
            "designation": current_user.designation,
            "email": current_user.email,
            "avatar_color": current_user.avatar_color
        },
        "stats": {
            "total_allocated": total_allocated,
            "total_used": total_used,
            "total_pending": total_pending,
            "total_available": total_available,
            "pending_approvals_count": pending_approvals_count,
            "team_members_count": team_members_count,
            "on_leave_today_count": len(on_leave_today)
        },
        "on_leave_today": [
            {
                "id": req.id,
                "user_name": req.user.full_name,
                "department": req.user.department,
                "avatar_color": req.user.avatar_color,
                "leave_type": req.leave_type.name,
                "color": req.leave_type.color,
                "start_date": req.start_date,
                "end_date": req.end_date
            }
            for req in on_leave_today
        ],
        "leaves_by_type": leaves_by_type,
        "recent_requests": [serialize_request(r) for r in recent_requests]
    }

@router.get("/calendar")
def get_leave_calendar(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve schedule for visual team calendar"""
    query = db.query(LeaveRequest).filter(
        LeaveRequest.status.in_([LeaveStatus.APPROVED, LeaveStatus.PENDING])
    )

    if start_date:
        query = query.filter(LeaveRequest.end_date >= start_date)
    if end_date:
        query = query.filter(LeaveRequest.start_date <= end_date)
    if department:
        query = query.join(User).filter(User.department == department)

    requests = query.order_by(LeaveRequest.start_date).all()
    return [serialize_request(r) for r in requests]

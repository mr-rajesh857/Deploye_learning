import sys
from datetime import datetime, date, timedelta
from passlib.context import CryptContext
from app.database import engine, SessionLocal, Base
from app.models import User, UserRole, LeaveType, LeaveBalance, LeaveRequest, LeaveStatus, HalfDayPeriod, AuditLog
from app.auth_utils import hash_password


def seed_database():
    print("Creating tables in PostgreSQL database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        existing_user = db.query(User).first()
        if existing_user:
            print("Database already contains data. Checking if leave types exist...")
            return

        print("Seeding Leave Types...")
        leave_types = [
            LeaveType(
                name="Annual / Paid Leave",
                code="AL",
                description="General vacation and personal time off with full pay.",
                default_days=18.0,
                color="#3B82F6",
                requires_attachment=False,
                is_active=True
            ),
            LeaveType(
                name="Sick Leave",
                code="SL",
                description="Time off for illness, medical appointments, or recovery.",
                default_days=10.0,
                color="#EF4444",
                requires_attachment=True,
                is_active=True
            ),
            LeaveType(
                name="Casual Leave",
                code="CL",
                description="Short-notice personal commitments and urgent family matters.",
                default_days=8.0,
                color="#10B981",
                requires_attachment=False,
                is_active=True
            ),
            LeaveType(
                name="Parental Leave",
                code="PL",
                description="Maternity and paternity leave for newborn care and bonding.",
                default_days=30.0,
                color="#8B5CF6",
                requires_attachment=True,
                is_active=True
            ),
            LeaveType(
                name="Unpaid Leave",
                code="UL",
                description="Extended leave granted without compensation upon approval.",
                default_days=20.0,
                color="#64748B",
                requires_attachment=False,
                is_active=True
            ),
        ]
        db.add_all(leave_types)
        db.flush()

        print("Seeding Users...")
        # 1. HR Admin
        admin = User(
            email="admin@company.com",
            hashed_password=hash_password("admin123"),
            full_name="Alex Rivera",
            role=UserRole.HR_ADMIN,
            department="Human Resources",
            designation="HR Director",
            phone="+1 (555) 019-2834",
            avatar_color="#EC4899",
            is_active=True
        )
        db.add(admin)
        db.flush()

        # 2. Manager
        manager = User(
            email="manager@company.com",
            hashed_password=hash_password("manager123"),
            full_name="Sarah Connor",
            role=UserRole.MANAGER,
            department="Engineering",
            designation="Engineering Lead",
            manager_id=admin.id,
            phone="+1 (555) 012-9843",
            avatar_color="#6366F1",
            is_active=True
        )
        db.add(manager)
        db.flush()

        # 3. Employees
        emp1 = User(
            email="employee@company.com",
            hashed_password=hash_password("employee123"),
            full_name="John Doe",
            role=UserRole.EMPLOYEE,
            department="Engineering",
            designation="Senior Full Stack Engineer",
            manager_id=manager.id,
            phone="+1 (555) 014-4321",
            avatar_color="#3B82F6",
            is_active=True
        )
        emp2 = User(
            email="designer@company.com",
            hashed_password=hash_password("designer123"),
            full_name="Emma Watson",
            role=UserRole.EMPLOYEE,
            department="Design",
            designation="Lead UI/UX Designer",
            manager_id=manager.id,
            phone="+1 (555) 018-7654",
            avatar_color="#10B981",
            is_active=True
        )
        emp3 = User(
            email="qa@company.com",
            hashed_password=hash_password("qa123"),
            full_name="David Miller",
            role=UserRole.EMPLOYEE,
            department="Engineering",
            designation="QA Automation Specialist",
            manager_id=manager.id,
            phone="+1 (555) 016-5544",
            avatar_color="#F59E0B",
            is_active=True
        )
        db.add_all([emp1, emp2, emp3])
        db.flush()

        all_users = [admin, manager, emp1, emp2, emp3]
        current_year = datetime.utcnow().year

        print("Seeding Leave Balances...")
        for user in all_users:
            for lt in leave_types:
                allocated = lt.default_days
                used = 0.0
                pending = 0.0
                if user.email == "employee@company.com":
                    if lt.code == "AL":
                        used = 3.0
                        pending = 2.0
                    elif lt.code == "SL":
                        used = 1.0
                elif user.email == "designer@company.com":
                    if lt.code == "AL":
                        used = 5.0

                balance = LeaveBalance(
                    user_id=user.id,
                    leave_type_id=lt.id,
                    year=current_year,
                    allocated_days=allocated,
                    used_days=used,
                    pending_days=pending,
                    carry_forward_days=2.0 if lt.code == "AL" else 0.0
                )
                db.add(balance)

        db.flush()

        print("Seeding Initial Leave Requests...")
        today = date.today()
        # Sample 1: Pending request by John Doe
        req1 = LeaveRequest(
            request_number=f"LR-{today.strftime('%Y%m')}-001",
            user_id=emp1.id,
            leave_type_id=leave_types[0].id, # Annual
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=6),
            total_days=2.0,
            is_half_day=False,
            half_day_period=HalfDayPeriod.NONE,
            reason="Attending family reunion in Chicago.",
            emergency_contact="+1 (555) 019-9999",
            status=LeaveStatus.PENDING,
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(req1)
        db.flush()

        db.add(AuditLog(
            leave_request_id=req1.id,
            actor_id=emp1.id,
            action="REQUEST_SUBMITTED",
            comments="Applied for 2 days Annual Leave"
        ))

        # Sample 2: Approved request by John Doe (past)
        req2 = LeaveRequest(
            request_number=f"LR-{today.strftime('%Y%m')}-002",
            user_id=emp1.id,
            leave_type_id=leave_types[0].id,
            start_date=today - timedelta(days=14),
            end_date=today - timedelta(days=12),
            total_days=3.0,
            is_half_day=False,
            half_day_period=HalfDayPeriod.NONE,
            reason="Quarterly vacation recharge.",
            emergency_contact="+1 (555) 019-9999",
            status=LeaveStatus.APPROVED,
            manager_comment="Approved. Have a great time!",
            reviewed_by_id=manager.id,
            reviewed_at=datetime.utcnow() - timedelta(days=15),
            created_at=datetime.utcnow() - timedelta(days=16)
        )
        db.add(req2)
        db.flush()

        db.add(AuditLog(
            leave_request_id=req2.id,
            actor_id=manager.id,
            action="REQUEST_APPROVED",
            comments="Approved by Engineering Lead Sarah Connor"
        ))

        # Sample 3: Pending request by Emma Watson
        req3 = LeaveRequest(
            request_number=f"LR-{today.strftime('%Y%m')}-003",
            user_id=emp2.id,
            leave_type_id=leave_types[1].id, # Sick Leave
            start_date=today + timedelta(days=1),
            end_date=today + timedelta(days=1),
            total_days=1.0,
            is_half_day=False,
            half_day_period=HalfDayPeriod.NONE,
            reason="Dental surgical procedure and recovery.",
            emergency_contact="+1 (555) 018-1122",
            status=LeaveStatus.PENDING,
            created_at=datetime.utcnow() - timedelta(hours=3)
        )
        db.add(req3)
        db.flush()

        db.add(AuditLog(
            leave_request_id=req3.id,
            actor_id=emp2.id,
            action="REQUEST_SUBMITTED",
            comments="Applied for 1 day Sick Leave"
        ))

        db.commit()
        print("Database successfully seeded with realistic sample data!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

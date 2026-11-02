"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { api } from "@/services/api";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlusCircle,
  Database,
  ExternalLink,
  ChevronDown,
  User,
  Shield,
  Layers,
  CalendarDays,
  FileText,
  Users,
  Search,
  Check,
  X,
  AlertTriangle,
  Server,
  RefreshCw,
  Info,
  LogOut,
  LogIn
} from "lucide-react";

export default function LeaveManagementApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview"); // overview, apply, requests, approvals, calendar
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);

  // Apply Leave Form State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    is_half_day: false,
    half_day_period: "none",
    reason: "",
    emergency_contact: "",
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    request: null,
    action: "approve", // "approve" or "reject"
    comment: "",
  });

  const [requestFilter, setRequestFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const adminerUrl =
    process.env.NEXT_PUBLIC_ADMINER_URL ||
    "http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public";

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial Data Fetch - Strictly for logged-in user
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("zenith_token") : null;
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch logged in user's profile
      const [user, types] = await Promise.all([
        api.getMe(),
        api.getLeaveTypes().catch(() => []),
      ]);

      if (!user) {
        localStorage.removeItem("zenith_token");
        localStorage.removeItem("zenith_user_id");
        router.push("/login");
        return;
      }

      setCurrentUser(user);
      localStorage.setItem("zenith_user_id", user.id);
      setLeaveTypes(types);
      await refreshUserData(user.id);
    } catch (err) {
      console.error("Auth initialization error:", err);
      localStorage.removeItem("zenith_token");
      localStorage.removeItem("zenith_user_id");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async (userId) => {
    try {
      const [summary, requests, approvals, calendar] = await Promise.all([
        api.getDashboardSummary().catch(() => null),
        api.getRequests({ scope: "my" }).catch(() => []),
        api.getRequests({ scope: "team", status: "PENDING" }).catch(() => []),
        api.getCalendar().catch(() => []),
      ]);

      if (summary) setDashboardData(summary);
      setMyRequests(requests);
      setPendingApprovals(approvals);
      setCalendarEvents(calendar);
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("zenith_token");
    localStorage.removeItem("zenith_user_id");
    router.push("/login");
  };


  // Calculate estimated duration
  const getEstimatedDays = () => {
    if (applyForm.is_half_day) return 0.5;
    if (!applyForm.start_date || !applyForm.end_date) return 0;
    const start = new Date(applyForm.start_date);
    const end = new Date(applyForm.end_date);
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyForm.leave_type_id) {
      showToast("Please select a leave category", "error");
      return;
    }
    if (!applyForm.start_date || !applyForm.end_date) {
      showToast("Please select valid start and end dates", "error");
      return;
    }

    try {
      setSubmittingLeave(true);
      await api.createRequest({
        leave_type_id: Number(applyForm.leave_type_id),
        start_date: applyForm.start_date,
        end_date: applyForm.end_date,
        is_half_day: applyForm.is_half_day,
        half_day_period: applyForm.is_half_day ? applyForm.half_day_period : "none",
        reason: applyForm.reason,
        emergency_contact: applyForm.emergency_contact || null,
      });

      showToast("Leave request submitted successfully!");
      setIsApplyModalOpen(false);
      setApplyForm({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        is_half_day: false,
        half_day_period: "none",
        reason: "",
        emergency_contact: "",
      });
      await refreshUserData(currentUser.id);
      setActiveTab("requests");
    } catch (err) {
      showToast(err.message || "Failed to submit leave request", "error");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleReviewAction = async () => {
    if (!reviewModal.request) return;
    try {
      if (reviewModal.action === "approve") {
        await api.approveRequest(reviewModal.request.id, reviewModal.comment);
        showToast(`Request ${reviewModal.request.request_number} approved!`);
      } else {
        await api.rejectRequest(reviewModal.request.id, reviewModal.comment);
        showToast(`Request ${reviewModal.request.request_number} rejected.`, "info");
      }
      setReviewModal({ isOpen: false, request: null, action: "approve", comment: "" });
      await refreshUserData(currentUser.id);
    } catch (err) {
      showToast(err.message || "Failed to process review action", "error");
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      await api.cancelRequest(requestId, "Cancelled by user");
      showToast("Leave request cancelled successfully.");
      await refreshUserData(currentUser.id);
    } catch (err) {
      showToast(err.message || "Failed to cancel request", "error");
    }
  };

  const filteredRequests = myRequests.filter((req) => {
    const matchesFilter = requestFilter === "ALL" || req.status === requestFilter;
    const matchesSearch =
      req.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.leave_type_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.request_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`${styles.toast} ${
            toast.type === "error" ? styles.toastError : styles.toastSuccess
          }`}
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <Layers size={22} />
          </div>
          <div className={styles.brandText}>
            <h1>Zenith Leave Hub</h1>
            <span>3-Tier Enterprise Leave Management</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          {/* Direct PostgreSQL Adminer link */}
          <a
            href={adminerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.dbBadge}
            title="Open PostgreSQL Database in Adminer"
          >
            <div className={styles.liveDot} />
            <Database size={14} />
            <span>PostgreSQL: Leave_management</span>
            <ExternalLink size={12} />
          </a>

          {/* User Persona Switcher */}
          {currentUser && (
            <div style={{ position: "relative" }}>
              <div
                className={styles.userSelector}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div
                  className={styles.userAvatar}
                  style={{ backgroundColor: currentUser.avatar_color || "#4F46E5" }}
                >
                  {currentUser.full_name?.charAt(0)}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{currentUser.full_name}</span>
                  <span
                    className={`${styles.userRoleBadge} ${
                      currentUser.role === "hr_admin"
                        ? styles.roleAdmin
                        : currentUser.role === "manager"
                        ? styles.roleManager
                        : styles.roleEmployee
                    }`}
                  >
                    {currentUser.role === "hr_admin"
                      ? "HR Admin"
                      : currentUser.role === "manager"
                      ? "Engineering Manager"
                      : "Employee"}
                  </span>
                </div>
                <ChevronDown size={14} color="#94A3B8" />
              </div>

              {/* User Account Menu (No Switcher) */}
              {isUserMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "115%",
                    right: 0,
                    width: "260px",
                    background: "#0F172A",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    padding: "0.85rem",
                    zIndex: 100,
                  }}
                >
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F8FAFC" }}>
                      {currentUser.full_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "2px" }}>
                      {currentUser.email}
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: "0.5rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#818CF8",
                      }}
                    >
                      {currentUser.designation} • {currentUser.department}
                    </div>
                  </div>

                  <div
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.65rem 0.75rem",
                      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      color: "#FB7185",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!currentUser && (
            <button
              onClick={() => router.push("/login")}
              className={styles.primaryCtaBtn}
              style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Sub-Bar */}
      <nav className={styles.navBar}>
        <div className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${activeTab === "overview" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <Clock size={16} />
            <span>Dashboard</span>
          </button>

          <button
            className={`${styles.navTab} ${activeTab === "requests" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            <FileText size={16} />
            <span>My Applications</span>
          </button>

          {(currentUser?.role === "manager" || currentUser?.role === "hr_admin") && (
            <button
              className={`${styles.navTab} ${
                activeTab === "approvals" ? styles.navTabActive : ""
              }`}
              onClick={() => setActiveTab("approvals")}
            >
              <Shield size={16} />
              <span>Team Approvals</span>
              {pendingApprovals.length > 0 && (
                <span className={styles.tabBadge}>{pendingApprovals.length}</span>
              )}
            </button>
          )}

          <button
            className={`${styles.navTab} ${activeTab === "calendar" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("calendar")}
          >
            <CalendarDays size={16} />
            <span>Team Schedule</span>
          </button>

        </div>

        <button
          className={styles.primaryCtaBtn}
          onClick={() => {
            if (leaveTypes.length > 0 && !applyForm.leave_type_id) {
              setApplyForm((prev) => ({ ...prev, leave_type_id: leaveTypes[0].id }));
            }
            setIsApplyModalOpen(true);
          }}
        >
          <PlusCircle size={16} />
          <span>Apply Leave</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className={styles.main}>
        {/* ========================================================================= */}
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="fade-in">
            {/* Top Metric Cards */}
            <div className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.statEmerald}`}>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Available Balance</span>
                  <div className={styles.statValue}>
                    {dashboardData?.stats?.total_available?.toFixed(1) || "0.0"}
                  </div>
                  <span className={styles.statSubtext}>Days remaining this year</span>
                </div>
                <div className={styles.statIconBox}>
                  <CheckCircle2 size={24} color="#10B981" />
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statAmber}`}>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Pending Approval</span>
                  <div className={styles.statValue}>
                    {dashboardData?.stats?.total_pending?.toFixed(1) || "0.0"}
                  </div>
                  <span className={styles.statSubtext}>Days in review</span>
                </div>
                <div className={styles.statIconBox}>
                  <Clock size={24} color="#F59E0B" />
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statPrimary}`}>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Leaves Taken</span>
                  <div className={styles.statValue}>
                    {dashboardData?.stats?.total_used?.toFixed(1) || "0.0"}
                  </div>
                  <span className={styles.statSubtext}>
                    Out of {dashboardData?.stats?.total_allocated || "0"} total days
                  </span>
                </div>
                <div className={styles.statIconBox}>
                  <Calendar size={24} color="#6366F1" />
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statCyan}`}>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Out of Office Today</span>
                  <div className={styles.statValue}>
                    {dashboardData?.stats?.on_leave_today_count || "0"}
                  </div>
                  <span className={styles.statSubtext}>
                    Across {dashboardData?.stats?.team_members_count || "5"} team members
                  </span>
                </div>
                <div className={styles.statIconBox}>
                  <Users size={24} color="#06B6D4" />
                </div>
              </div>
            </div>

            {/* Quota Breakdown by Type */}
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Layers size={18} color="#6366F1" />
                <span>Leave Balance & Quotas</span>
              </h2>
              <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                Current Year: {currentYear}
              </span>
            </div>

            <div className={styles.quotaGrid}>
              {dashboardData?.leaves_by_type?.map((lt) => {
                const usedPct =
                  lt.allocated > 0
                    ? Math.min(100, Math.round(((lt.used + lt.pending) / lt.allocated) * 100))
                    : 0;

                return (
                  <div key={lt.code} className={styles.quotaCard}>
                    <div className={styles.quotaTop}>
                      <span className={styles.quotaName}>{lt.type_name}</span>
                      <span className={styles.quotaBadge} style={{ color: lt.color }}>
                        {lt.code}
                      </span>
                    </div>

                    <div className={styles.quotaNumbers}>
                      <div>
                        <div className={styles.quotaAvailableBig}>
                          {lt.available.toFixed(1)}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                          days available
                        </span>
                      </div>
                      <div className={styles.quotaAllocatedSmall}>
                        {lt.used + lt.pending} / {lt.allocated} used
                      </div>
                    </div>

                    <div className={styles.progressBarTrack}>
                      <div
                        className={styles.progressBarFill}
                        style={{
                          width: `${usedPct}%`,
                          backgroundColor: lt.color || "#6366F1",
                        }}
                      />
                    </div>

                    <div className={styles.quotaSubDetails}>
                      <span>Used: {lt.used.toFixed(1)} d</span>
                      <span>Pending: {lt.pending.toFixed(1)} d</span>
                      <span>Total: {lt.allocated.toFixed(1)} d</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom 2-Column Split: Recent Requests & Out of Office Today */}
            <div className={styles.dashboardSplit}>
              {/* Recent Applications Panel */}
              <div className={styles.cardPanel}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <FileText size={18} color="#6366F1" />
                    <span>Recent Applications</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab("requests")}
                    style={{ fontSize: "0.8rem", color: "#6366F1", fontWeight: 600 }}
                  >
                    View All →
                  </button>
                </div>

                <div className={styles.tableContainer}>
                  <table className={styles.customTable}>
                    <thead>
                      <tr>
                        <th>Req #</th>
                        <th>Type</th>
                        <th>Duration</th>
                        <th>Days</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.recent_requests?.length > 0 ? (
                        dashboardData.recent_requests.map((req) => (
                          <tr key={req.id}>
                            <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                              {req.request_number}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  backgroundColor: req.leave_type_color,
                                  marginRight: "6px",
                                }}
                              />
                              {req.leave_type_name}
                            </td>
                            <td>
                              {req.start_date} → {req.end_date}
                            </td>
                            <td>{req.total_days} d</td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${
                                  req.status === "APPROVED"
                                    ? styles.statusApproved
                                    : req.status === "PENDING"
                                    ? styles.statusPending
                                    : req.status === "REJECTED"
                                    ? styles.statusRejected
                                    : styles.statusCancelled
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                            No leave applications submitted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Who's Out of Office Today */}
              <div className={styles.cardPanel}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <Users size={18} color="#06B6D4" />
                    <span>Out of Office Today</span>
                  </h3>
                </div>

                <div className={styles.outList}>
                  {dashboardData?.on_leave_today?.length > 0 ? (
                    dashboardData.on_leave_today.map((item) => (
                      <div key={item.id} className={styles.outItem}>
                        <div className={styles.outPerson}>
                          <div
                            className={styles.userAvatar}
                            style={{
                              backgroundColor: item.avatar_color || "#3B82F6",
                              width: "34px",
                              height: "34px",
                            }}
                          >
                            {item.user_name?.charAt(0)}
                          </div>
                          <div className={styles.outDetails}>
                            <h4>{item.user_name}</h4>
                            <p>{item.department}</p>
                          </div>
                        </div>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: "rgba(99, 102, 241, 0.15)",
                            color: item.color || "#818CF8",
                          }}
                        >
                          {item.leave_type}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: "2rem 1rem",
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <CheckCircle2
                        size={32}
                        color="#10B981"
                        style={{ margin: "0 auto 0.5rem" }}
                      />
                      Full team capacity today! No employees on leave.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY LEAVE APPLICATIONS */}
        {/* ========================================================================= */}
        {activeTab === "requests" && (
          <div className="fade-in">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <FileText size={20} color="#6366F1" />
                <span>My Leave Applications</span>
              </h2>
              <button
                className={styles.primaryCtaBtn}
                onClick={() => setIsApplyModalOpen(true)}
              >
                <PlusCircle size={16} />
                <span>New Application</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
              <div className={styles.filterTabs}>
                {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((status) => (
                  <button
                    key={status}
                    className={`${styles.filterBtn} ${
                      requestFilter === status ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setRequestFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative", minWidth: "260px" }}>
                <Search
                  size={16}
                  color="#64748B"
                  style={{ position: "absolute", left: "10px", top: "10px" }}
                />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.formInput}
                  style={{ width: "100%", paddingLeft: "2.2rem" }}
                />
              </div>
            </div>

            {/* Applications List */}
            <div className={styles.cardPanel}>
              <div className={styles.tableContainer}>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>Req Number</th>
                      <th>Category</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Manager Note</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length > 0 ? (
                      filteredRequests.map((req) => (
                        <tr key={req.id}>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                            {req.request_number}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: req.leave_type_color,
                                marginRight: "6px",
                              }}
                            />
                            {req.leave_type_name}
                          </td>
                          <td>
                            {req.start_date} → {req.end_date}
                          </td>
                          <td>
                            {req.total_days} d{" "}
                            {req.is_half_day && (
                              <span style={{ fontSize: "0.7rem", color: "#F59E0B" }}>
                                (Half)
                              </span>
                            )}
                          </td>
                          <td style={{ maxWidth: "220px", whiteSpace: "normal" }}>
                            {req.reason}
                          </td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                req.status === "APPROVED"
                                  ? styles.statusApproved
                                  : req.status === "PENDING"
                                  ? styles.statusPending
                                  : req.status === "REJECTED"
                                  ? styles.statusRejected
                                  : styles.statusCancelled
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td style={{ color: "#94A3B8", fontStyle: "italic" }}>
                            {req.manager_comment || "—"}
                          </td>
                          <td>
                            {(req.status === "PENDING" || req.status === "APPROVED") && (
                              <button
                                className={`${styles.btnSm} ${styles.btnCancel}`}
                                onClick={() => handleCancelRequest(req.id)}
                              >
                                <X size={12} />
                                <span>Cancel</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                          No leave requests match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TEAM APPROVALS (Manager & Admin View) */}
        {/* ========================================================================= */}
        {activeTab === "approvals" && (
          <div className="fade-in">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Shield size={20} color="#F59E0B" />
                <span>Pending Approvals</span>
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                Managing team requests for {currentUser?.department}
              </span>
            </div>

            <div className={styles.cardPanel}>
              <div className={styles.tableContainer}>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Category</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.length > 0 ? (
                      pendingApprovals.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <div
                                className={styles.userAvatar}
                                style={{
                                  backgroundColor: "#4F46E5",
                                  width: "28px",
                                  height: "28px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {req.user_name?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "#F8FAFC" }}>
                                  {req.user_name}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                                  {req.user_department}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: req.leave_type_color,
                                marginRight: "6px",
                              }}
                            />
                            {req.leave_type_name}
                          </td>
                          <td>
                            {req.start_date} → {req.end_date}
                          </td>
                          <td style={{ fontWeight: 600 }}>{req.total_days} days</td>
                          <td style={{ maxWidth: "250px", whiteSpace: "normal" }}>
                            {req.reason}
                          </td>
                          <td style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            {req.created_at ? String(req.created_at).slice(0, 10) : "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                className={`${styles.btnSm} ${styles.btnApprove}`}
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    request: req,
                                    action: "approve",
                                    comment: "",
                                  })
                                }
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                className={`${styles.btnSm} ${styles.btnReject}`}
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    request: req,
                                    action: "reject",
                                    comment: "",
                                  })
                                }
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                          <CheckCircle2
                            size={32}
                            color="#10B981"
                            style={{ margin: "0 auto 0.5rem" }}
                          />
                          All caught up! No pending leave applications to review.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TEAM SCHEDULE / CALENDAR */}
        {/* ========================================================================= */}
        {activeTab === "calendar" && (
          <div className="fade-in">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <CalendarDays size={20} color="#6366F1" />
                <span>Team Leave Calendar</span>
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                Active leaves schedule across departments
              </span>
            </div>

            <div className={styles.cardPanel}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {calendarEvents.length > 0 ? (
                  calendarEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div
                          style={{
                            width: "4px",
                            height: "40px",
                            borderRadius: "4px",
                            backgroundColor: evt.leave_type_color,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: "#F8FAFC" }}>
                            {evt.user_name}{" "}
                            <span style={{ fontSize: "0.8rem", color: "#64748B", fontWeight: 400 }}>
                              ({evt.user_department})
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
                            {evt.leave_type_name} • {evt.reason}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: 600,
                            color: "#E2E8F0",
                          }}
                        >
                          {evt.start_date} → {evt.end_date}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          {evt.total_days} days total
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
                    No scheduled leaves found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* MODAL: APPLY FOR LEAVE */}
      {/* ========================================================================= */}
      {isApplyModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsApplyModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Apply for Leave</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setIsApplyModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Category */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Leave Category *</label>
                <select
                  className={styles.formSelect}
                  value={applyForm.leave_type_id}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, leave_type_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select leave category...</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code}) — {lt.default_days} days/year
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Start Date *</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={applyForm.start_date}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, start_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>End Date *</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={applyForm.end_date}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, end_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Duration calculation banner */}
              {applyForm.start_date && applyForm.end_date && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    color: "#C7D2FE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Calculated working days:</span>
                  <strong style={{ fontSize: "1.05rem", color: "#FFFFFF" }}>
                    {getEstimatedDays()} {getEstimatedDays() === 1 ? "day" : "days"}
                  </strong>
                </div>
              )}

              {/* Half-day toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="checkbox"
                  id="halfDayCheckbox"
                  checked={applyForm.is_half_day}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, is_half_day: e.target.checked })
                  }
                  style={{ width: "16px", height: "16px", accentColor: "#6366F1" }}
                />
                <label
                  htmlFor="halfDayCheckbox"
                  style={{ fontSize: "0.85rem", color: "#F8FAFC", cursor: "pointer" }}
                >
                  Half-day leave only (0.5 day)
                </label>
              </div>

              {/* Reason */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reason for Leave *</label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Briefly describe the reason for your time off..."
                  value={applyForm.reason}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, reason: e.target.value })
                  }
                  required
                />
              </div>

              {/* Emergency Contact */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Emergency Contact Number (Optional)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="+1 (555) 000-0000"
                  value={applyForm.emergency_contact}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, emergency_contact: e.target.value })
                  }
                />
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className={`${styles.btnSm} ${styles.btnCancel}`}
                  onClick={() => setIsApplyModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryCtaBtn}
                  disabled={submittingLeave}
                >
                  {submittingLeave ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APPROVE / REJECT REQUEST */}
      {/* ========================================================================= */}
      {reviewModal.isOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setReviewModal({ ...reviewModal, isOpen: false })}
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {reviewModal.action === "approve" ? "Approve Leave" : "Reject Leave"}
              </h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setReviewModal({ ...reviewModal, isOpen: false })}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#94A3B8" }}>
                Request{" "}
                <strong style={{ color: "#F8FAFC" }}>
                  {reviewModal.request?.request_number}
                </strong>{" "}
                by{" "}
                <strong style={{ color: "#F8FAFC" }}>
                  {reviewModal.request?.user_name}
                </strong>{" "}
                for {reviewModal.request?.total_days} days (
                {reviewModal.request?.start_date} to {reviewModal.request?.end_date}).
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {reviewModal.action === "approve"
                    ? "Approval Note (Optional)"
                    : "Reason for Rejection *"}
                </label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  placeholder={
                    reviewModal.action === "approve"
                      ? "e.g. Approved. Have a restful time!"
                      : "Please explain why this request is rejected..."
                  }
                  value={reviewModal.comment}
                  onChange={(e) =>
                    setReviewModal({ ...reviewModal, comment: e.target.value })
                  }
                  required={reviewModal.action === "reject"}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className={`${styles.btnSm} ${styles.btnCancel}`}
                  onClick={() => setReviewModal({ ...reviewModal, isOpen: false })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btnSm} ${
                    reviewModal.action === "approve" ? styles.btnApprove : styles.btnReject
                  }`}
                  onClick={handleReviewAction}
                  style={{ padding: "0.55rem 1.15rem", fontSize: "0.85rem" }}
                >
                  {reviewModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// src/pages/Admin.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  query,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
  getCountFromServer,
  where,
} from "firebase/firestore";
import {
  Shield,
  Users,
  Flag,
  Layers,
  Search,
  RefreshCw,
  Ban,
  Check,
  X,
  Crown,
  Activity,
} from "lucide-react";
import { computeMetrics, dayKey, toMillis } from "../lib/adminMetrics";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import "../styles/admin.css";

const ADMIN_UIDS = ["csFXC9p3lLcmzmyP2YjFT42yMSw1"];
const LIST_LIMIT = 100;
const REPORT_LIMIT = 50;
const EVENT_DAYS = 30;
const EVENT_LIMIT = 5000;

const FILTERS = {
  reports: [
    ["open", "Open"],
    ["closed", "Closed"],
    ["all", "All"],
  ],
  users: [
    ["all", "All"],
    ["paid", "Unlimited"],
    ["banned", "Banned"],
  ],
  circles: [
    ["all", "All"],
    ["active", "Active"],
    ["unlisted", "Unlisted"],
  ],
};

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(v) {
  const d = toDate(v);
  return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
}

function ago(v) {
  const ms = toMillis(v);
  if (ms === null) return "";
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const isPaidPlan = (plan) => plan === "unlimited" || plan === "premium";
const firstLetter = (text) => (String(text || "?").trim().slice(0, 1) || "?").toUpperCase();

export default function Admin() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [reports, setReports] = useState([]);
  const [totals, setTotals] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("analytics");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ reports: "open", users: "all", circles: "all" });

  const [confirm, setConfirm] = useState(null); // { title, body, label, danger, askReason, run }
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const allowed = user && ADMIN_UIDS.includes(user.uid);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [userSnap, communitySnap] = await Promise.all([
        getDocs(query(collection(db, "users"), limit(LIST_LIMIT))),
        getDocs(query(collection(db, "communities"), limit(LIST_LIMIT))),
      ]);
      let reportSnap;
      try {
        reportSnap = await getDocs(
          query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(REPORT_LIMIT))
        );
      } catch {
        reportSnap = await getDocs(query(collection(db, "reports"), limit(REPORT_LIMIT)));
      }
      setUsers(userSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCommunities(communitySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReports(reportSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // exact totals (cheap server-side counts, not limited to the first 100)
      try {
        const usersCol = collection(db, "users");
        const [all, paid, banned] = await Promise.all([
          getCountFromServer(query(usersCol)),
          getCountFromServer(query(usersCol, where("plan", "in", ["unlimited", "premium"]))),
          getCountFromServer(query(usersCol, where("banned", "==", true))),
        ]);
        setTotals({
          users: all.data().count,
          paid: paid.data().count,
          banned: banned.data().count,
        });
      } catch (err) {
        console.warn("[admin] counts failed", err);
      }

      // activity events for the Analytics tab
      try {
        const since = dayKey(Date.now() - (EVENT_DAYS - 1) * 86400000);
        const evSnap = await getDocs(
          query(collection(db, "events"), where("day", ">=", since), orderBy("day"), limit(EVENT_LIMIT))
        );
        setEvents(evSnap.docs.map((d) => d.data()));
        setEventsError("");
      } catch (err) {
        console.warn("[admin] events failed", err);
        setEvents([]);
        setEventsError("Could not read the activity events. Publish the new Firestore rules first.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not load the admin data. Check your Firestore rules.");
      toast.error("Admin list failed. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  // Esc closes the confirm window
  useEffect(() => {
    if (!confirm) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !working) setConfirm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, working]);

  const q = search.trim().toLowerCase();
  const matches = (values) => !q || values.some((v) => String(v || "").toLowerCase().includes(q));

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        if (filters.users === "banned" && !u.banned) return false;
        if (filters.users === "paid" && !isPaidPlan(u.plan)) return false;
        return matches([u.email, u.displayName, u.name, u.id]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, filters.users, q]
  );

  const filteredCircles = useMemo(
    () =>
      communities.filter((c) => {
        if (filters.circles === "active" && c.deleted) return false;
        if (filters.circles === "unlisted" && !c.deleted) return false;
        return matches([c.name, c.tag, c.createdByName, c.id]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [communities, filters.circles, q]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((r) => {
        const closed = r.status === "closed";
        if (filters.reports === "open" && closed) return false;
        if (filters.reports === "closed" && !closed) return false;
        return matches([r.communityName, r.communityId, r.reason, r.reporterName, r.reporterId]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, filters.reports, q]
  );

  const metrics = useMemo(() => computeMetrics({ events, users }), [events, users]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const openReports = reports.filter((r) => r.status !== "closed").length;
  const bannedCount = users.filter((u) => u.banned).length;
  const paidCount = users.filter((u) => isPaidPlan(u.plan)).length;
  const activeCircles = communities.filter((c) => !c.deleted).length;
  const counts = {
    reports: openReports,
    users: users.length,
    circles: activeCircles,
  };

  const ask = (options) => {
    setReason("");
    setConfirm(options);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      await confirm.run(reason.trim());
      setConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error("That did not work. Check your Firestore rules and try again.");
    } finally {
      setWorking(false);
    }
  };

  const patchUser = (id, patch) =>
    setUsers((rows) => rows.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const patchCircle = (id, patch) =>
    setCommunities((rows) => rows.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const banUser = async (target, why) => {
    await updateDoc(doc(db, "users", target.id), {
      banned: true,
      bannedAt: serverTimestamp(),
      bannedBy: user.uid,
      bannedReason: why || null,
    });
    patchUser(target.id, { banned: true, bannedAt: new Date(), bannedReason: why || null });
    toast.success("User banned");
  };

  const unbanUser = async (target) => {
    await updateDoc(doc(db, "users", target.id), {
      banned: false,
      bannedReason: null,
      unbannedAt: serverTimestamp(),
      unbannedBy: user.uid,
    });
    patchUser(target.id, { banned: false, bannedReason: null });
    toast.success("User unbanned");
  };

  const unlistCircle = async (id) => {
    await updateDoc(doc(db, "communities", id), {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: user.uid,
    });
    patchCircle(id, { deleted: true });
    toast.success("Circle unlisted");
  };

  const restoreCircle = async (id) => {
    await updateDoc(doc(db, "communities", id), { deleted: false });
    patchCircle(id, { deleted: false });
    toast.success("Circle restored");
  };

  const closeReport = async (id) => {
    await updateDoc(doc(db, "reports", id), {
      status: "closed",
      closedAt: serverTimestamp(),
      closedBy: user.uid,
    });
    setReports((rows) => rows.map((r) => (r.id === id ? { ...r, status: "closed" } : r)));
    toast.success("Report closed");
  };

  const askBan = (target) =>
    ask({
      title: "Ban this user?",
      body: `${target.email || target.displayName || target.id} will be marked as banned. You can unban them at any time.`,
      label: "Ban user",
      danger: true,
      askReason: true,
      run: (why) => banUser(target, why),
    });

  const askUnban = (target) =>
    ask({
      title: "Unban this user?",
      body: `${target.email || target.displayName || target.id} will be marked as active again.`,
      label: "Unban",
      run: () => unbanUser(target),
    });

  const askUnlist = (id, name) =>
    ask({
      title: "Unlist this circle?",
      body: `"${name || id}" will be hidden from the app. You can restore it from the Circles tab.`,
      label: "Unlist circle",
      danger: true,
      run: () => unlistCircle(id),
    });

  const tabs = [
    ["analytics", "Analytics", Activity],
    ["reports", "Reports", Flag],
    ["users", "Users", Users],
    ["circles", "Circles", Layers],
  ];

  const stats = [
    { label: "Open reports", value: openReports, icon: Flag, tone: openReports ? "warn" : "" },
    {
      label: "Users",
      value: totals ? totals.users : users.length >= LIST_LIMIT ? `${LIST_LIMIT}+` : users.length,
      icon: Users,
    },
    { label: "Unlimited", value: totals ? totals.paid : paidCount, icon: Crown, tone: "gold" },
    {
      label: "Banned",
      value: totals ? totals.banned : bannedCount,
      icon: Ban,
      tone: (totals ? totals.banned : bannedCount) ? "danger" : "",
    },
    { label: "Active circles", value: activeCircles, icon: Layers },
  ];

  const list =
    tab === "reports" ? filteredReports : tab === "users" ? filteredUsers : filteredCircles;

  return (
    <div className="ad-page">
      <header className="ad-head">
        <div>
          <p className="ad-kicker">
            <Shield size={14} aria-hidden="true" /> Owner only
          </p>
          <h1 className="ad-title">Control center</h1>
          <p className="ad-sub">Reports, users and circles. Emails stay on this page, never in public lists.</p>
        </div>
        <button type="button" className="ad-btn" onClick={load} disabled={busy}>
          <RefreshCw size={16} className={busy ? "ad-spin" : ""} aria-hidden="true" />
          <span>{busy ? "Loading" : "Refresh"}</span>
        </button>
      </header>

      <section className="ad-stats" aria-label="Overview">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`ad-stat ${tone ? `tone-${tone}` : ""}`}>
            <span className="ad-stat-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="ad-stat-value">{busy && !users.length ? "–" : value}</span>
            <span className="ad-stat-label">{label}</span>
          </div>
        ))}
      </section>

      <nav className="ad-tabs" role="tablist" aria-label="Sections">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`ad-tab ${tab === key ? "active" : ""}`}
            onClick={() => {
              setTab(key);
              setSearch("");
            }}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            {counts[key] !== undefined && <span className="ad-count">{counts[key]}</span>}
          </button>
        ))}
      </nav>

      {tab !== "analytics" && (
      <div className="ad-toolbar">
        <label className="ad-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "users"
                ? "Search name or email"
                : tab === "circles"
                ? "Search circles"
                : "Search reports"
            }
          />
        </label>
        <div className="ad-chips" role="group" aria-label="Filter">
          {FILTERS[tab].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`ad-chip ${filters[tab] === key ? "active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, [tab]: key }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      )}

      {error && (
        <div className="ad-alert" role="alert">
          {error}
        </div>
      )}

      {tab === "analytics" ? (
        <AnalyticsPanel
          metrics={metrics}
          eventsError={eventsError}
          busy={busy}
          usersCapped={users.length >= LIST_LIMIT}
        />
      ) : busy && !users.length && !communities.length && !reports.length ? (
        <ul className="ad-list" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="ad-row ad-skeleton" />
          ))}
        </ul>
      ) : list.length === 0 ? (
        <div className="ad-empty">
          <span className="ad-empty-icon">
            <Check size={22} aria-hidden="true" />
          </span>
          <strong>
            {tab === "reports" && filters.reports === "open" && !q
              ? "All clear"
              : "Nothing to show"}
          </strong>
          <p>
            {q
              ? "No results for that search."
              : tab === "reports"
              ? "There are no reports here."
              : tab === "users"
              ? "No users match this filter."
              : "No circles match this filter."}
          </p>
        </div>
      ) : (
        <ul className="ad-list">
          {tab === "reports" &&
            filteredReports.map((r) => {
              const closed = r.status === "closed";
              const circle = communities.find((c) => c.id === r.communityId);
              const circleName = r.communityName || circle?.name || r.communityId || "Unknown circle";
              const by = r.reporterName || r.reportedByName || r.reporterId || r.userId;
              return (
                <li key={r.id} className="ad-row">
                  <span className="ad-avatar tone-warn">
                    <Flag size={18} aria-hidden="true" />
                  </span>
                  <div className="ad-main">
                    <div className="ad-name">{circleName}</div>
                    <div className="ad-line">{r.reason || "No reason given"}</div>
                    <div className="ad-meta">
                      {[by ? `Reported by ${by}` : "", fmtDate(r.createdAt)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="ad-tags">
                    <span className={`ad-badge ${closed ? "" : "amber"}`}>{closed ? "Closed" : "Open"}</span>
                    {circle?.deleted && <span className="ad-badge red">Unlisted</span>}
                  </div>
                  <div className="ad-actions">
                    {!closed && (
                      <button type="button" className="ad-btn small" onClick={() => closeReport(r.id)}>
                        Close
                      </button>
                    )}
                    {r.communityId && !circle?.deleted && (
                      <button
                        type="button"
                        className="ad-btn small danger"
                        onClick={() => askUnlist(r.communityId, circleName)}
                      >
                        Unlist circle
                      </button>
                    )}
                  </div>
                </li>
              );
            })}

          {tab === "users" &&
            filteredUsers.map((u) => {
              const isAdminUser = ADMIN_UIDS.includes(u.id);
              const name = u.displayName || u.name || u.email || u.id;
              const joined = fmtDate(u.createdAt || u.signupAt);
              return (
                <li key={u.id} className={`ad-row ${u.banned ? "is-banned" : ""}`}>
                  <span className="ad-avatar">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      firstLetter(name)
                    )}
                  </span>
                  <div className="ad-main">
                    <div className="ad-name">
                      {name}
                      {isAdminUser && <span className="ad-badge blue">Admin</span>}
                      {u.id === user.uid && <span className="ad-badge">You</span>}
                    </div>
                    <div className="ad-line">{u.email || u.id}</div>
                    <div className="ad-meta">
                      {[
                        joined ? `Joined ${joined}` : "",
                        u.lastActiveAt ? `Active ${ago(u.lastActiveAt)}` : "",
                        u.banned && u.bannedReason ? `Reason: ${u.bannedReason}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="ad-tags">
                    <span className={`ad-badge ${isPaidPlan(u.plan) ? "gold" : ""}`}>
                      {isPaidPlan(u.plan) ? "Unlimited" : "Free"}
                    </span>
                    <span className={`ad-badge ${u.banned ? "red" : "green"}`}>
                      {u.banned ? "Banned" : "Active"}
                    </span>
                  </div>
                  <div className="ad-actions">
                    {isAdminUser ? (
                      <span className="ad-meta">Protected</span>
                    ) : u.banned ? (
                      <button type="button" className="ad-btn small" onClick={() => askUnban(u)}>
                        Unban
                      </button>
                    ) : (
                      <button type="button" className="ad-btn small danger" onClick={() => askBan(u)}>
                        Ban
                      </button>
                    )}
                  </div>
                </li>
              );
            })}

          {tab === "circles" &&
            filteredCircles.map((c) => (
              <li key={c.id} className={`ad-row ${c.deleted ? "is-banned" : ""}`}>
                <span className="ad-avatar">{firstLetter(c.name)}</span>
                <div className="ad-main">
                  <div className="ad-name">{c.name || c.id}</div>
                  <div className="ad-line">
                    {[c.tag, `${c.memberCount || 0} members`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="ad-meta">
                    {[c.createdByName ? `By ${c.createdByName}` : "", fmtDate(c.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="ad-tags">
                  <span className="ad-badge">{c.visibility === "private" ? "Private" : c.visibility || "Public"}</span>
                  {c.deleted && <span className="ad-badge red">Unlisted</span>}
                </div>
                <div className="ad-actions">
                  {c.deleted ? (
                    <button type="button" className="ad-btn small" onClick={() => restoreCircle(c.id)}>
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ad-btn small danger"
                      onClick={() => askUnlist(c.id, c.name)}
                    >
                      Unlist
                    </button>
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}

      <p className="ad-foot">
        Showing up to {LIST_LIMIT} users and circles and the latest {REPORT_LIMIT} reports.
      </p>

      {confirm && (
        <div className="ad-overlay" onClick={() => !working && setConfirm(null)}>
          <div
            className="ad-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ad-modal-close"
              aria-label="Close"
              onClick={() => setConfirm(null)}
              disabled={working}
            >
              <X size={18} />
            </button>
            <h2 id="ad-modal-title">{confirm.title}</h2>
            <p>{confirm.body}</p>
            {confirm.askReason && (
              <label className="ad-reason">
                <span>Reason (optional, only you can see it)</span>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example: spam in several circles"
                />
              </label>
            )}
            <div className="ad-modal-actions">
              <button type="button" className="ad-btn" onClick={() => setConfirm(null)} disabled={working}>
                Cancel
              </button>
              <button
                type="button"
                className={`ad-btn ${confirm.danger ? "danger solid" : "primary"}`}
                onClick={runConfirm}
                disabled={working}
              >
                {working ? "Working…" : confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Analytics tab ---------- */

const WEEKLY_ROWS = [
  ["circle_join", "Circles joined"],
  ["circle_create", "Circles created"],
  ["chat_message", "Chat activity"],
  ["question_post", "Questions asked"],
  ["reply_post", "Answers posted"],
  ["call_join", "Live session joins"],
];

function shortDay(d) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Delta({ cur, prev }) {
  if (!prev) return cur ? <span className="ad-delta up">new</span> : <span className="ad-delta">–</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="ad-delta">no change</span>;
  return (
    <span className={`ad-delta ${pct > 0 ? "up" : "down"}`}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function BarChart({ days, values, label }) {
  const max = Math.max(1, ...values);
  const W = 100;
  const H = 40;
  const bw = W / values.length;
  return (
    <figure className="ad-chart">
      <span className="ad-chart-max">{max}</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" y1={H - 0.2} x2={W} y2={H - 0.2} className="ad-chart-base" />
        {values.map((v, i) => {
          const h = v ? Math.max(1.4, (v / max) * (H - 3)) : 0.7;
          return (
            <rect
              key={days[i]}
              x={i * bw + 0.3}
              y={H - h}
              width={bw - 0.6}
              height={h}
              rx="0.5"
              className={v ? "on" : "off"}
            >
              <title>{`${shortDay(days[i])}: ${v}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption>
        <span>{shortDay(days[0])}</span>
        <span>{shortDay(days[Math.floor(days.length / 2)])}</span>
        <span>{shortDay(days[days.length - 1])}</span>
      </figcaption>
    </figure>
  );
}

function AnalyticsPanel({ metrics: m, eventsError, busy, usersCapped }) {
  const pct = (n) => `${Math.round(n * 100)}%`;
  const base = m.funnel[0]?.count || 0;
  const noSignupDates = m.signupsByDay.every((n) => n === 0);

  return (
    <div className="ad-analytics">
      {eventsError ? (
        <div className="ad-alert" role="alert">
          {eventsError}
        </div>
      ) : !m.hasEvents && !busy ? (
        <div className="ad-infobox">
          No activity has been recorded yet. Counting starts once the new version of the app is
          live and people open it, and everything below fills in from that day.
        </div>
      ) : null}

      <section className="ad-kpis" aria-label="Key numbers">
        <div className="ad-kpi">
          <span className="ad-kpi-label">Weekly active users</span>
          <span className="ad-kpi-value">{m.wau}</span>
          <Delta cur={m.wau} prev={m.prevWau} />
          <span className="ad-kpi-hint">Different people who opened the app in the last 7 days</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Active today</span>
          <span className="ad-kpi-value">{m.dauToday}</span>
          <span className="ad-kpi-hint">People who opened the app today (UTC)</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Stickiness</span>
          <span className="ad-kpi-value">{m.wau ? pct(m.stickiness) : "–"}</span>
          <span className="ad-kpi-hint">Average daily users ÷ weekly users. Higher means a habit.</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Week-1 return</span>
          <span className="ad-kpi-value">
            {m.week1.rate === null ? "–" : pct(m.week1.rate)}
          </span>
          <span className="ad-kpi-hint">
            {m.week1.cohort
              ? `${m.week1.returned} of ${m.week1.cohort} who joined 7–13 days ago came back this week`
              : "Needs people who joined 7–13 days ago"}
          </span>
        </div>
      </section>

      <section className="ad-panel">
        <header>
          <h3>Daily active users</h3>
          <span>Last 30 days</span>
        </header>
        <BarChart days={m.days} values={m.dau} label="Daily active users, last 30 days" />
      </section>

      <section className="ad-panel">
        <header>
          <h3>New sign-ups</h3>
          <span>
            {m.signups7} this week <Delta cur={m.signups7} prev={m.signupsPrev7} />
          </span>
        </header>
        <BarChart days={m.days} values={m.signupsByDay} label="New sign-ups, last 30 days" />
        {noSignupDates && (
          <p className="ad-panel-note">
            Sign-up dates are saved the next time each person opens the app, so this chart fills in
            over the first days.
          </p>
        )}
        {usersCapped && (
          <p className="ad-panel-note">Based on the first 100 users loaded on this page.</p>
        )}
      </section>

      <section className="ad-panel">
        <header>
          <h3>From sign-up to regular use</h3>
          <span>People who signed up in the last 30 days</span>
        </header>
        <ul className="ad-funnel">
          {m.funnel.map((s) => (
            <li key={s.key} className="ad-funnel-row">
              <div className="ad-funnel-top">
                <span>{s.label}</span>
                <span>
                  <strong>{s.count}</strong>
                  {base ? ` · ${Math.round((s.count / base) * 100)}%` : ""}
                </span>
              </div>
              <div className="ad-funnel-bar">
                <span style={{ width: `${base ? (s.count / base) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ad-panel">
        <header>
          <h3>This week vs last week</h3>
          <span>Number of actions</span>
        </header>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>This week</th>
              <th>Last week</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {WEEKLY_ROWS.map(([type, label]) => {
              const cur = m.weekly.current[type] || 0;
              const prev = m.weekly.previous[type] || 0;
              return (
                <tr key={type}>
                  <td>{label}</td>
                  <td>{cur}</td>
                  <td>{prev}</td>
                  <td>
                    <Delta cur={cur} prev={prev} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="ad-foot">
        Days are in UTC. Numbers count from the day tracking went live. Uses the latest{" "}
        {EVENT_LIMIT.toLocaleString()} events from the last {EVENT_DAYS} days.
      </p>
    </div>
  );
}
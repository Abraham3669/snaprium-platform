// src/pages/Admin.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  query,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  increment,
  orderBy,
  startAfter,
  writeBatch,
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
  FileText,
  Download,
  ExternalLink,
  Trash2,
  ChevronRight,
  Globe,
  Copy,
  Pencil,
} from "lucide-react";
import { computeMetrics, dayKey, toMillis } from "../lib/adminMetrics";
import { computeFeedStats, countReports, reportKey, sortUsers, toCsv, downloadCsv } from "../lib/adminFeed";
import { computeVisits } from "../lib/adminVisits";
import { COMMUNITY_TAGS } from "../lib/communities";
import { countFollowers, countPosts, fetchPostsBy } from "../lib/feed";
import { KIND_IDS, kindLabel, topicLabel } from "../lib/topics";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import "../styles/admin.css";

const ADMIN_UIDS = ["csFXC9p3lLcmzmyP2YjFT42yMSw1"];
const LIST_LIMIT = 100;
const REPORT_LIMIT = 200;
const POST_LIMIT = 100;
const EVENT_DAYS = 30;
const EVENT_LIMIT = 5000;
const VISIT_LIMIT = 10000;

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
  posts: [["all", "All"], ...KIND_IDS.map((k) => [k, k === "post" ? "Plain" : kindLabel(k)])],
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

const USER_SORTS = [
  ["new", "Newest"],
  ["active", "Recently active"],
  ["name", "Name"],
];

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

  const [posts, setPosts] = useState([]);
  const [postTotal, setPostTotal] = useState(null);
  const [more, setMore] = useState({ users: false, circles: false, posts: false });
  const [loadingMore, setLoadingMore] = useState("");
  const cursors = useRef({ users: null, circles: null, posts: null });

  const [tab, setTab] = useState("analytics");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ reports: "open", users: "all", circles: "all", posts: "all" });
  const [userSort, setUserSort] = useState("new");
  const [detail, setDetail] = useState(null); // { user, loading, postCount, followers, posts }
  const [circleId, setCircleId] = useState(null); // the circle whose panel is open
  const [visits, setVisits] = useState([]);
  const [visitsBusy, setVisitsBusy] = useState(false);
  const [visitsError, setVisitsError] = useState("");
  const [visitsLoaded, setVisitsLoaded] = useState(false);

  const [confirm, setConfirm] = useState(null); // { title, body, label, danger, askReason, run }
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const allowed = user && ADMIN_UIDS.includes(user.uid);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [userSnap, communitySnap, postSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), limit(LIST_LIMIT))),
        getDocs(query(collection(db, "communities"), limit(LIST_LIMIT))),
        getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(POST_LIMIT))).catch((err) => {
          console.warn("[admin] posts failed", err);
          return null;
        }),
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
      setPosts(postSnap ? postSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
      cursors.current = {
        users: userSnap.docs[userSnap.docs.length - 1] || null,
        circles: communitySnap.docs[communitySnap.docs.length - 1] || null,
        posts: postSnap ? postSnap.docs[postSnap.docs.length - 1] || null : null,
      };
      setMore({
        users: userSnap.docs.length >= LIST_LIMIT,
        circles: communitySnap.docs.length >= LIST_LIMIT,
        posts: !!postSnap && postSnap.docs.length >= POST_LIMIT,
      });

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
      try {
        const n = await getCountFromServer(query(collection(db, "posts")));
        setPostTotal(n.data().count);
      } catch {
        setPostTotal(null);
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

  const loadVisits = useCallback(async () => {
    setVisitsBusy(true);
    setVisitsError("");
    try {
      const since = dayKey(Date.now() - 29 * 86400000);
      const snap = await getDocs(
        query(collection(db, "visits"), where("day", ">=", since), orderBy("day", "desc"), limit(VISIT_LIMIT))
      );
      setVisits(snap.docs.map((d) => d.data()));
      setVisitsLoaded(true);
    } catch (err) {
      console.warn("[admin] visits failed", err);
      setVisitsError("Could not read the visits. Publish the new Firestore rules first.");
    } finally {
      setVisitsBusy(false);
    }
  }, []);

  useEffect(() => {
    if (allowed && tab === "visits" && !visitsLoaded && !visitsBusy) loadVisits();
  }, [allowed, tab, visitsLoaded, visitsBusy, loadVisits]);

  // Esc closes the top window (the confirm window first, then the person's details)
  useEffect(() => {
    if (!confirm && !detail && !circleId) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || working) return;
      if (confirm) setConfirm(null);
      else if (circleId) setCircleId(null);
      else setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, detail, circleId, working]);

  const q = search.trim().toLowerCase();
  const matches = (values) => !q || values.some((v) => String(v || "").toLowerCase().includes(q));

  const filteredUsers = useMemo(
    () =>
      sortUsers(users, userSort).filter((u) => {
        if (filters.users === "banned" && !u.banned) return false;
        if (filters.users === "paid" && !isPaidPlan(u.plan)) return false;
        return matches([u.email, u.displayName, u.name, u.id]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, filters.users, userSort, q]
  );

  const filteredPosts = useMemo(
    () =>
      posts.filter((p) => {
        if (filters.posts !== "all" && (p.kind || "post") !== filters.posts) return false;
        return matches([p.text, p.authorName, p.uid, p.id, ...(p.topics || [])]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, filters.posts, q]
  );

  const reportCounts = useMemo(() => countReports(reports.filter((r) => r.status !== "closed")), [reports]);
  const feedStats = useMemo(() => computeFeedStats(posts), [posts]);

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
        return matches([r.communityName, r.communityId, r.reason, r.reporterName, r.reporterId, r.type, r.contentName, r.preview, r.details]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, filters.reports, q]
  );

  const metrics = useMemo(() => computeMetrics({ events, users }), [events, users]);
  const visitStats = useMemo(() => computeVisits(visits), [visits]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const openReports = reports.filter((r) => r.status !== "closed").length;
  const bannedCount = users.filter((u) => u.banned).length;
  const paidCount = users.filter((u) => isPaidPlan(u.plan)).length;
  const activeCircles = communities.filter((c) => !c.deleted).length;
  const counts = {
    reports: openReports,
    users: totals ? totals.users : users.length,
    circles: activeCircles,
    posts: postTotal !== null ? postTotal : posts.length,
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

  const patchUserEverywhere = (id, patch) => {
    patchUser(id, patch);
    setDetail((d) => (d && d.user.id === id ? { ...d, user: { ...d.user, ...patch } } : d));
  };

  // Delete a post together with its replies (Firestore does not remove sub-collections by itself).
  const removePost = async (id) => {
    for (let i = 0; i < 20; i++) {
      const rs = await getDocs(query(collection(db, "posts", id, "replies"), limit(400)));
      if (rs.empty) break;
      const batch = writeBatch(db);
      rs.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      if (rs.docs.length < 400) break;
    }
    await deleteDoc(doc(db, "posts", id));
    setPosts((rows) => rows.filter((p) => p.id !== id));
    setDetail((d) => (d ? { ...d, posts: d.posts.filter((p) => p.id !== id) } : d));
    setPostTotal((n) => (n === null ? n : Math.max(0, n - 1)));
  };

  // Delete one reply on a feed post and keep the post's reply counter right (the counter step is best effort).
  const removeFeedReply = async (postId, replyId) => {
    const ref = doc(db, "posts", postId, "replies", replyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await deleteDoc(ref);
    try {
      await updateDoc(doc(db, "posts", postId), { replyCount: increment(-1) });
      setPosts((rows) => rows.map((p) => (p.id === postId ? { ...p, replyCount: Math.max(0, (p.replyCount || 0) - 1) } : p)));
    } catch (err) {
      console.warn("[admin] reply counter not updated", err);
    }
  };

  const loadMore = async (which) => {
    const last = cursors.current[which];
    if (!last || loadingMore) return;
    setLoadingMore(which);
    try {
      const col = which === "users" ? "users" : which === "circles" ? "communities" : "posts";
      const size = which === "posts" ? POST_LIMIT : LIST_LIMIT;
      const snap = await getDocs(
        which === "posts"
          ? query(collection(db, col), orderBy("createdAt", "desc"), startAfter(last), limit(size))
          : query(collection(db, col), startAfter(last), limit(size))
      );
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const add = (prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      };
      if (which === "users") setUsers(add);
      else if (which === "circles") setCommunities(add);
      else setPosts(add);
      cursors.current[which] = snap.docs[snap.docs.length - 1] || null;
      setMore((m) => ({ ...m, [which]: snap.docs.length >= size }));
    } catch (err) {
      console.error(err);
      toast.error("Could not load more.");
    } finally {
      setLoadingMore("");
    }
  };

  // A person's details: counts and latest posts, loaded when the window opens.
  const openDetail = async (target) => {
    setDetail({ user: target, loading: true, postCount: null, followers: null, posts: [] });
    const [postCount, followers, recent] = await Promise.all([
      countPosts(target.id),
      countFollowers(target.id),
      fetchPostsBy(target.id, 5).catch(() => ({ posts: [] })),
    ]);
    setDetail((d) =>
      d && d.user.id === target.id ? { ...d, loading: false, postCount, followers, posts: recent.posts || [] } : d
    );
  };

  const setPlan = async (target, unlimited) => {
    const patch = unlimited
      ? { plan: "unlimited", isUnlimited: true, planSource: "admin", planUpdatedAt: serverTimestamp(), planUpdatedBy: user.uid }
      : { plan: "free", isUnlimited: false, planSource: "admin", planUpdatedAt: serverTimestamp(), planUpdatedBy: user.uid };
    await updateDoc(doc(db, "users", target.id), patch);
    patchUserEverywhere(target.id, { plan: patch.plan, isUnlimited: patch.isUnlimited });
    toast.success(unlimited ? "Unlimited granted" : "Back to the free plan");
  };

  const exportUsers = () => {
    downloadCsv(
      `snaprium-users-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["uid", "name", "email", "plan", "status", "joined", "last_active"],
        filteredUsers.map((u) => [
          u.id,
          u.displayName || u.name || "",
          u.email || "",
          isPaidPlan(u.plan) ? "unlimited" : "free",
          u.banned ? "banned" : "active",
          toDate(u.createdAt || u.signupAt)?.toISOString() || "",
          toDate(u.lastActiveAt)?.toISOString() || "",
        ])
      )
    );
  };

  const exportReports = () => {
    downloadCsv(
      `snaprium-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["id", "type", "status", "reason", "details", "reported_uid", "reporter_uid", "content_id", "preview", "created"],
        filteredReports.map((r) => [
          r.id,
          r.type || "community",
          r.status || "open",
          r.reason || "",
          r.details || "",
          r.contentUid || "",
          r.reporterId || "",
          r.contentId || "",
          r.preview || "",
          toDate(r.createdAt)?.toISOString() || "",
        ])
      )
    );
  };

  const banUser = async (target, why) => {
    await updateDoc(doc(db, "users", target.id), {
      banned: true,
      bannedAt: serverTimestamp(),
      bannedBy: user.uid,
      bannedReason: why || null,
    });
    patchUserEverywhere(target.id, { banned: true, bannedAt: new Date(), bannedReason: why || null });
    toast.success("User banned");
  };

  const unbanUser = async (target) => {
    await updateDoc(doc(db, "users", target.id), {
      banned: false,
      bannedReason: null,
      unbannedAt: serverTimestamp(),
      unbannedBy: user.uid,
    });
    patchUserEverywhere(target.id, { banned: false, bannedReason: null });
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

  // Remove the reported message, question or reply, then close the report.
  const deleteReported = async (r) => {
    const cid = r.communityId;
    if (r.type === "dm") {
      if (!r.boardId || !r.contentId) throw new Error("missing ids");
      await deleteDoc(doc(db, "dms", r.boardId, "messages", r.contentId));
      await closeReport(r.id);
      toast.success("Message deleted");
      return;
    }
    if (r.type === "post") {
      if (!r.contentId) throw new Error("missing ids");
      await removePost(r.contentId);
      await closeReport(r.id);
      toast.success("Post deleted");
      return;
    }
    if (r.type === "reply" && !cid) {
      if (!r.questionId || !r.contentId) throw new Error("missing ids");
      await removeFeedReply(r.questionId, r.contentId);
      await closeReport(r.id);
      toast.success("Reply deleted");
      return;
    }
    if (!cid || !r.contentId) throw new Error("missing ids");
    let ref;
    if (r.type === "message") ref = doc(db, "communities", cid, "messages", r.contentId);
    else if (r.type === "question") ref = doc(db, "communities", cid, "boards", r.boardId, "questions", r.contentId);
    else ref = doc(db, "communities", cid, "boards", r.boardId, "questions", r.questionId, "replies", r.contentId);
    await deleteDoc(ref);
    await closeReport(r.id);
    toast.success("Content deleted");
  };

  // A reported profile: clear the banner and bio from the person's public card, then close the report.
  const clearReportedProfile = async (r) => {
    if (!r.contentUid) throw new Error("missing uid");
    await updateDoc(doc(db, "publicProfiles", r.contentUid), {
      banner: "",
      bio: "",
      updatedAt: serverTimestamp(),
    });
    await closeReport(r.id);
    toast.success("Banner and bio removed");
  };

  const askClearProfile = (r) =>
    ask({
      title: "Remove banner and bio?",
      body: "Their banner and bio are cleared for everyone and the report is closed. Their name and photo stay. They can add new ones.",
      label: "Remove",
      danger: true,
      run: () => clearReportedProfile(r),
    });

  const askDeleteReported = (r) =>
    ask({
      title: `Delete this ${r.type}?`,
      body: "It is removed for everyone and the report is closed. This can't be undone.",
      label: "Delete",
      danger: true,
      run: () => deleteReported(r),
    });

  const askDeletePost = (p) =>
    ask({
      title: "Delete this post?",
      body: "The post and all its replies are removed for everyone. This can't be undone.",
      label: "Delete post",
      danger: true,
      run: async () => {
        await removePost(p.id);
        toast.success("Post deleted");
      },
    });

  const askPlan = (target, unlimited) =>
    ask({
      title: unlimited ? "Give Unlimited?" : "Move to the free plan?",
      body: unlimited
        ? `${target.email || target.displayName || target.id} gets Unlimited without paying. Use it for gifts and testers.`
        : `${target.email || target.displayName || target.id} goes back to the free plan. If they pay through the App Store or the web, the next payment check can set it again.`,
      label: unlimited ? "Give Unlimited" : "Move to free",
      danger: !unlimited,
      run: () => setPlan(target, unlimited),
    });

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
    ["posts", "Posts", FileText],
    ["users", "Users", Users],
    ["circles", "Circles", Layers],
    ["visits", "Visits", Globe],
  ];

  const stats = [
    { label: "Open reports", value: openReports, icon: Flag, tone: openReports ? "warn" : "" },
    {
      label: "Users",
      value: totals ? totals.users : users.length >= LIST_LIMIT ? `${LIST_LIMIT}+` : users.length,
      icon: Users,
    },
    { label: "Circles", value: activeCircles, icon: Layers },
    { label: "Posts", value: postTotal !== null ? postTotal : posts.length >= POST_LIMIT ? `${POST_LIMIT}+` : posts.length, icon: FileText },
  ];

  const list =
    tab === "reports"
      ? filteredReports
      : tab === "users"
      ? filteredUsers
      : tab === "posts"
      ? filteredPosts
      : filteredCircles;

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

      {tab !== "analytics" && tab !== "visits" && (
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
                : tab === "posts"
                ? "Search posts, people or topics"
                : "Search reports"
            }
          />
        </label>
        {tab === "users" && (
          <label className="ad-sort">
            <span>Sort</span>
            <select value={userSort} onChange={(e) => setUserSort(e.target.value)}>
              {USER_SORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
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
        {(tab === "users" || tab === "reports") && (
          <button type="button" className="ad-btn small" onClick={tab === "users" ? exportUsers : exportReports} disabled={!list.length}>
            <Download size={14} aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        )}
      </div>
      )}

      {error && (
        <div className="ad-alert" role="alert">
          {error}
        </div>
      )}

      {tab === "visits" ? (
        <VisitsPanel stats={visitStats} busy={visitsBusy} error={visitsError} users={users} onRefresh={loadVisits} />
      ) : tab === "analytics" ? (
        <AnalyticsPanel
          metrics={metrics}
          eventsError={eventsError}
          busy={busy}
          usersCapped={users.length >= LIST_LIMIT}
          feed={feedStats}
          postsCapped={posts.length >= POST_LIMIT}
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
              : tab === "posts"
              ? "No posts match this filter."
              : "No circles match this filter."}
          </p>
        </div>
      ) : (
        <ul className="ad-list">
          {tab === "reports" &&
            filteredReports.map((r) => {
              const closed = r.status === "closed";
              const kind = r.type || "community";
              const isContent = kind === "message" || kind === "question" || kind === "reply" || kind === "dm" || kind === "post";
              const viewId = kind === "post" ? r.contentId : kind === "reply" && !r.communityId ? r.questionId : "";
              const repeats = reportCounts.get(reportKey(r)) || 0;
              const circle = communities.find((c) => c.id === r.communityId);
              const circleName = r.communityName || circle?.name || r.communityId || "Unknown circle";
              const reporter = users.find((u) => u.id === r.reporterId);
              const by =
                r.reporterName || r.reportedByName || reporter?.displayName || reporter?.email || r.reporterId || r.userId;
              const target = r.contentUid
                ? users.find((u) => u.id === r.contentUid) || { id: r.contentUid, displayName: r.contentName }
                : null;
              const targetName = target?.displayName || target?.email || r.contentName || "Member";
              const title = kind === "community" ? circleName : `${kind[0].toUpperCase()}${kind.slice(1)} by ${targetName}`;
              const line = [r.reason || "No reason given", r.preview ? `"${r.preview.slice(0, 160)}"` : ""]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={r.id} className="ad-row">
                  <span className="ad-avatar tone-warn">
                    <Flag size={18} aria-hidden="true" />
                  </span>
                  <div className="ad-main">
                    <div className="ad-name">{title}</div>
                    <div className="ad-line">{line}</div>
                    {r.details ? <div className="ad-line">Note: {r.details}</div> : null}
                    <div className="ad-meta">
                      {[
                        kind !== "community" && circleName !== "Unknown circle" ? `In ${circleName}` : "",
                        by ? `Reported by ${by}` : "",
                        fmtDate(r.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="ad-tags">
                    <span className={`ad-badge ${closed ? "" : "amber"}`}>{closed ? "Closed" : "Open"}</span>
                    <span className="ad-badge">{kind === "user" ? "Person" : kind === "profile" ? "Profile" : kind}</span>
                    {!closed && repeats > 1 && <span className="ad-badge red">{repeats} reports</span>}
                    {circle?.deleted && <span className="ad-badge red">Unlisted</span>}
                    {target?.banned && <span className="ad-badge red">Banned</span>}
                  </div>
                  <div className="ad-actions">
                    {viewId && (
                      <Link className="ad-btn small" to={`/post/${viewId}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} aria-hidden="true" />
                        <span>View</span>
                      </Link>
                    )}
                    {!closed && (
                      <button type="button" className="ad-btn small" onClick={() => closeReport(r.id)}>
                        Close
                      </button>
                    )}
                    {kind === "profile" && !closed && (
                      <button type="button" className="ad-btn small danger" onClick={() => askClearProfile(r)}>
                        Remove banner and bio
                      </button>
                    )}
                    {isContent && !closed && (
                      <button type="button" className="ad-btn small danger" onClick={() => askDeleteReported(r)}>
                        Delete content
                      </button>
                    )}
                    {target && !target.banned && !ADMIN_UIDS.includes(target.id) && kind !== "community" && (
                      <button type="button" className="ad-btn small danger" onClick={() => askBan(target)}>
                        Ban user
                      </button>
                    )}
                    {target?.banned && kind !== "community" && !ADMIN_UIDS.includes(target.id) && (
                      <button type="button" className="ad-btn small" onClick={() => askUnban(target)}>
                        Unban user
                      </button>
                    )}
                    {kind === "community" && r.communityId && !circle?.deleted && (
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
                    <button type="button" className="ad-btn small" onClick={() => openDetail(u)}>
                      Details
                    </button>
                  </div>
                </li>
              );
            })}

          {tab === "posts" &&
            filteredPosts.map((p) => {
              const author = users.find((u) => u.id === p.uid);
              const pic = p.media?.find((m) => m.type === "image");
              const kind = p.kind || "post";
              const reported = reportCounts.get(`post:${p.id}`) || 0;
              const meta = [
                `${p.sparkCount || 0} Sparks`,
                `${p.replyCount || 0} replies`,
                ...(p.topics || []).map(topicLabel).filter(Boolean),
                fmtDate(p.createdAt),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={p.id} className={`ad-row ${author?.banned ? "is-banned" : ""}`}>
                  <span className="ad-avatar">
                    {pic ? <img src={pic.url} alt="" loading="lazy" /> : firstLetter(p.authorName)}
                  </span>
                  <div className="ad-main">
                    <div className="ad-name">{p.authorName || "Member"}</div>
                    <div className="ad-line ad-clamp">{p.text || (pic ? "Picture post" : "")}</div>
                    <div className="ad-meta">{meta}</div>
                  </div>
                  <div className="ad-tags">
                    {kind !== "post" && <span className="ad-badge">{kindLabel(kind)}</span>}
                    {kind === "question" && <span className={`ad-badge ${p.answered ? "green" : "amber"}`}>{p.answered ? "Answered" : "Waiting"}</span>}
                    {p.media?.length > 0 && <span className="ad-badge">{p.media.length} pic{p.media.length > 1 ? "s" : ""}</span>}
                    {reported > 0 && <span className="ad-badge red">{reported} open report{reported > 1 ? "s" : ""}</span>}
                    {author?.banned && <span className="ad-badge red">Banned</span>}
                  </div>
                  <div className="ad-actions">
                    <Link className="ad-btn small" to={`/post/${p.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      <span>View</span>
                    </Link>
                    <button type="button" className="ad-btn small danger" onClick={() => askDeletePost(p)}>
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                    {author && !author.banned && !ADMIN_UIDS.includes(author.id) && (
                      <button type="button" className="ad-btn small danger" onClick={() => askBan(author)}>
                        Ban author
                      </button>
                    )}
                  </div>
                </li>
              );
            })}

          {tab === "circles" &&
            filteredCircles.map((c) => (
              <li
                key={c.id}
                className={`ad-row ad-row-tap ${c.deleted ? "is-banned" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setCircleId(c.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setCircleId(c.id)}
              >
                <span className="ad-avatar">
                  {c.photoUrl ? <img src={c.photoUrl} alt="" loading="lazy" /> : firstLetter(c.name)}
                </span>
                <div className="ad-main">
                  <div className="ad-name">
                    {c.name || c.id}
                    {c.deleted && <span className="ad-badge red">Unlisted</span>}
                  </div>
                  <div className="ad-meta">
                    {[c.tag, `${c.memberCount || (c.members || []).length || 0} members`, c.visibility === "private" ? "Private" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ChevronRight size={18} className="ad-chev" aria-hidden="true" />
              </li>
            ))}
        </ul>
      )}

      {more[tab] && list.length > 0 && (
        <div className="ad-more">
          <button type="button" className="ad-btn" onClick={() => loadMore(tab)} disabled={!!loadingMore}>
            {loadingMore === tab ? "Loading…" : tab === "posts" ? "Load older posts" : `Load more ${tab}`}
          </button>
        </div>
      )}

      {tab !== "visits" && tab !== "analytics" && (
        <p className="ad-foot">
          {list.length} shown{tab !== "reports" && more[tab] ? ". Load more for the rest." : ""}
        </p>
      )}

      {detail && (
        <UserDetail
          detail={detail}
          reports={reports}
          isAdminUser={ADMIN_UIDS.includes(detail.user.id)}
          isSelf={detail.user.id === user.uid}
          onClose={() => setDetail(null)}
          onBan={askBan}
          onUnban={askUnban}
          onPlan={askPlan}
          onDeletePost={askDeletePost}
        />
      )}

      {circleId && communities.find((c) => c.id === circleId) && (
        <CircleDetail
          circle={communities.find((c) => c.id === circleId)}
          me={user.uid}
          ask={ask}
          onClose={() => setCircleId(null)}
          onPatch={patchCircle}
          onUnlist={askUnlist}
          onRestore={restoreCircle}
        />
      )}

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

function AnalyticsPanel({ metrics: m, eventsError, busy, usersCapped, feed, postsCapped }) {
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

      <FeedInsights feed={feed} capped={postsCapped} />

      <p className="ad-foot">
        Days are in UTC. Numbers count from the day tracking went live. Uses the latest{" "}
        {EVENT_LIMIT.toLocaleString()} events from the last {EVENT_DAYS} days.
      </p>
    </div>
  );
}
/* ---------- Feed insights (worked out from the latest posts loaded on this page) ---------- */

function FeedInsights({ feed: f, capped }) {
  if (!f) return null;
  const pct = (n) => `${Math.round(n * 100)}%`;
  const maxKind = Math.max(1, ...f.kinds.map((k) => k.count));
  const maxTopic = Math.max(1, ...f.topics.map((k) => k.count));
  return (
    <>
      <div className="ad-section-title">
        <h2>Feed</h2>
        <span>{capped ? `Based on the latest ${f.total} posts` : `Based on ${f.total} posts`}</span>
      </div>

      <section className="ad-kpis" aria-label="Feed numbers">
        <div className="ad-kpi">
          <span className="ad-kpi-label">Posts this week</span>
          <span className="ad-kpi-value">{f.last7}</span>
          <Delta cur={f.last7} prev={f.prev7} />
          <span className="ad-kpi-hint">New posts in the last 7 days</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Sparks given</span>
          <span className="ad-kpi-value">{f.sparks}</span>
          <span className="ad-kpi-hint">{f.total ? `${f.avgSparks.toFixed(1)} per post on average` : "No posts yet"}</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Replies</span>
          <span className="ad-kpi-value">{f.replies}</span>
          <span className="ad-kpi-hint">{f.total ? `${(f.replies / f.total).toFixed(1)} per post on average` : "No posts yet"}</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Questions answered</span>
          <span className="ad-kpi-value">{f.answerRate === null ? "–" : pct(f.answerRate)}</span>
          <span className="ad-kpi-hint">
            {f.questions ? `${f.answered} of ${f.questions} ${f.questions === 1 ? "question has" : "questions have"} a helpful answer` : "No questions yet"}
          </span>
        </div>
      </section>

      <section className="ad-panel">
        <header>
          <h3>Posts per day</h3>
          <span>Last 30 days</span>
        </header>
        <BarChart days={f.days} values={f.perDay} label="Posts per day, last 30 days" />
      </section>

      <div className="ad-two">
        <section className="ad-panel">
          <header>
            <h3>What people post</h3>
            <span>By kind</span>
          </header>
          <ul className="ad-funnel">
            {f.kinds.map((k) => (
              <li key={k.id} className="ad-funnel-row">
                <div className="ad-funnel-top">
                  <span>{k.id === "post" ? "Plain post" : kindLabel(k.id) || k.id}</span>
                  <span><strong>{k.count}</strong></span>
                </div>
                <div className="ad-funnel-bar"><span style={{ width: `${(k.count / maxKind) * 100}%` }} /></div>
              </li>
            ))}
            {!f.kinds.length && <li className="ad-panel-note">No posts yet.</li>}
          </ul>
        </section>

        <section className="ad-panel">
          <header>
            <h3>Popular topics</h3>
            <span>Most used</span>
          </header>
          <ul className="ad-funnel">
            {f.topics.map((t) => (
              <li key={t.id} className="ad-funnel-row">
                <div className="ad-funnel-top">
                  <span>{topicLabel(t.id) || t.id}</span>
                  <span><strong>{t.count}</strong></span>
                </div>
                <div className="ad-funnel-bar"><span style={{ width: `${(t.count / maxTopic) * 100}%` }} /></div>
              </li>
            ))}
            {!f.topics.length && <li className="ad-panel-note">No topics used yet.</li>}
          </ul>
        </section>
      </div>

      <div className="ad-two">
        <section className="ad-panel">
          <header>
            <h3>Most helpful posts</h3>
            <span>By Sparks</span>
          </header>
          <ul className="ad-mini">
            {f.topPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/post/${p.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="ad-mini-text">{(p.text || "Picture post").slice(0, 90)}</span>
                  <span className="ad-mini-meta">{p.authorName || "Member"} · {p.sparkCount} Sparks</span>
                </Link>
              </li>
            ))}
            {!f.topPosts.length && <li className="ad-panel-note">No Sparks yet.</li>}
          </ul>
        </section>

        <section className="ad-panel">
          <header>
            <h3>Questions with no reply</h3>
            <span>Older than a day</span>
          </header>
          <ul className="ad-mini">
            {f.waiting.map((p) => (
              <li key={p.id}>
                <Link to={`/post/${p.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="ad-mini-text">{(p.text || "").slice(0, 90)}</span>
                  <span className="ad-mini-meta">{p.authorName || "Member"} · {ago(p.createdAt)}</span>
                </Link>
              </li>
            ))}
            {!f.waiting.length && <li className="ad-panel-note">Every older question has a reply.</li>}
          </ul>
        </section>
      </div>

      <section className="ad-panel">
        <header>
          <h3>Top contributors</h3>
          <span>Sparks and replies on their latest posts</span>
        </header>
        <table className="ad-table">
          <thead>
            <tr><th>Person</th><th>Posts</th><th>Sparks</th><th>Replies</th></tr>
          </thead>
          <tbody>
            {f.authors.map((a) => (
              <tr key={a.uid}>
                <td>{a.name}</td><td>{a.posts}</td><td>{a.sparks}</td><td>{a.replies}</td>
              </tr>
            ))}
            {!f.authors.length && (
              <tr><td colSpan={4}>No posts yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

/* ---------- One person's details ---------- */

function UserDetail({ detail, reports, isAdminUser, isSelf, onClose, onBan, onUnban, onPlan, onDeletePost }) {
  const u = detail.user;
  const name = u.displayName || u.name || u.email || u.id;
  const against = reports.filter((r) => r.contentUid === u.id);
  const openAgainst = against.filter((r) => r.status !== "closed").length;
  const paid = isPaidPlan(u.plan);
  const num = (n) => (detail.loading ? "…" : n === null || n === undefined ? "–" : n);
  const rows = [
    ["Email", u.email || "–"],
    ["User ID", u.id],
    ["Plan", paid ? "Unlimited" : "Free"],
    ["Joined", fmtDate(u.createdAt || u.signupAt) || "–"],
    ["Last active", u.lastActiveAt ? ago(u.lastActiveAt) : "–"],
  ];
  if (u.banned) rows.push(["Ban reason", u.bannedReason || "None given"]);

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal wide" role="dialog" aria-modal="true" aria-labelledby="ad-detail-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ad-modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="ad-detail-head">
          <span className="ad-avatar big">
            {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : firstLetter(name)}
          </span>
          <div>
            <h2 id="ad-detail-title">{name}</h2>
            <div className="ad-tags left">
              <span className={`ad-badge ${paid ? "gold" : ""}`}>{paid ? "Unlimited" : "Free"}</span>
              <span className={`ad-badge ${u.banned ? "red" : "green"}`}>{u.banned ? "Banned" : "Active"}</span>
              {isAdminUser && <span className="ad-badge blue">Admin</span>}
            </div>
          </div>
        </div>

        <div className="ad-detail-stats">
          <div><strong>{num(detail.postCount)}</strong><span>Posts</span></div>
          <div><strong>{num(detail.followers)}</strong><span>Followers</span></div>
          <div className={openAgainst ? "warn" : ""}><strong>{openAgainst}</strong><span>Open reports</span></div>
          <div><strong>{against.length}</strong><span>All reports</span></div>
        </div>

        <dl className="ad-detail-rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={k === "User ID" ? "mono" : ""}>{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="ad-detail-sub">Latest posts</h3>
        {detail.loading ? (
          <p className="ad-panel-note">Loading…</p>
        ) : detail.posts.length ? (
          <ul className="ad-mini">
            {detail.posts.map((p) => (
              <li key={p.id} className="with-action">
                <Link to={`/post/${p.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="ad-mini-text">{(p.text || "Picture post").slice(0, 110)}</span>
                  <span className="ad-mini-meta">{p.sparkCount || 0} Sparks · {p.replyCount || 0} replies · {fmtDate(p.createdAt)}</span>
                </Link>
                <button type="button" className="ad-btn small danger" onClick={() => onDeletePost(p)} aria-label="Delete post">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ad-panel-note">No posts.</p>
        )}

        {!isAdminUser && (
          <div className="ad-modal-actions wrap">
            <button type="button" className="ad-btn" onClick={() => onPlan(u, !paid)}>
              <Crown size={15} aria-hidden="true" />
              <span>{paid ? "Move to free" : "Give Unlimited"}</span>
            </button>
            {u.banned ? (
              <button type="button" className="ad-btn" onClick={() => onUnban(u)}>Unban</button>
            ) : (
              !isSelf && (
                <button type="button" className="ad-btn danger" onClick={() => onBan(u)}>
                  <Ban size={15} aria-hidden="true" />
                  <span>Ban</span>
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Circle panel: members, admins and controls ---------- */

const uniq = (a) => [...new Set((a || []).filter(Boolean))];

function CircleDetail({ circle: c, me, ask, onClose, onPatch, onUnlist, onRestore }) {
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [open, setOpen] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: c.name || "", description: c.description || "", tag: c.tag || "" });
  const [saving, setSaving] = useState(false);

  const members = c.members || [];
  const admins = c.admins || [];
  const banned = c.banned || [];
  const owner = c.createdBy || "";
  const ids = useMemo(() => uniq([owner, ...members, ...admins, ...banned]).slice(0, 400), [owner, members, admins, banned]);
  const idsKey = ids.join(",");

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      const out = {};
      for (let i = 0; i < ids.length; i += 25) {
        await Promise.all(
          ids.slice(i, i + 25).map(async (id) => {
            if (people[id]) return;
            try {
              const snap = await getDoc(doc(db, "users", id));
              out[id] = snap.exists() ? snap.data() : {};
            } catch {
              out[id] = {};
            }
          })
        );
      }
      if (!off) {
        setPeople((prev) => ({ ...prev, ...out }));
        setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const nameOf = (id) => {
    const u = people[id] || {};
    return u.displayName || u.name || u.email || id.slice(0, 8);
  };
  const roleOf = (id) => (id === owner ? "owner" : banned.includes(id) ? "banned" : admins.includes(id) ? "admin" : "member");

  const write = async (patch, done) => {
    await updateDoc(doc(db, "communities", c.id), { ...patch, updatedAt: serverTimestamp() });
    onPatch(c.id, patch);
    if (done) toast.success(done);
  };

  const makeAdmin = (id) => write({ admins: uniq([...admins, id]) }, "Made admin").catch(() => toast.error("Could not change role"));
  const removeAdmin = (id) => write({ admins: admins.filter((x) => x !== id) }, "Admin removed").catch(() => toast.error("Could not change role"));
  const removeMember = (id) => {
    const nextMembers = members.filter((x) => x !== id);
    return write(
      { members: nextMembers, admins: admins.filter((x) => x !== id), memberCount: nextMembers.length },
      "Removed from the circle"
    );
  };
  const banMember = (id) => {
    const nextMembers = members.filter((x) => x !== id);
    return write(
      { members: nextMembers, admins: admins.filter((x) => x !== id), banned: uniq([...banned, id]), memberCount: nextMembers.length },
      "Banned from the circle"
    );
  };
  const unbanMember = (id) => write({ banned: banned.filter((x) => x !== id) }, "Ban lifted").catch(() => toast.error("Could not lift the ban"));

  const askRemove = (id) =>
    ask({
      title: "Remove from this circle?",
      body: `${nameOf(id)} is removed from "${c.name}". They can join again if the circle is open.`,
      label: "Remove",
      danger: true,
      run: () => removeMember(id),
    });
  const askBan = (id) =>
    ask({
      title: "Ban from this circle?",
      body: `${nameOf(id)} is removed and can't join "${c.name}" again until you lift the ban.`,
      label: "Ban from circle",
      danger: true,
      run: () => banMember(id),
    });

  const askVisibility = () => {
    const toPrivate = c.visibility !== "private";
    ask({
      title: toPrivate ? "Make this circle private?" : "Make this circle public?",
      body: toPrivate
        ? "It is hidden from Explore. Only people with the invite code can join."
        : "Everyone can find it in Explore and join.",
      label: toPrivate ? "Make private" : "Make public",
      danger: toPrivate,
      run: () => write({ visibility: toPrivate ? "private" : "public" }, toPrivate ? "Now private" : "Now public"),
    });
  };

  const askClearPins = () =>
    ask({
      title: "Clear pinned messages?",
      body: "All pins in this circle are removed. The messages themselves stay.",
      label: "Clear pins",
      danger: true,
      run: () => write({ pinned: [] }, "Pins cleared"),
    });

  const saveInfo = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("A circle needs a name");
    setSaving(true);
    try {
      await write({ name: name.slice(0, 60), description: form.description.trim().slice(0, 160), tag: form.tag || c.tag || "" }, "Saved");
      setEditing(false);
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(c.code || "");
      toast.success("Invite code copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const term = q.trim().toLowerCase();
  const rows = ids
    .filter((id) => {
      const r = roleOf(id);
      if (role === "admin" && r !== "admin" && r !== "owner") return false;
      if (role === "banned" && r !== "banned") return false;
      if (role === "member" && r !== "member") return false;
      if (role === "all" && r === "banned") return false;
      if (!term) return true;
      const u = people[id] || {};
      return [u.displayName, u.name, u.email, id].some((v) => String(v || "").toLowerCase().includes(term));
    })
    .sort((a, b) => {
      const rank = { owner: 0, admin: 1, member: 2, banned: 3 };
      return rank[roleOf(a)] - rank[roleOf(b)] || nameOf(a).localeCompare(nameOf(b));
    });

  const created = fmtDate(c.createdAt);
  const count = members.length || c.memberCount || 0;

  return (
    <div className="ad-overlay ad-side" onClick={onClose}>
      <aside className="ad-panel-side" role="dialog" aria-modal="true" aria-label={c.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ad-modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="ad-cd-head">
          <span className="ad-avatar big">
            {c.photoUrl ? <img src={c.photoUrl} alt="" /> : firstLetter(c.name)}
          </span>
          <div>
            <h2>{c.name || c.id}</h2>
            <div className="ad-tags left">
              {c.tag && <span className="ad-badge">{c.tag}</span>}
              <span className="ad-badge">{c.visibility === "private" ? "Private" : "Public"}</span>
              {c.deleted && <span className="ad-badge red">Unlisted</span>}
            </div>
          </div>
        </div>

        {c.description && !editing && <p className="ad-cd-desc">{c.description}</p>}

        <div className="ad-detail-stats">
          <div><strong>{count}</strong><span>Members</span></div>
          <div><strong>{uniq([owner, ...admins]).length}</strong><span>Admins</span></div>
          <div><strong>{banned.length}</strong><span>Banned</span></div>
          <div><strong>{(c.pinned || []).length}</strong><span>Pinned</span></div>
        </div>

        <p className="ad-meta ad-cd-meta">
          {[owner ? `Created by ${nameOf(owner)}` : "", created].filter(Boolean).join(" · ")}
        </p>

        {editing ? (
          <div className="ad-cd-edit">
            <label>
              <span>Name</span>
              <input value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label>
              <span>Description</span>
              <textarea rows={3} value={form.description} maxLength={160} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label>
              <span>Topic</span>
              <select value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}>
                {uniq([form.tag, ...COMMUNITY_TAGS]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className="ad-modal-actions">
              <button type="button" className="ad-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button type="button" className="ad-btn primary" onClick={saveInfo} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        ) : (
          <div className="ad-cd-actions">
            <button type="button" className="ad-btn small" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" /><span>Edit info</span>
            </button>
            {c.code && (
              <button type="button" className="ad-btn small" onClick={copyCode}>
                <Copy size={14} aria-hidden="true" /><span>Invite code</span>
              </button>
            )}
            <button type="button" className="ad-btn small" onClick={askVisibility}>
              {c.visibility === "private" ? "Make public" : "Make private"}
            </button>
            {(c.pinned || []).length > 0 && (
              <button type="button" className="ad-btn small" onClick={askClearPins}>Clear pins</button>
            )}
            {c.deleted ? (
              <button type="button" className="ad-btn small" onClick={() => onRestore(c.id)}>Restore</button>
            ) : (
              <button type="button" className="ad-btn small danger" onClick={() => onUnlist(c.id, c.name)}>Unlist</button>
            )}
          </div>
        )}

        <div className="ad-cd-people">
          <div className="ad-cd-people-head">
            <h3>People</h3>
            <div className="ad-chips" role="group" aria-label="Show">
              {[["all", "All"], ["admin", "Admins"], ["member", "Members"], ["banned", "Banned"]].map(([k, l]) => (
                <button key={k} type="button" className={`ad-chip ${role === k ? "active" : ""}`} onClick={() => setRole(k)}>{l}</button>
              ))}
            </div>
          </div>
          <label className="ad-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
          </label>

          {loading && !rows.length ? (
            <p className="ad-panel-note">Loading people…</p>
          ) : rows.length === 0 ? (
            <p className="ad-panel-note">{term ? "No one matches." : role === "banned" ? "No one is banned here." : "No one here yet."}</p>
          ) : (
            <ul className="ad-people">
              {rows.map((id) => {
                const u = people[id] || {};
                const r = roleOf(id);
                const isOpen = open === id;
                const protectedUser = id === owner || ADMIN_UIDS.includes(id) || id === me;
                return (
                  <li key={id} className={isOpen ? "open" : ""}>
                    <button type="button" className="ad-person" onClick={() => setOpen(isOpen ? "" : id)} aria-expanded={isOpen}>
                      <span className="ad-avatar">
                        {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : firstLetter(nameOf(id))}
                      </span>
                      <span className="ad-person-main">
                        <span className="ad-person-name">{nameOf(id)}</span>
                        <span className="ad-meta">{u.email || id}</span>
                      </span>
                      <span className={`ad-badge ${r === "owner" ? "gold" : r === "admin" ? "blue" : r === "banned" ? "red" : ""}`}>
                        {r === "owner" ? "Owner" : r === "admin" ? "Admin" : r === "banned" ? "Banned" : "Member"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="ad-person-actions">
                        {r === "banned" ? (
                          <button type="button" className="ad-btn small" onClick={() => unbanMember(id)}>Lift ban</button>
                        ) : r === "owner" ? (
                          <span className="ad-meta">The creator can't be changed here.</span>
                        ) : (
                          <>
                            {r === "admin" ? (
                              <button type="button" className="ad-btn small" onClick={() => removeAdmin(id)}>Remove admin</button>
                            ) : (
                              <button type="button" className="ad-btn small" onClick={() => makeAdmin(id)}>Make admin</button>
                            )}
                            {!protectedUser && (
                              <>
                                <button type="button" className="ad-btn small danger" onClick={() => askRemove(id)}>Remove</button>
                                <button type="button" className="ad-btn small danger" onClick={() => askBan(id)}>Ban from circle</button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ---------- Visits tab ---------- */

function countryName(code) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}
function flagOf(code) {
  if (!/^[A-Z]{2}$/.test(code || "")) return "🌐";
  return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

const PLATFORM_LABEL = { app: "iPhone app", phone: "Phone browser", pc: "Computer" };

function VisitsPanel({ stats: v, busy, error, users, onRefresh }) {
  const nameFor = (uid) => {
    const u = users.find((x) => x.id === uid);
    return u?.displayName || u?.name || "Signed in";
  };
  const maxPages = Math.max(1, ...v.pages.map((x) => x.views));
  const maxRefs = Math.max(1, ...v.refs.map((x) => x.views));
  const maxPlat = Math.max(1, ...v.platforms.map((x) => x.people));
  const maxCountry = Math.max(1, ...v.countries.map((x) => x.people));

  return (
    <div className="ad-analytics">
      {error ? (
        <div className="ad-alert" role="alert">{error}</div>
      ) : !v.hasData && !busy ? (
        <div className="ad-infobox">
          No visits recorded yet. Counting starts once the new version of the site is live, and this page fills in from that day.
        </div>
      ) : null}

      <section className="ad-kpis" aria-label="Visitors">
        <div className="ad-kpi">
          <span className="ad-kpi-label">Visitors today</span>
          <span className="ad-kpi-value">{v.today}</span>
          <span className="ad-kpi-hint">{v.live} in the last 30 minutes</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Last 7 days</span>
          <span className="ad-kpi-value">{v.week}</span>
          <Delta cur={v.week} prev={v.prevWeek} />
          <span className="ad-kpi-hint">{v.views7} page views</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Last 30 days</span>
          <span className="ad-kpi-value">{v.month}</span>
          <span className="ad-kpi-hint">{v.views} page views</span>
        </div>
        <div className="ad-kpi">
          <span className="ad-kpi-label">Came back</span>
          <span className="ad-kpi-value">{v.month ? `${Math.round((v.returning / v.month) * 100)}%` : "–"}</span>
          <span className="ad-kpi-hint">{v.returning} of {v.month} visited on more than one day</span>
        </div>
      </section>

      <section className="ad-panel">
        <header>
          <h3>Visitors per day</h3>
          <span>
            Last 30 days
            <button type="button" className="ad-btn small" onClick={onRefresh} disabled={busy}>
              <RefreshCw size={14} className={busy ? "ad-spin" : ""} aria-hidden="true" />
              <span>{busy ? "Loading" : "Refresh"}</span>
            </button>
          </span>
        </header>
        <BarChart days={v.days} values={v.daily} label="Visitors per day, last 30 days" />
      </section>

      <div className="ad-two">
        <section className="ad-panel">
          <header><h3>Top pages</h3><span>Page views</span></header>
          <ul className="ad-funnel">
            {v.pages.map((p) => (
              <li key={p.id} className="ad-funnel-row">
                <div className="ad-funnel-top"><span className="ad-trunc">{p.id}</span><span><strong>{p.views}</strong> · {p.people} people</span></div>
                <div className="ad-funnel-bar"><span style={{ width: `${(p.views / maxPages) * 100}%` }} /></div>
              </li>
            ))}
            {!v.pages.length && <li className="ad-panel-note">Nothing yet.</li>}
          </ul>
        </section>
        <section className="ad-panel">
          <header><h3>Where they come from</h3><span>Add ?ref=name to a link to tag it</span></header>
          <ul className="ad-funnel">
            {v.refs.map((p) => (
              <li key={p.id} className="ad-funnel-row">
                <div className="ad-funnel-top"><span className="ad-trunc">{p.id === "direct" ? "Direct or unknown" : p.id}</span><span><strong>{p.people}</strong> people</span></div>
                <div className="ad-funnel-bar"><span style={{ width: `${(p.views / maxRefs) * 100}%` }} /></div>
              </li>
            ))}
            {!v.refs.length && <li className="ad-panel-note">Nothing yet.</li>}
          </ul>
        </section>
      </div>

      <section className="ad-panel">
        <header><h3>Countries</h3><span>People, last 30 days</span></header>
        <ul className="ad-funnel">
          {v.countries.map((p) => (
            <li key={p.id || "unknown"} className="ad-funnel-row">
              <div className="ad-funnel-top">
                <span>{flagOf(p.id)} {countryName(p.id)}</span>
                <span><strong>{p.people}</strong> · {v.month ? Math.round((p.people / v.month) * 100) : 0}%</span>
              </div>
              <div className="ad-funnel-bar"><span style={{ width: `${(p.people / maxCountry) * 100}%` }} /></div>
            </li>
          ))}
          {!v.countries.length && <li className="ad-panel-note">Nothing yet.</li>}
        </ul>
      </section>

      <div className="ad-two">
        <section className="ad-panel">
          <header><h3>Devices</h3><span>People, last 30 days</span></header>
          <ul className="ad-funnel">
            {v.platforms.map((p) => (
              <li key={p.id} className="ad-funnel-row">
                <div className="ad-funnel-top"><span>{PLATFORM_LABEL[p.id] || p.id}</span><span><strong>{p.people}</strong></span></div>
                <div className="ad-funnel-bar"><span style={{ width: `${(p.people / maxPlat) * 100}%` }} /></div>
              </li>
            ))}
            {!v.platforms.length && <li className="ad-panel-note">Nothing yet.</li>}
          </ul>
        </section>
        <section className="ad-panel">
          <header><h3>Who they are</h3><span>Last 30 days</span></header>
          <ul className="ad-funnel">
            <li className="ad-funnel-row">
              <div className="ad-funnel-top"><span>Signed in</span><span><strong>{v.signedIn}</strong></span></div>
              <div className="ad-funnel-bar"><span style={{ width: `${v.month ? (v.signedIn / v.month) * 100 : 0}%` }} /></div>
            </li>
            <li className="ad-funnel-row">
              <div className="ad-funnel-top"><span>Guests (not signed in)</span><span><strong>{v.guests}</strong></span></div>
              <div className="ad-funnel-bar"><span style={{ width: `${v.month ? (v.guests / v.month) * 100 : 0}%` }} /></div>
            </li>
            <li className="ad-funnel-row">
              <div className="ad-funnel-top"><span>First visit</span><span><strong>{v.fresh}</strong></span></div>
              <div className="ad-funnel-bar"><span style={{ width: `${v.month ? (v.fresh / v.month) * 100 : 0}%` }} /></div>
            </li>
          </ul>
        </section>
      </div>

      <section className="ad-panel">
        <header><h3>Latest visits</h3><span>Newest first</span></header>
        <table className="ad-table">
          <thead>
            <tr><th>When</th><th>Page</th><th>From</th><th>Device</th><th>Who</th></tr>
          </thead>
          <tbody>
            {v.recent.map((r, i) => (
              <tr key={`${r.vid}-${r.ms}-${i}`}>
                <td>{ago(r.ms)}</td>
                <td className="ad-trunc">{r.path}</td>
                <td className="ad-trunc">{r.ref === "direct" ? "Direct" : r.ref}</td>
                <td>{PLATFORM_LABEL[r.platform] || r.platform}</td>
                <td className="ad-trunc">{r.uid ? nameFor(r.uid) : "Guest"}</td>
              </tr>
            ))}
            {!v.recent.length && <tr><td colSpan={5}>No visits yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <p className="ad-foot">Visitors are anonymous. Days are in UTC. Your own visits are not counted.</p>
    </div>
  );
}
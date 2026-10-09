// src/pages/Community.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community.css";
import {
  COMMUNITY_TAGS,
  createCommunity,
  listPublicCommunities,
  listMyCommunities,
  joinCommunityByCode,
} from "../lib/communities";

const isUnlimitedPlan = (plan) => plan === "unlimited" || plan === "premium";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function Avatar({ c, size = "md" }) {
  const initial = (c.name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      className={`cx-avatar cx-avatar-${size}`}
      style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}
      aria-hidden="true"
    >
      {!c.photoUrl && initial}
    </span>
  );
}

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [list, setList] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [name, setName] = useState("");
  const [newTag, setNewTag] = useState("Math");
  const [visibility, setVisibility] = useState("public");
  const [role, setRole] = useState("student");
  const [saving, setSaving] = useState(false);

  const load = async (selectedTag = tag) => {
    setLoading(true);
    try {
      const [rows, own] = await Promise.all([
        listPublicCommunities(selectedTag),
        user?.uid ? listMyCommunities(user.uid) : Promise.resolve([]),
      ]);
      setList(rows);
      setMine(own);
    } catch (err) {
      console.error(err);
      toast.error("Could not load circles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, [user?.uid]);

  // Close the create dialog with Escape and lock page scroll while it is open
  useEffect(() => {
    if (!showCreate) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) setShowCreate(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showCreate, saving]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [list, search]);

  const hostedCount = mine.filter((c) => c.createdBy === user?.uid).length;
  const unlimited = isUnlimitedPlan(user?.plan);

  const handleJoinCode = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to join a circle");
      navigate("/login");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.warning("Enter the invite code");
      return;
    }
    setJoining(true);
    try {
      const community = await joinCommunityByCode(code, user.uid);
      toast.success("Joined circle");
      setJoinCode("");
      navigate(`/community/${community.id}`);
    } catch (err) {
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to create a circle");
      navigate("/login");
      return;
    }
    if (!isUnlimitedPlan(user.plan) && hostedCount >= 1) {
      toast.info("Free accounts can create 1 circle. Upgrade to create more.");
      setShowUpgradeModal(true);
      return;
    }
    setSaving(true);
    try {
      const created = await createCommunity({
        name,
        tag: newTag,
        visibility,
        role,
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split("@")[0] || "Member",
      });
      toast.success("Circle created");
      setShowCreate(false);
      setName("");
      navigate(`/community/${created.id}`);
    } catch (err) {
      toast.error(err.message || "Could not create circle");
    } finally {
      setSaving(false);
    }
  };

  const memberLabel = (c) => {
    const n = c.memberCount || 1;
    return `${n} ${n === 1 ? "member" : "members"}`;
  };

  const renderCard = (c) => (
    <button
      key={c.id}
      type="button"
      className="cx-card"
      onClick={() => navigate(`/community/${c.id}`)}
    >
      <div className="cx-card-top">
        <Avatar c={c} size="lg" />
        {c.visibility === "private" && (
          <span className="cx-card-lock" title="Private">
            <LockIcon />
          </span>
        )}
      </div>
      <div className="cx-card-body">
        <strong className="cx-card-name">{c.name}</strong>
        <div className="cx-card-meta">
          <span className="cx-pill">{c.tag}</span>
          <span className="cx-members">
            <UsersIcon />
            {memberLabel(c)}
          </span>
        </div>
      </div>
    </button>
  );

  const skeletons = Array.from({ length: 8 }, (_, i) => (
    <div key={i} className="cx-card cx-skeleton" aria-hidden="true">
      <div className="cx-card-top">
        <span className="cx-avatar cx-avatar-lg" />
      </div>
      <div className="cx-card-body">
        <span className="cx-sk-line cx-sk-wide" />
        <span className="cx-sk-line cx-sk-short" />
      </div>
    </div>
  ));

  const noResultsBecauseSearch = !loading && visible.length === 0 && search.trim() && list.length > 0;

  return (
    <div className="hub-page cx-page">
      <header className="cx-header">
        <div className="cx-header-copy">
          <h1 className="cx-title">Circles</h1>
          <p className="cx-sub">Study with others. Join a public circle or start your own.</p>
        </div>
        <div className="cx-header-actions">
          <button type="button" className="cx-btn cx-btn-primary" onClick={() => setShowCreate(true)}>
            <PlusIcon /> Create circle
          </button>
          {user && !unlimited && (
            <span className="cx-quota">{Math.min(hostedCount, 1)} of 1 free circles created</span>
          )}
        </div>
      </header>

      <div className="cx-toolbar">
        <div className="cx-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search public circles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search public circles"
          />
        </div>

        <div className="cx-join">
          {!showJoin ? (
            <button type="button" className="cx-link" onClick={() => setShowJoin(true)}>
              Have an invite code?
            </button>
          ) : (
            <form className="cx-join-form" onSubmit={handleJoinCode}>
              <input
                placeholder="Invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                aria-label="Invite code"
                autoFocus
              />
              <button type="submit" className="cx-btn cx-btn-primary" disabled={joining}>
                {joining ? "Joining…" : "Join"}
              </button>
              <button
                type="button"
                className="cx-btn cx-btn-ghost"
                onClick={() => {
                  setShowJoin(false);
                  setJoinCode("");
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {mine.length > 0 && (
        <section className="cx-section">
          <div className="cx-section-head">
            <h2 className="cx-section-title">Your circles</h2>
            <span className="cx-section-count">{mine.length}</span>
          </div>
          <div className="cx-grid">{mine.map(renderCard)}</div>
        </section>
      )}

      <section className="cx-section">
        <div className="cx-section-head">
          <h2 className="cx-section-title">Discover</h2>
        </div>

        <div className="cx-tags" role="group" aria-label="Filter by subject">
          <button
            type="button"
            className={!tag ? "cx-tag on" : "cx-tag"}
            onClick={() => {
              setTag("");
              load("");
            }}
          >
            All
          </button>
          {COMMUNITY_TAGS.map((item) => (
            <button
              key={item}
              type="button"
              className={tag === item ? "cx-tag on" : "cx-tag"}
              onClick={() => {
                setTag(item);
                load(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="cx-grid">{skeletons}</div>
        ) : visible.length === 0 ? (
          <div className="cx-empty">
            <div className="cx-empty-icon">○</div>
            <h3>{noResultsBecauseSearch ? "No circles match your search" : "No public circles yet"}</h3>
            <p>
              {noResultsBecauseSearch
                ? "Try a different name, or clear the search."
                : tag
                ? `Nobody has started a ${tag} circle yet. You could be the first.`
                : "Start the first one and invite others to join."}
            </p>
            {noResultsBecauseSearch ? (
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setSearch("")}>
                Clear search
              </button>
            ) : (
              <button type="button" className="cx-btn cx-btn-primary" onClick={() => setShowCreate(true)}>
                <PlusIcon /> Create circle
              </button>
            )}
          </div>
        ) : (
          <div className="cx-grid">{visible.map(renderCard)}</div>
        )}
      </section>

      {showCreate && (
        <div
          className="cx-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setShowCreate(false);
          }}
        >
          <form
            className="cx-dialog"
            onSubmit={handleCreate}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cx-create-title"
          >
            <div className="cx-dialog-head">
              <h2 id="cx-create-title">Create circle</h2>
              <button
                type="button"
                className="cx-close"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
                disabled={saving}
              >
                ×
              </button>
            </div>

            <label className="cx-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AP Calculus"
                maxLength={60}
                required
                autoFocus
              />
            </label>

            <label className="cx-field">
              <span>Subject</span>
              <select value={newTag} onChange={(e) => setNewTag(e.target.value)} required>
                {COMMUNITY_TAGS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="cx-field">
              <span>Who can find it</span>
              <div className="cx-seg" role="radiogroup" aria-label="Visibility">
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "public"}
                  className={visibility === "public" ? "on" : ""}
                  onClick={() => setVisibility("public")}
                >
                  Public
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "private"}
                  className={visibility === "private" ? "on" : ""}
                  onClick={() => setVisibility("private")}
                >
                  Private
                </button>
              </div>
              <small>
                {visibility === "public"
                  ? "Listed and searchable by everyone."
                  : "Invite only. Members join with a code."}
              </small>
            </div>

            <div className="cx-field">
              <span>Your role</span>
              <div className="cx-seg" role="radiogroup" aria-label="Your role">
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === "student"}
                  className={role === "student" ? "on" : ""}
                  onClick={() => setRole("student")}
                >
                  Student
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === "tutor"}
                  className={role === "tutor" ? "on" : ""}
                  onClick={() => setRole("tutor")}
                >
                  Tutor / teacher
                </button>
              </div>
            </div>

            <div className="cx-dialog-actions">
              <button
                type="button"
                className="cx-btn cx-btn-ghost"
                onClick={() => setShowCreate(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="cx-btn cx-btn-primary" disabled={saving || !name.trim()}>
                {saving ? "Creating…" : "Create circle"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
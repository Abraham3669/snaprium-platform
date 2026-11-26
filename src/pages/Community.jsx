// src/pages/Community.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community.css";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { circleCardPath, circleChatPath, rememberCircle } from "../lib/circleNav";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import {
  COMMUNITY_TAGS,
  COMMUNITY_DESC_MAX,
  createCommunity,
  listPublicCommunities,
  listMyCommunities,
  joinCommunity,
  joinCommunityByCode,
  countCommunityUnread,
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

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3M16 7l3 3" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

// A circle without a cover picture gets a calm colour made from its name.
function hueOf(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

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
  const [description, setDescription] = useState("");
  const [newTag, setNewTag] = useState("Math");
  const [visibility, setVisibility] = useState("public");
  const [saving, setSaving] = useState(false);

  const [unread, setUnread] = useState({});
  const [joiningId, setJoiningId] = useState("");

  const load = async (selectedTag = tag) => {
    setLoading(true);
    try {
      const [rows, own] = await Promise.all([
        listPublicCommunities(selectedTag),
        user?.uid ? listMyCommunities(user.uid) : Promise.resolve([]),
      ]);
      setList(rows);
setMine(own);
if (user?.uid && own.length) {
  const pairs = await Promise.all(
    own.map(async (c) => [c.id, await countCommunityUnread(c.id, user.uid)])
  );
  setUnread(Object.fromEntries(pairs));
} else {
  setUnread({});
}
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


   useEffect(() => {
  if (!user?.uid || !mine.length) return;
  const unsubs = mine.map((c) =>
    onSnapshot(
      query(collection(db, "communities", c.id, "messages"), orderBy("createdAt", "desc"), limit(1)),
      async () => {
        const n = await countCommunityUnread(c.id, user.uid);
        setUnread((prev) => ({ ...prev, [c.id]: n }));
      }
    )
  );
  return () => unsubs.forEach((u) => u());
}, [mine, user?.uid]);





  

  // /community?create=1 opens the create dialog (the "Create a circle" row in the chat switcher)
  useEffect(() => {
    if (params.get("create") !== "1") return;
    if (!user) {
      toast.info("Sign in to create a circle");
      navigate("/login", { replace: true });
      return;
    }
    setShowCreate(true);
    setParams({}, { replace: true });
  }, [params, user, navigate, setParams]);

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
    return list.filter((c) => `${c.name || ""} ${c.description || ""}`.toLowerCase().includes(q));
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
      sessionStorage.setItem(`circle-welcome:${community.id}`, "1");
      rememberCircle(user.uid, community.id);
      navigate(circleChatPath(community.id));
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
    if (description.trim() && !isClean(description)) {
      toast.error(FILTER_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const created = await createCommunity({
        name,
        description,
        tag: newTag,
        visibility,
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split("@")[0] || "Member",
      });
      toast.success("Circle created");
      setShowCreate(false);
      setName("");
      setDescription("");
      rememberCircle(user.uid, created.id);
      navigate(circleChatPath(created.id));
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

  const myIds = useMemo(() => new Set(mine.map((c) => c.id)), [mine]);

  const openCard = (c) => {
    const member = myIds.has(c.id);
    if (member) rememberCircle(user?.uid, c.id);
    navigate(circleCardPath(c, member));
  };

  // "Join" on a card: join, then go straight into the circle's chat (the welcome card shows there).
  const joinFromCard = async (c) => {
    if (!user) {
      toast.info("Sign in to join a circle");
      navigate("/login");
      return;
    }
    setJoiningId(c.id);
    try {
      await joinCommunity(c.id, user.uid);
      sessionStorage.setItem(`circle-welcome:${c.id}`, "1");
      rememberCircle(user.uid, c.id);
      navigate(circleChatPath(c.id));
    } catch (err) {
      toast.error(err.message || "Could not join");
    } finally {
      setJoiningId("");
    }
  };

  const renderCard = (c, showBadge = false) => {
    const member = myIds.has(c.id);
    const n = showBadge ? unread[c.id] || 0 : 0;
    const initial = (c.name || "?").trim().charAt(0).toUpperCase();
    return (
      <article
        key={c.id}
        className="cx-card cx-c"
        role="link"
        tabIndex={0}
        onClick={() => openCard(c)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openCard(c);
          }
        }}
      >
        <div
          className={`cx-c-banner ${c.coverUrl ? "has-img" : ""}`}
          style={c.coverUrl ? { backgroundImage: `url(${c.coverUrl})` } : { "--h": hueOf(c.name) }}
        >
          {n > 0 && <span className="cx-badge">{n > 9 ? "9+" : n}</span>}
          {c.visibility === "private" && (
            <span className="cx-card-lock" title="Private">
              <LockIcon />
            </span>
          )}
        </div>
        <div className="cx-c-body">
          <span
            className="cx-c-avatar"
            style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}
            aria-hidden="true"
          >
            {!c.photoUrl && initial}
          </span>
          <strong className="cx-card-name">{c.name}</strong>
          {c.description && <p className="cx-card-desc">{c.description}</p>}
          <div className="cx-card-meta">
            <span className="cx-pill">{c.tag}</span>
            <span className="cx-members">
              <UsersIcon />
              {memberLabel(c)}
            </span>
          </div>
          <button
            type="button"
            className={member ? "cx-btn cx-btn-ghost cx-c-act" : "cx-btn cx-btn-primary cx-c-act"}
            disabled={joiningId === c.id}
            onClick={(e) => {
              e.stopPropagation();
              if (member) openCard(c);
              else joinFromCard(c);
            }}
          >
            {member ? "Open" : joiningId === c.id ? "Joining…" : "Join"}
          </button>
        </div>
      </article>
    );
  };

  const skeletons = Array.from({ length: 8 }, (_, i) => (
    <div key={i} className="cx-card cx-c cx-skeleton" aria-hidden="true">
      <div className="cx-c-banner cx-sk-line" />
      <div className="cx-c-body">
        <span className="cx-c-avatar cx-sk-line" />
        <span className="cx-sk-line cx-sk-wide" />
        <span className="cx-sk-line cx-sk-short" />
      </div>
    </div>
  ));

  const noResultsBecauseSearch = !loading && visible.length === 0 && search.trim() && list.length > 0;

  return (
    <div className="hub-page cx-page">
      <button type="button" className="cx-back" onClick={() => navigate("/")}>
        <BackIcon /> Home
      </button>
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
              <KeyIcon /> Have an invite code?
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
          <div className="cx-grid">{mine.map((c) => renderCard(c, true))}</div>
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
                placeholder="e.g. Linear algebra study group"
                maxLength={60}
                required
                autoFocus
              />
            </label>

            <label className="cx-field">
              <span>Description <em className="cx-opt">(optional)</em></span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this circle about, and who is it for?"
                maxLength={COMMUNITY_DESC_MAX}
                rows={3}
              />
              <small className="cx-counter">{description.length}/{COMMUNITY_DESC_MAX}</small>
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
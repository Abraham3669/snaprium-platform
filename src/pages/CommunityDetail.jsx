// src/pages/CommunityDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community-detail.css";

import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";




import {
  getCommunity,
  joinCommunity,
  leaveCommunity,
  unlistCommunity,
  updateCommunityMedia,
  ensureCommunityCode,
  listBoards,
  createBoard,
  deleteBoard,
  isDefaultBoard,
reportCommunity,
FREE_BOARD_LIMIT,
countBoardUnread,
} from "../lib/communities";

const isUnlimitedPlan = (plan) => plan === "unlimited" || plan === "premium";

function uniqueBoards(rows) {
  const seen = new Set();
  return (rows || []).filter((b) => {
    const key = b.slug || b.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compressImage(file, max = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0z" />
    </svg>
  );
}

function IconQuestions() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2l-2.5-2H12" strokeLinejoin="round" />
      <path d="M4 9h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3 2v-2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSession() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10l7-3v10l-7-3z" strokeLinejoin="round" />
    </svg>
  );
}
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
    </svg>
  );
}
function IconCommunityMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.4 4 5.5 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.5-4-9s1.4-6.6 4-9z" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5a6 6 0 0 1 3 5.5" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

// one-line description under each board name
function boardBlurb(board) {
  const slug = String(board.slug || "").toLowerCase();
  const name = String(board.name || "").toLowerCase();
  if (slug === "questions" || name === "questions" || board.kind === "questions") {
    return "Post a problem and get help";
  }
  if (slug === "session" || name === "session" || name === "live") {
    return "Live study with video";
  }
  if (slug === "general" || name === "general") return "Chat with the circle";
  return "";
}

export default function CommunityDetail() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const bannerRef = useRef(null);
  const photoRef = useRef(null);

  const [community, setCommunity] = useState(null);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newBoard, setNewBoard] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [boardUnread, setBoardUnread] = useState({ chat: 0, questions: 0 });
  const [welcome, setWelcome] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getCommunity(communityId);
        setCommunity(data);
        if (data) {
          try {
            setBoards(uniqueBoards(await listBoards(data.id)));
          } catch {
            setBoards([]);
          }
          if (
            !data.code &&
            user?.uid &&
            (data.createdBy === user.uid || (data.admins || []).includes(user.uid))
          ) {
            try {
              setCommunity(await ensureCommunityCode(data.id));
            } catch {}
          }
        }
      } catch {
        toast.error("Could not open circle");
      } finally {
        setLoading(false);
      }
    })();
 }, [communityId, user?.uid]);

useEffect(() => {
  if (!community?.id || !user?.uid) return;
  if (sessionStorage.getItem(`circle-welcome:${community.id}`) === "1") {
    setWelcome(true);
  }
}, [community?.id, user?.uid]);


  



  useEffect(() => {
  if (!user?.uid || !community || !(community.members || []).includes(user.uid)) return;
  const refresh = () => {
    countBoardUnread(community.id, user.uid).then(setBoardUnread).catch(() => {});
  };
  refresh();
  const unsubChat = onSnapshot(
    query(collection(db, "communities", community.id, "messages"), orderBy("createdAt", "desc"), limit(1)),
    refresh
  );
  const qBoard = boards.find(
    (b) => b.slug === "questions" || b.kind === "questions" || String(b.name || "").toLowerCase() === "questions"
  );
  const unsubQuestions = qBoard
    ? onSnapshot(collection(db, "communities", community.id, "boards", qBoard.id, "questions"), refresh)
    : () => {};
  return () => {
    unsubChat();
    unsubQuestions();
  };
}, [community, user?.uid, boards]);





  // close the "more" menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (loading) {
    return <div className="cd-page"><p className="cd-muted">Loading circle…</p></div>;
  }

  if (!community || community.deleted) {
    return (
      <div className="cd-page">
        <h1 className="cd-title">Circle unavailable</h1>
        <button type="button" className="cd-btn" onClick={() => navigate("/community")}>Back</button>
      </div>
    );
  }

  const isMember = user && (community.members || []).includes(user.uid);
  const isAdmin = user && (community.createdBy === user.uid || (community.admins || []).includes(user.uid));
  const paid = isUnlimitedPlan(user?.plan);




  const openBoard = async (board) => {
    if (!user) return navigate("/login");
    if (!isMember) {
      try {
       await joinCommunity(community.id, user.uid);
sessionStorage.setItem(`circle-welcome:${community.id}`, "1");
setWelcome(true);
      } catch (err) {
        toast.error(err.message || "Join first");
        return;
      }
    }
    navigate(`/community/${community.id}/chat?board=${board.id}`);
  };

  const onUpload = async (file, field) => {
    if (!file || !isAdmin) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, field === "coverUrl" ? 1200 : 400, 0.68);
      setCommunity(await updateCommunityMedia(community.id, { [field]: dataUrl }));
    } catch (err) {
      toast.error(err.message || "Could not update image");
    } finally {
      setBusy(false);
    }
  };

  const handleAddBoard = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!paid && boards.length >= FREE_BOARD_LIMIT) {
      setShowUpgradeModal(true);
      return;
    }
    setBusy(true);
    try {
      const row = await createBoard(community.id, { name: newBoard }, { isPaid: paid });
           setBoards(uniqueBoards(await listBoards(community.id)));
      setNewBoard("");
      toast.success(`${row.name} added`);
    } catch (err) {
      toast.error(err.message || "Could not add board");
    } finally {
      setBusy(false);
    }
  };



  const handleDeleteBoard = async (board) => {
    if (!isAdmin || isDefaultBoard(board)) return;
    if (!window.confirm(`Delete "${board.name}"? Messages in it will still exist but the board will be gone.`)) return;
    setBusy(true);
    try {
      await deleteBoard(community.id, board);
      setBoards(uniqueBoards(await listBoards(community.id)));
      toast.success("Board deleted");
    } catch (err) {
      toast.error(err.message || "Could not delete board");
    } finally {
      setBusy(false);
    }
  };



  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(community.code);
      toast.success(`Code ${community.code} copied`);
    } catch {
      window.prompt("Copy code", community.code);
    }
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/community/${community.id}`;
    const text = community.code ? `${link}\nCode: ${community.code}` : link;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else window.prompt("Copy invite", text);
      toast.success(community.code ? `Copied. Code ${community.code}` : "Invite copied");
    } catch {
      window.prompt("Copy invite", text);
    }
  };

  return (
    <div className="cd-page">
      <button type="button" className="cd-back" onClick={() => navigate("/community")}>← Circles</button>

      <button
  type="button"
  className={`cd-banner ${community.coverUrl ? "" : "empty"}`}
  style={community.coverUrl ? { backgroundImage: `url(${community.coverUrl})` } : undefined}
  onClick={() => isAdmin && bannerRef.current?.click()}
  disabled={!isAdmin || busy}
  aria-label="Change banner"
>
  {isAdmin && (
    <span className="cd-banner-edit">
      <IconCamera /> {community.coverUrl ? "Change cover" : "Add cover"}
    </span>
  )}
  {isMember && boardUnread.questions > 0 && (
    <span className="cd-banner-badge">{boardUnread.questions > 9 ? "9+" : boardUnread.questions}</span>
  )}
</button>

      <div className="cd-identity">
        <button
          type="button"
          className="cd-avatar"
          style={community.photoUrl ? { backgroundImage: `url(${community.photoUrl})` } : undefined}
          onClick={() => isAdmin && photoRef.current?.click()}
          disabled={!isAdmin || busy}
          aria-label="Change photo"
        >
          {!community.photoUrl && (community.name?.trim()?.[0]?.toUpperCase() || <IconCommunityMark />)}
          {isAdmin && <span className="cd-avatar-edit"><IconCamera /></span>}
        </button>
        <div className="cd-identity-text">
          <h1 className="cd-title">{community.name}</h1>
          <div className="cd-meta-row">
            {community.tag && <span className="cd-chip accent">{community.tag}</span>}
            <span className="cd-chip">
              <IconUsers /> {community.memberCount || 1} {(community.memberCount || 1) === 1 ? "member" : "members"}
            </span>
            {community.role === "tutor" && <span className="cd-chip">Tutor</span>}
            <span className="cd-chip">
              {community.visibility === "private" ? <><IconLock /> Private</> : "Public"}
            </span>
            {community.code && (
              <button type="button" className="cd-chip code" onClick={copyCode} title="Copy code">
                Code {community.code} <IconCopy />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cd-actions">
        {!isMember && (
          <button type="button" className="cd-action primary" disabled={busy} onClick={async () => {
            if (!user) return navigate("/login");
            setBusy(true);
            try {
              await joinCommunity(community.id, user.uid);
sessionStorage.setItem(`circle-welcome:${community.id}`, "1");
setWelcome(true);
setCommunity(await getCommunity(community.id));
            } catch (err) {
              toast.error(err.message || "Could not join");
            } finally {
              setBusy(false);
            }
          }}>Join</button>
        )}
        <button type="button" className="cd-action" onClick={copyInvite}>
          <IconLink /> Invite
        </button>


       
     
             {user && (
          <div className="cd-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="cd-action icon"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <IconMore />
            </button>
            {menuOpen && (
              <div className="cd-menu" role="menu" onClick={() => setMenuOpen(false)}>
        {user && (
          <button
            type="button"
            className="cd-menu-item"
            disabled={busy}
            onClick={async () => {
              const reason = window.prompt("Why are you reporting this circle?");
              if (!reason?.trim()) return;
              setBusy(true);
              try {
                await reportCommunity({
                  communityId: community.id,
                  communityName: community.name,
                  reporterId: user.uid,
                  reason: reason.trim(),
                });
                toast.success("Report sent to Snaprium");
              } catch {
                toast.error("Could not send report");
              } finally {
                setBusy(false);
              }
            }}
          >
            Report
          </button>
        )}





        {isMember && !isAdmin && (
          <button
            type="button"
            className="cd-menu-item"
            onClick={async () => {
              try {
                await leaveCommunity(community.id, user.uid);
                navigate("/community");
              } catch (err) {
                toast.error(err.message || "Could not leave");
              }
            }}
          >
            Leave
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className="cd-menu-item danger"
            onClick={async () => {
              if (!window.confirm("Remove this circle for everyone?")) return;
              try {
                await unlistCommunity(community.id);
                navigate("/community");
              } catch (err) {
                toast.error(err.message || "Could not delete");
              }
            }}
          >
            Delete circle
          </button>
        )}
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="cd-section-title">Boards</h2>
<div className="cd-board-list">
  {boards.map((board) => (
    <div key={board.id} className="cd-board-row">
      <button type="button" className="cd-board" onClick={() => openBoard(board)}>
                {(() => {
          const slug = String(board.slug || "").toLowerCase();
          const name = String(board.name || "").toLowerCase();
          const isQ =
            slug === "questions" || name === "questions" || board.kind === "questions";
          const isS =
            slug === "session" || name === "session" || name === "live";
          return (
            <span className={`cd-board-mark ${isQ ? "questions" : ""} ${isS ? "session" : ""}`}>
              {isQ ? <IconQuestions /> : isS ? <IconSession /> : <IconChat />}
            </span>
          );
        })()}
        <span className="cd-board-text">
          <span className="cd-board-name">{board.name}</span>
          {boardBlurb(board) && <span className="cd-board-blurb">{boardBlurb(board)}</span>}
        </span>
{(() => {
  const slug = String(board.slug || "").toLowerCase();
  const name = String(board.name || "").toLowerCase();
  const kind =
    slug === "questions" || name === "questions" || board.kind === "questions"
      ? "questions"
      : slug === "session" || name === "session" || name === "live"
      ? ""
      : "chat";
  const n = kind ? boardUnread[kind] || 0 : 0;
  return n > 0 ? <span className="cd-badge">{n > 9 ? "9+" : n}</span> : null;
})()}
<span className="cd-board-go"><IconChevron /></span>
      </button>
      {isAdmin && !isDefaultBoard(board) && (
        <button
          type="button"
          className="cd-board-delete"
          disabled={busy}
          onClick={() => handleDeleteBoard(board)}
          aria-label={`Delete ${board.name}`}
        >
          ×
        </button>
      )}
    </div>
  ))}
</div>

      {isAdmin && (
        <form className="cd-addboard" onSubmit={handleAddBoard}>
          <input
            value={newBoard}
            onChange={(e) => setNewBoard(e.target.value)}
            placeholder="New board name"
            maxLength={40}
            className="cd-input"
          />
          <button type="submit" className="cd-action primary" disabled={busy || !newBoard.trim()}>
            Add board
          </button>
        </form>
      )}

      <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "coverUrl"); }} />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "photoUrl"); }} />

{welcome && (
  <div className="cd-welcome" onClick={() => {
    sessionStorage.removeItem(`circle-welcome:${community.id}`);
    setWelcome(false);
  }}>
    <div className="cd-welcome-card" onClick={(e) => e.stopPropagation()}>
      <span className="cd-welcome-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.4 2.4L16.5 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="cd-welcome-kicker">You’re in</p>
      <h2>Welcome to {community.name}</h2>
      <p>General is for chat. Questions is for posts you can reply to. Session is for live study.</p>
      <button type="button" onClick={() => {
        sessionStorage.removeItem(`circle-welcome:${community.id}`);
        setWelcome(false);
      }}>Continue</button>
    </div>
  </div>
)}




      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
// src/pages/CommunityDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import "../styles/community-detail.css";
import {
  getCommunity,
  joinCommunity,
  leaveCommunity,
  unlistCommunity,
  updateCommunityMedia,
  ensureCommunityCode,
} from "../lib/communities";

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
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-5 6-3-3-5 5" />
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

export default function CommunityDetail() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const bannerRef = useRef(null);
  const photoRef = useRef(null);

  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let data = await getCommunity(communityId);
        if (data && !data.code) data = await ensureCommunityCode(data.id);
        setCommunity(data);
      } catch {
        toast.error("Could not open community");
      } finally {
        setLoading(false);
      }
    })();
  }, [communityId]);

  if (loading) {
    return <div className="cd-page"><p className="cd-muted">Loading community…</p></div>;
  }

  if (!community || community.deleted) {
    return (
      <div className="cd-page">
        <h1 className="cd-title">Community unavailable</h1>
        <button type="button" className="cd-btn" onClick={() => navigate("/community")}>Back</button>
      </div>
    );
  }

  const isMember = user && (community.members || []).includes(user.uid);
  const isAdmin = user && (community.createdBy === user.uid || (community.admins || []).includes(user.uid));

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

  const handleJoin = async () => {
    if (!user) return navigate("/login");
    setBusy(true);
    try {
      await joinCommunity(community.id, user.uid);
      setCommunity(await getCommunity(community.id));
    } catch (err) {
      toast.error(err.message || "Could not join");
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    if (!user) return navigate("/login");
    if (!isMember) {
      try {
        await joinCommunity(community.id, user.uid);
      } catch (err) {
        toast.error(err.message || "Join first");
        return;
      }
    }
    navigate(`/community/${community.id}/chat`);
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
      <button type="button" className="cd-back" onClick={() => navigate("/community")}>← Communities</button>

      <button
        type="button"
        className="cd-banner"
        style={community.coverUrl ? { backgroundImage: `url(${community.coverUrl})` } : undefined}
        onClick={() => isAdmin && bannerRef.current?.click()}
        disabled={!isAdmin || busy}
        aria-label="Change banner"
      >
                {!community.coverUrl && (
          <span className="cd-placeholder">
            <IconCamera />
          </span>
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
{!community.photoUrl && <IconCommunityMark />}
        </button>
        <div className="cd-identity-text">
          <p className="cd-kicker">{community.tag}</p>
          <h1 className="cd-title">{community.name}</h1>
          <p className="cd-meta">
            {community.memberCount || 1} members
            {community.role === "tutor" ? " · Tutor" : ""}
            {community.visibility === "private" ? " · Private" : " · Public"}
            {community.code ? ` · Code ${community.code}` : ""}
          </p>
        </div>
      </div>

      <div className="cd-actions">
        {!isMember && (
          <button type="button" className="cd-btn" disabled={busy} onClick={handleJoin}>Join</button>
        )}
        <button type="button" className="cd-btn" onClick={openChat}>
          <IconChat /> Open chat
        </button>
        <button type="button" className="cd-btn ghost" onClick={copyInvite}>
          <IconLink /> Invite
        </button>
        {isMember && !isAdmin && (
          <button
            type="button"
            className="cd-text-btn"
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
            className="cd-text-btn danger"
            onClick={async () => {
              if (!window.confirm("Unlist this community for everyone?")) return;
              try {
                await unlistCommunity(community.id);
                navigate("/community");
              } catch (err) {
                toast.error(err.message || "Could not delete");
              }
            }}
          >
            Delete community
          </button>
        )}
      </div>

      <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "coverUrl"); }} />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f, "photoUrl"); }} />
    </div>
  );
}
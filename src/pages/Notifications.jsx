// src/pages/Notifications.jsx
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/AuthContext";
import { describeNotification, notificationTime } from "../lib/notifications";
import { enablePush, getPushState, clearDeliveredPush } from "../lib/push";

function TypeIcon({ type }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true };
  if (type === "spark")
    return (
      <svg {...common}>
        <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  if (type === "mention" || type === "everyone")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" strokeLinecap="round" />
      </svg>
    );
  if (type === "dm")
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" />
      </svg>
    );
  if (type === "friend_request" || type === "friend_accept")
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" strokeLinecap="round" />
        <path d="M19 8v6M16 11h6" strokeLinecap="round" />
      </svg>
    );
  if (type === "session")
    return (
      <svg {...common}>
        <rect x="2" y="6" width="13" height="12" rx="2" />
        <path d="M15 10l7-3v10l-7-3z" strokeLinejoin="round" />
      </svg>
    );
  if (type === "reaction")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

// Several replies / answers / Sparks on the same question become one row.
const GROUPABLE = new Set(["reply", "answer", "spark", "reaction"]);

function groupKey(n) {
  if (!GROUPABLE.has(n.type)) return "";
  const q = /[?&]q=([^&]+)/.exec(String(n.url || ""));
  if (!q) return "";
  return `${n.type}|${n.communityId || ""}|${n.boardId || ""}|${q[1]}|${n.emoji === "question" ? "q" : "a"}`;
}

function groupItems(list) {
  const out = [];
  const byKey = new Map();
  for (const n of list) {
    const key = groupKey(n);
    if (!key) {
      out.push({ ...n, ids: [n.id], senders: [n.fromName || "Someone"], count: 1 });
      continue;
    }
    const hit = byKey.get(key);
    if (hit) {
      hit.ids.push(n.id);
      hit.count += 1;
      const name = n.fromName || "Someone";
      if (!hit.senders.includes(name)) hit.senders.push(name);
    } else {
      const g = { ...n, ids: [n.id], senders: [n.fromName || "Someone"], count: 1 };
      byKey.set(key, g);
      out.push(g);
    }
  }
  return out; // items arrive newest first, so each group shows its newest message
}

function groupNoun(type) {
  if (type === "spark") return "Sparks";
  if (type === "reaction") return "reactions";
  if (type === "answer") return "answers";
  return "replies";
}

function groupTitle(g) {
  if (g.count < 2) return describeNotification(g);
  const [a, b] = g.senders;
  const who =
    g.senders.length === 1 ? a : g.senders.length === 2 ? `${a} and ${b}` : `${a} and ${g.senders.length - 1} others`;
  switch (g.type) {
    case "answer":
      return `${who} answered your question`;
    case "reply":
      return `${who} replied`;
    case "spark":
      return g.emoji === "question" ? `${who} sparked your question` : `${who} sparked your answer`;
    case "reaction":
      return `${who} reacted to your message`;
    default:
      return describeNotification(g);
  }
}

function Row({ n, onOpen }) {
  const letter = (n.fromName || "?").slice(0, 1).toUpperCase();
  return (
    <button type="button" className={`nt-row ${n.read ? "" : "unread"}`} onClick={() => onOpen(n)}>
      <span className="nt-avatar-wrap">
        {n.fromPhoto ? (
          <img className="nt-avatar" src={n.fromPhoto} alt="" />
        ) : (
          <span className="nt-avatar nt-avatar-fallback">{letter}</span>
        )}
        <span className={`nt-type nt-type-${n.type}`}>
          <TypeIcon type={n.type} />
        </span>
      </span>
      <span className="nt-copy">
        <strong>{groupTitle(n)}</strong>
        {n.count > 1 ? <span className="nt-preview">{n.count} {groupNoun(n.type)}{n.preview ? ` · latest: ${n.preview}` : ""}</span> : n.preview ? <span className="nt-preview">{n.preview}</span> : null}
        <span className="nt-meta">
          {n.type === "friend_request" || n.type === "friend_accept" ? "Friends" : n.type === "dm" ? "Message" : n.communityName || "Circle"}
          <span aria-hidden="true"> · </span>
          {notificationTime(n.createdAt)}
        </span>
      </span>
      {!n.read && <span className="nt-dot" aria-label="Unread" />}
    </button>
  );
}

export default function Notifications({ items, loading, unread, markRead, markAllRead }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pushState, setPushState] = useState("unsupported");
  const [asking, setAsking] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) getPushState().then(setPushState);
  }, [isNative]);

  // Looking at your notifications clears the ones sitting on the lock screen.
  useEffect(() => {
    clearDeliveredPush();
  }, []);

  const turnOn = async () => {
    setAsking(true);
    const next = await enablePush();
    setPushState(next);
    setAsking(false);
  };

  // A notification stores the sender's name from the moment it was sent. Look up their
  // current name and photo so a renamed person shows up under the new name.
  const [live, setLive] = useState({});
  const senderKey = useMemo(
    () => [...new Set(items.map((n) => n.fromUid).filter(Boolean))].sort().join(","),
    [items]
  );
  useEffect(() => {
    const uids = senderKey ? senderKey.split(",") : [];
    if (!uids.length) return undefined;
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        uids.slice(0, 40).map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "publicProfiles", uid));
            if (snap.exists()) {
              const d = snap.data();
              next[uid] = { name: d.displayName || "", photo: d.photoURL || "" };
            }
          } catch {}
        })
      );
      if (!cancelled) setLive((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [senderKey]);
  const withLive = (n) => {
    const p = live[n.fromUid];
    return p ? { ...n, fromName: p.name || n.fromName, fromPhoto: p.photo || n.fromPhoto } : n;
  };

  const openItem = (n) => {
    if (!n.read) (n.ids || [n.id]).forEach((id) => markRead(id));
    if (typeof n.url === "string" && (n.url.startsWith("/community/") || n.url.startsWith("/profile"))) navigate(n.url);
  };

  if (!authLoading && !user) {
    return (
      <div className="nt-page">
        <div className="nt-empty">
          <span className="nt-empty-icon"><BellIcon /></span>
          <strong>Sign in to see your notifications</strong>
          <p>Replies, mentions and Sparks show up here.</p>
          <button type="button" className="nt-btn" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const fresh = groupItems(items.filter((n) => !n.read).map(withLive));
  const earlier = groupItems(items.filter((n) => n.read).map(withLive));

  return (
    <div className="nt-page">
      <div className="nt-head">
        <div>
          <h1>Notifications</h1>
          <p>{unread > 0 ? `${unread} new` : "You're all caught up"}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="nt-link" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {isNative && pushState === "prompt" && (
        <div className="nt-banner">
          <div>
            <strong>Get alerts on your iPhone</strong>
            <p>Know right away when someone answers your question, mentions you or starts a live session.</p>
          </div>
          <button type="button" className="nt-btn" onClick={turnOn} disabled={asking}>
            {asking ? "Asking…" : "Turn on"}
          </button>
        </div>
      )}
      {isNative && pushState === "denied" && (
        <div className="nt-banner muted">
          <p>Alerts are off. You can turn them on in iPhone Settings, Notifications, Snaprium.</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="nt-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="nt-empty">
          <span className="nt-empty-icon"><BellIcon /></span>
          <strong>Nothing yet</strong>
          <p>When someone replies, mentions you or sparks your answer, you'll see it here.</p>
        </div>
      ) : (
        <>
          {fresh.length > 0 && (
            <section>
              <h2 className="nt-section">New</h2>
              <div className="nt-list">
                {fresh.map((n) => (
                  <Row key={n.id} n={n} onOpen={openItem} />
                ))}
              </div>
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <h2 className="nt-section">Earlier</h2>
              <div className="nt-list">
                {earlier.map((n) => (
                  <Row key={n.id} n={n} onOpen={openItem} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
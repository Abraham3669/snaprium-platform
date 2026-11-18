// src/components/ChatNav.jsx
//
// Quick jumping from inside a circle chat:
//   useChatNav      loads your circles (with new-message marks), chats, friends and requests
//   ChatNavList     the list itself: "circles" or "friends"
//   ChatNavSheet    the phone bottom sheet that holds a list (Circles | Friends) or the member list
//   NavAvatar       round picture or first letter
//   CirclesGlyph / ChatGlyph   the two icons used on the buttons
//
// PC: CommunityChat shows ChatNavList in a panel above the footer of the boards sidebar.
// Phone: CommunityChat shows ChatNavSheet from the two header buttons.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { countCommunityUnread, listMyCommunities } from "../lib/communities";
import { useInbox } from "../lib/dms";
import { useFriendships } from "../lib/friends";
import { useLiveProfiles } from "../lib/publicProfile";
import "../styles/chat-nav.css";

export function CirclesGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function ago(t) {
  const d = t?.toDate?.() || (t ? new Date(t) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function NavAvatar({ name = "", photo = "", square = false }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  if (square) {
    return (
      <span className="cn-av square" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
        {!photo && letter}
      </span>
    );
  }
  return <span className="cn-av">{photo ? <img src={photo} alt="" /> : letter}</span>;
}

// Everything the buttons and lists need. Call it once at the top of the chat page.
export function useChatNav({ me, communityId, blocked }) {
  const { list: convsAll } = useInbox(me);
  const { friends, incoming } = useFriendships(me);
  const [circles, setCircles] = useState(null); // null = still loading
  const [circleUnread, setCircleUnread] = useState({});

  useEffect(() => {
    if (!me) return undefined;
    let cancelled = false;
    listMyCommunities(me)
      .then(async (rows) => {
        if (cancelled) return;
        const own = rows || [];
        setCircles(own);
        // New-message marks for the other circles (a few at most, to stay light).
        const others = own.filter((c) => c.id !== communityId).slice(0, 12);
        const pairs = await Promise.all(
          others.map(async (c) => {
            try {
              return [c.id, await countCommunityUnread(c.id, me)];
            } catch {
              return [c.id, 0];
            }
          })
        );
        if (!cancelled) setCircleUnread(Object.fromEntries(pairs));
      })
      .catch(() => !cancelled && setCircles([]));
    return () => {
      cancelled = true;
    };
  }, [me, communityId]);

  const chats = useMemo(() => (convsAll || []).filter((c) => !blocked?.has?.(c.other)), [convsAll, blocked]);
  const friendIds = useMemo(() => (friends || []).filter((u) => !blocked?.has?.(u)), [friends, blocked]);
  const requestCount = (incoming || []).filter((u) => !blocked?.has?.(u)).length;
  const ids = useMemo(() => [...new Set([...chats.map((c) => c.other), ...friendIds])], [chats, friendIds]);
  const profiles = useLiveProfiles(ids);

  const circleDots = Object.values(circleUnread).filter((n) => n > 0).length;
  const friendDots = chats.filter((c) => c.unread).length + requestCount;

  return { circles, circleUnread, circleDots, chats, friendIds, requestCount, profiles, friendDots };
}

export function ChatNavList({ nav, kind, communityId, onDone }) {
  const navigate = useNavigate();
  const go = (to) => {
    onDone?.();
    navigate(to);
  };

  if (kind === "circles") {
    if (nav.circles === null) return <p className="cn-note">Loading…</p>;
    return (
      <div className="cn-list">
        {nav.circles.length === 0 ? (
          <div className="cn-empty">
            <p>You have not joined a circle yet.</p>
            <button type="button" className="cn-primary" onClick={() => go("/community")}>Find a circle</button>
          </div>
        ) : (
          <ul>
            {nav.circles.map((c) => {
              const here = c.id === communityId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`cn-row ${here ? "on" : ""}`}
                    onClick={() => (here ? onDone?.() : go(`/community/${c.id}/chat`))}
                    aria-current={here ? "true" : undefined}
                  >
                    <NavAvatar square name={c.name} photo={c.photoUrl} />
                    <span className="cn-copy">
                      <strong>{c.name}</strong>
                      {c.tag ? <small>{c.tag}</small> : null}
                    </span>
                    {here ? <span className="cn-here">Here</span> : nav.circleUnread[c.id] > 0 ? <i className="cn-dot" aria-label="New messages" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {nav.circles.length > 0 && (
          <button type="button" className="cn-link" onClick={() => go("/community")}>Browse all circles</button>
        )}
      </div>
    );
  }

  const chatIds = new Set(nav.chats.map((c) => c.other));
  const others = nav.friendIds.filter((u) => !chatIds.has(u));
  const nameOf = (uid) => nav.profiles[uid]?.displayName || "Member";
  const empty = nav.chats.length === 0 && others.length === 0;

  return (
    <div className="cn-list">
      {nav.requestCount > 0 && (
        <button type="button" className="cn-request" onClick={() => go("/friends")}>
          <span>Friend requests</span>
          <span className="cn-badge">{nav.requestCount}</span>
        </button>
      )}
      {empty ? (
        <div className="cn-empty">
          <p>No friends yet. Tap a name or picture in a circle and press Add friend.</p>
        </div>
      ) : (
        <ul>
          {nav.chats.map((c) => (
            <li key={c.id}>
              <button type="button" className="cn-row" onClick={() => go(`/messages/${c.other}`)}>
                <NavAvatar name={nameOf(c.other)} photo={nav.profiles[c.other]?.photoURL} />
                <span className="cn-copy">
                  <strong>{nameOf(c.other)}</strong>
                  <small className={c.unread ? "unread" : ""}>{c.lastText}</small>
                </span>
                <span className="cn-meta">
                  {ago(c.lastAt)}
                  {c.unread && <i className="cn-dot" aria-label="Unread" />}
                </span>
              </button>
            </li>
          ))}
          {others.map((uid) => (
            <li key={uid}>
              <button type="button" className="cn-row" onClick={() => go(`/messages/${uid}`)}>
                <NavAvatar name={nameOf(uid)} photo={nav.profiles[uid]?.photoURL} />
                <span className="cn-copy">
                  <strong>{nameOf(uid)}</strong>
                  <small>Say hi</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="cn-link" onClick={() => go("/messages")}>Open Messages</button>
    </div>
  );
}

// Phone bottom sheet. view: "circles" | "friends" (with a switch) or "members" (with a title).
export function ChatNavSheet({ view, setView, title, onClose, nav, children }) {
  const startY = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const swipe = {
    onTouchStart: (e) => {
      startY.current = e.touches[0].clientY;
    },
    onTouchEnd: (e) => {
      if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 70) onClose?.();
      startY.current = null;
    },
  };

  return (
    <div className="cn-backdrop" onClick={onClose}>
      <div className="cn-sheet" role="dialog" aria-modal="true" aria-label={title || "Switch"} onClick={(e) => e.stopPropagation()}>
        <div className="cn-sheet-top" {...swipe}>
          <span className="cn-grab" aria-hidden="true" />
          <div className="cn-sheet-head">
            {view === "members" ? (
              <strong className="cn-sheet-title">{title}</strong>
            ) : (
              <div className="cn-seg" role="tablist" aria-label="Circles or friends">
                <button type="button" role="tab" aria-selected={view === "circles"} className={view === "circles" ? "on" : ""} onClick={() => setView("circles")}>
                  Circles{nav?.circleDots > 0 && <span className="cn-badge">{nav.circleDots}</span>}
                </button>
                <button type="button" role="tab" aria-selected={view === "friends"} className={view === "friends" ? "on" : ""} onClick={() => setView("friends")}>
                  Friends{nav?.friendDots > 0 && <span className="cn-badge">{nav.friendDots}</span>}
                </button>
              </div>
            )}
            <button type="button" className="cn-x" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="cn-sheet-body">{children}</div>
      </div>
    </div>
  );
}
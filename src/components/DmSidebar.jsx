// src/components/DmSidebar.jsx
//
// The right-hand column of the Messages page (the whole screen on a phone):
//   Chats      your conversations, newest first, unread ones marked
//   Friends    everyone you are friends with, tap to start or open a chat
//   Requests   people who asked to be your friend, and requests you sent
// A search box filters whichever list is showing.
// On a phone a Friends | Circles switch sits on top, so your circles are one tap away (PC shows them in the left column).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { acceptFriendRequest, removeFriendship, useFriendships } from "../lib/friends";
import { countCommunityUnread, listMyCommunities } from "../lib/communities";
import { useInbox } from "../lib/dms";
import { useLiveProfiles } from "../lib/publicProfile";
import { useBlocked } from "../lib/moderation";
import ProfileCard from "./ProfileCard";

function ago(t) {
  const d = t?.toDate?.() || (t ? new Date(t) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Av({ profile }) {
  const n = profile?.displayName || "Member";
  return <span className="fr-av">{profile?.photoURL ? <img src={profile.photoURL} alt="" /> : n.slice(0, 1).toUpperCase()}</span>;
}

export default function DmSidebar({ initialTab = "chats", activeUid = "", onOpen, onLeave }) {
  const { user } = useAuth();
  const me = user?.uid || "";
  const navigate = useNavigate();
  const { list: convsAll } = useInbox(me);
  const { friends, incoming, outgoing, loading } = useFriendships(me);
  const { blocked } = useBlocked(me);
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [busyUid, setBusyUid] = useState("");
  const [cardUid, setCardUid] = useState("");
  const [pickedAuto, setPickedAuto] = useState(false);
  const [section, setSection] = useState("friends");
  const [circles, setCircles] = useState(null);
  const [circleUnread, setCircleUnread] = useState({});

  // Phone only: load your circles (and which have new messages) for the Circles button.
  useEffect(() => {
    if (!me || typeof window === "undefined" || !window.matchMedia?.("(max-width: 700px)").matches) return undefined;
    let cancelled = false;
    listMyCommunities(me)
      .then(async (rows) => {
        if (cancelled) return;
        setCircles(rows || []);
        const pairs = await Promise.all(
          (rows || []).map(async (c) => {
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
  }, [me]);
  const circleDots = Object.values(circleUnread).filter((n) => n > 0).length;

  const convs = convsAll.filter((c) => !blocked.has(c.other));
  const fr = friends.filter((u) => !blocked.has(u));
  const inc = incoming.filter((u) => !blocked.has(u));
  const out = outgoing.filter((u) => !blocked.has(u));
  const unreadCount = convs.filter((c) => c.unread).length;

  const ids = useMemo(
    () => [...new Set([...convs.map((c) => c.other), ...fr, ...inc, ...out])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convsAll, friends, incoming, outgoing, blocked]
  );
  const profiles = useLiveProfiles(ids);

  // Coming from a "friend request" link or the Friends button: open on the tab that helps most.
  useEffect(() => {
    if (pickedAuto || loading) return;
    setPickedAuto(true);
    if (initialTab === "friends" && inc.length > 0) setTab("requests");
  }, [loading, initialTab, inc.length, pickedAuto]);

  const meInfo = { uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" };
  const nameOf = (uid) => profiles[uid]?.displayName || "Member";
  const q = query.trim().toLowerCase();
  const match = (uid) => !q || nameOf(uid).toLowerCase().includes(q);

  const act = async (uid, fn, okMsg) => {
    if (busyUid) return;
    setBusyUid(uid);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch {
      toast.error("Could not update. Please try again.");
    } finally {
      setBusyUid("");
    }
  };

  const chats = convs.filter((c) => match(c.other));
  const friendRows = fr.filter(match);
  const requestIn = inc.filter(match);
  const requestOut = out.filter(match);

  const empty = (text, action) => (
    <div className="dm-side-empty">
      <p>{text}</p>
      {action}
    </div>
  );

  return (
    <aside className="dm-side" aria-label="Conversations and friends">
      <header className="dm-side-top">
        <button type="button" className="cc-back dm-side-back" onClick={onLeave} aria-label="Leave messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1>Messages</h1>
        <button type="button" className="cc-icon-btn dm-side-x" onClick={onLeave} aria-label="Close messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="dm-switch" role="tablist" aria-label="Friends or circles">
        <button type="button" role="tab" aria-selected={section === "friends"} className={section === "friends" ? "on" : ""} onClick={() => setSection("friends")}>
          Friends{unreadCount + inc.length > 0 && <span className="fr-badge">{unreadCount + inc.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={section === "circles"} className={section === "circles" ? "on" : ""} onClick={() => setSection("circles")}>
          Circles{circleDots > 0 && <span className="fr-badge">{circleDots}</span>}
        </button>
      </div>

      {section === "circles" && (
        <div className="dm-side-list dm-circles">
          {circles === null ? (
            <p className="dm-side-note">Loading…</p>
          ) : circles.length === 0 ? (
            empty(
              "You have not joined a circle yet.",
              <button type="button" className="dm-btn dm-btn-primary" onClick={() => navigate("/community")}>Find a circle</button>
            )
          ) : (
            <ul className="fr-list">
              {circles.map((c) => (
                <li key={c.id} className="fr-row">
                  <button type="button" className="fr-person dm-row" onClick={() => navigate(`/community/${c.id}`)}>
                    <span className="fr-av dm-circ-av" style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}>
                      {!c.photoUrl && (c.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="ms-copy">
                      <span className="fr-name">{c.name}</span>
                      {c.tag ? <span className="ms-last">{c.tag}</span> : null}
                    </span>
                    {circleUnread[c.id] > 0 && <i className="ms-dot" aria-label="New messages" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="dm-browse" onClick={() => navigate("/community")}>Browse all circles</button>
        </div>
      )}

      <div className={`dm-side-tabs fr-tabs ${section === "circles" ? "dm-hide-phone" : ""}`} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "chats"} className={tab === "chats" ? "on" : ""} onClick={() => setTab("chats")}>
          Chats{unreadCount > 0 && <span className="fr-badge">{unreadCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "friends"} className={tab === "friends" ? "on" : ""} onClick={() => setTab("friends")}>
          Friends{fr.length ? ` · ${fr.length}` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "on" : ""} onClick={() => setTab("requests")}>
          Requests{inc.length > 0 && <span className="fr-badge">{inc.length}</span>}
        </button>
      </div>

      <div className={`dm-side-search ${section === "circles" ? "dm-hide-phone" : ""}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search by name" />
      </div>

      <div className={`dm-side-list ${section === "circles" ? "dm-hide-phone" : ""}`}>
        {loading ? (
          <p className="dm-side-note">Loading…</p>
        ) : tab === "chats" ? (
          chats.length === 0 ? (
            q
              ? empty("No chats match your search.")
              : empty(
                  "No conversations yet. Pick a friend to start one.",
                  <button type="button" className="dm-btn dm-btn-primary" onClick={() => setTab("friends")}>Open friends</button>
                )
          ) : (
            <ul className="fr-list">
              {chats.map((c) => (
                <li key={c.id} className="fr-row">
                  <button type="button" className={`fr-person ms-conv dm-row ${activeUid === c.other ? "active" : ""}`} onClick={() => onOpen(c.other)}>
                    <Av profile={profiles[c.other]} />
                    <span className="ms-copy">
                      <span className="fr-name">{nameOf(c.other)}</span>
                      <span className={`ms-last ${c.unread ? "unread" : ""}`}>
                        {c.lastFrom === me ? "You: " : ""}
                        {c.lastText}
                      </span>
                    </span>
                    <span className="ms-meta">
                      {ago(c.lastAt)}
                      {c.unread && <i className="ms-dot" aria-label="Unread" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : tab === "friends" ? (
          friendRows.length === 0 ? (
            q
              ? empty("No friends match your search.")
              : empty("No friends yet. Tap a name or picture in a circle and press Add friend.")
          ) : (
            <ul className="fr-list">
              {friendRows.map((uid) => (
                <li key={uid} className="fr-row">
                  <button type="button" className={`fr-person dm-row ${activeUid === uid ? "active" : ""}`} onClick={() => onOpen(uid)}>
                    <Av profile={profiles[uid]} />
                    <span className="fr-name">{nameOf(uid)}</span>
                  </button>
                  <span className="fr-actions">
                    <button type="button" className="dm-btn dm-btn-primary" onClick={() => onOpen(uid)}>Message</button>
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : requestIn.length + requestOut.length === 0 ? (
          q ? empty("No requests match your search.") : empty("No requests right now.")
        ) : (
          <ul className="fr-list">
            {requestIn.map((uid) => (
              <li key={uid} className="fr-row">
                <button type="button" className="fr-person" onClick={() => setCardUid(uid)}>
                  <Av profile={profiles[uid]} />
                  <span className="fr-name">{nameOf(uid)}</span>
                </button>
                <span className="fr-actions">
                  <button type="button" className="dm-btn dm-btn-primary" disabled={busyUid === uid} onClick={() => act(uid, () => acceptFriendRequest(meInfo, uid), "Friend added")}>Accept</button>
                  <button type="button" className="dm-btn dm-btn-out" disabled={busyUid === uid} onClick={() => act(uid, () => removeFriendship(me, uid))}>Decline</button>
                </span>
              </li>
            ))}
            {requestOut.map((uid) => (
              <li key={uid} className="fr-row">
                <button type="button" className="fr-person" onClick={() => setCardUid(uid)}>
                  <Av profile={profiles[uid]} />
                  <span className="fr-name">{nameOf(uid)}</span>
                </button>
                <span className="fr-actions">
                  <span className="fr-sent">Sent</span>
                  <button type="button" className="dm-btn dm-btn-out" disabled={busyUid === uid} onClick={() => act(uid, () => removeFriendship(me, uid))}>Cancel</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="dm-me-bar" onClick={() => navigate("/profile")} aria-label="Your profile">
        <span className="dm-me-av">{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName || user?.email || "Me").trim().charAt(0).toUpperCase()}</span>
        <span className="dm-me-text">
          <strong>{user?.displayName || "Your profile"}</strong>
          <small>Profile</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>

      {cardUid && (
        <ProfileCard
          uid={cardUid}
          fallback={{ name: profiles[cardUid]?.displayName, photo: profiles[cardUid]?.photoURL }}
          user={user}
          onClose={() => setCardUid("")}
        />
      )}
    </aside>
  );
}
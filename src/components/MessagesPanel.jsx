// src/components/MessagesPanel.jsx
//
// Your conversations (opened from Profile > Messages). Tap one to open the chat.
// "New message" lists your friends so you can start one.
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFriendships } from "../lib/friends";
import { useInbox } from "../lib/dms";
import { useLiveProfiles } from "../lib/publicProfile";
import { useBlocked } from "../lib/moderation";
import DmPanel from "./DmPanel";
import "../styles/dm.css";

function ago(t) {
  const d = t?.toDate?.() || (t ? new Date(t) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPanel({ onClose }) {
  const { user } = useAuth();
  const me = user?.uid || "";
  const { list } = useInbox(me);
  const { friends } = useFriendships(me);
  const { blocked } = useBlocked(me);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState("");

  const convs = list.filter((c) => !blocked.has(c.other));
  const friendList = useMemo(() => friends.filter((u) => !blocked.has(u)), [friends, blocked]);
  const ids = useMemo(() => [...new Set([...convs.map((c) => c.other), ...friendList])], [convs, friendList]);
  const profiles = useLiveProfiles(ids);

  const Av = ({ uid }) => {
    const p = profiles[uid];
    const n = p?.displayName || "Member";
    return <span className="fr-av">{p?.photoURL ? <img src={p.photoURL} alt="" /> : n.slice(0, 1).toUpperCase()}</span>;
  };

  return (
    <>
      <div className="pf-modal" onClick={onClose}>
        <div className="pf-modal-card fr-card" role="dialog" aria-modal="true" aria-labelledby="ms-title" onClick={(e) => e.stopPropagation()}>
          <h2 id="ms-title">{picking ? "New message" : "Messages"}</h2>
          {picking ? (
            friendList.length === 0 ? (
              <p className="pf-blocked-empty">Add friends first, then you can message them.</p>
            ) : (
              <ul className="fr-list">
                {friendList.map((uid) => (
                  <li key={uid} className="fr-row">
                    <button type="button" className="fr-person" onClick={() => { setPicking(false); setOpen(uid); }}>
                      <Av uid={uid} />
                      <span className="fr-name">{profiles[uid]?.displayName || "Member"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : convs.length === 0 ? (
            <p className="pf-blocked-empty">No conversations yet. You can message your friends.</p>
          ) : (
            <ul className="fr-list">
              {convs.map((c) => (
                <li key={c.id} className="fr-row">
                  <button type="button" className="fr-person ms-conv" onClick={() => setOpen(c.other)}>
                    <Av uid={c.other} />
                    <span className="ms-copy">
                      <span className="fr-name">{profiles[c.other]?.displayName || "Member"}</span>
                      <span className={`ms-last ${c.unread ? "unread" : ""}`}>
                        {c.lastFrom === me ? "You: " : ""}{c.lastText}
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
          )}
          <div className="pf-modal-actions">
            {picking ? (
              <button type="button" className="pf-btn pf-btn-out" onClick={() => setPicking(false)}>Back</button>
            ) : (
              <>
                <button type="button" className="pf-btn pf-btn-out" onClick={onClose}>Done</button>
                <button type="button" className="pf-btn pf-btn-primary" onClick={() => setPicking(true)}>New message</button>
              </>
            )}
          </div>
        </div>
      </div>
      {open && (
        <DmPanel
          other={open}
          fallback={{ name: profiles[open]?.displayName, photo: profiles[open]?.photoURL }}
          onClose={() => setOpen("")}
        />
      )}
    </>
  );
}
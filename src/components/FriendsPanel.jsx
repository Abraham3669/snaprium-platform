// src/components/FriendsPanel.jsx
//
// "Friends" window opened from Profile: your friends, requests sent to you, and requests you sent.
// Tapping a person opens their profile card.
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { acceptFriendRequest, removeFriendship, useFriendships } from "../lib/friends";
import { useLiveProfiles } from "../lib/publicProfile";
import { useBlocked } from "../lib/moderation";
import ProfileCard from "./ProfileCard";
import DmPanel from "./DmPanel";

function Row({ uid, profile, onOpen, children }) {
  const name = profile?.displayName || "Member";
  const photo = profile?.photoURL || "";
  return (
    <li className="fr-row">
      <button type="button" className="fr-person" onClick={() => onOpen(uid)}>
        <span className="fr-av">{photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
        <span className="fr-name">{name}</span>
      </button>
      <span className="fr-actions">{children}</span>
    </li>
  );
}

export default function FriendsPanel({ onClose, initialTab = "friends" }) {
  const { user } = useAuth();
  const me = user?.uid || "";
  const { friends, incoming, outgoing, loading } = useFriendships(me);
  const { blocked } = useBlocked(me);
  const [tab, setTab] = useState(initialTab);
  const [busyUid, setBusyUid] = useState("");
  const [openUid, setOpenUid] = useState("");
  const [dmUid, setDmUid] = useState("");

  const visible = (list) => list.filter((u) => !blocked.has(u));
  const fr = visible(friends);
  const inc = visible(incoming);
  const out = visible(outgoing);
  const all = useMemo(() => [...fr, ...inc, ...out], [fr, inc, out]);
  const profiles = useLiveProfiles(all);

  const meInfo = { uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" };

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

  const list =
    tab === "friends" ? fr : [...inc, ...out];

  return (
    <>
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-modal-card fr-card" role="dialog" aria-modal="true" aria-labelledby="fr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="fr-title">Friends</h2>
        <div className="fr-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "friends"} className={tab === "friends" ? "on" : ""} onClick={() => setTab("friends")}>
            Friends{fr.length ? ` · ${fr.length}` : ""}
          </button>
          <button type="button" role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "on" : ""} onClick={() => setTab("requests")}>
            Requests
            {inc.length > 0 && <span className="fr-badge">{inc.length}</span>}
          </button>
        </div>

        {loading ? (
          <p className="pf-blocked-empty">Loading…</p>
        ) : list.length === 0 ? (
          <p className="pf-blocked-empty">
            {tab === "friends"
              ? "No friends yet. Tap a name or picture in a circle and press Add friend."
              : "No requests right now."}
          </p>
        ) : (
          <ul className="fr-list">
            {tab === "friends" &&
              fr.map((uid) => (
                <Row key={uid} uid={uid} profile={profiles[uid]} onOpen={setOpenUid}>
                  <button type="button" className="pf-btn pf-btn-primary" onClick={() => setDmUid(uid)}>Message</button>
                </Row>
              ))}
            {tab === "requests" && (
              <>
                {inc.map((uid) => (
                  <Row key={uid} uid={uid} profile={profiles[uid]} onOpen={setOpenUid}>
                    <button type="button" className="pf-btn pf-btn-primary" disabled={busyUid === uid} onClick={() => act(uid, () => acceptFriendRequest(meInfo, uid), "Friend added")}>
                      Accept
                    </button>
                    <button type="button" className="pf-btn pf-btn-out" disabled={busyUid === uid} onClick={() => act(uid, () => removeFriendship(me, uid))}>
                      Decline
                    </button>
                  </Row>
                ))}
                {out.map((uid) => (
                  <Row key={uid} uid={uid} profile={profiles[uid]} onOpen={setOpenUid}>
                    <span className="fr-sent">Sent</span>
                    <button type="button" className="pf-btn pf-btn-out" disabled={busyUid === uid} onClick={() => act(uid, () => removeFriendship(me, uid))}>
                      Cancel
                    </button>
                  </Row>
                ))}
              </>
            )}
          </ul>
        )}

        <div className="pf-modal-actions">
          <button type="button" className="pf-btn pf-btn-out" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
    {dmUid && (
      <DmPanel
        other={dmUid}
        fallback={{ name: profiles[dmUid]?.displayName, photo: profiles[dmUid]?.photoURL }}
        onClose={() => setDmUid("")}
      />
    )}
    {openUid && (
      <ProfileCard
        uid={openUid}
        fallback={{ name: profiles[openUid]?.displayName, photo: profiles[openUid]?.photoURL }}
        user={user}
        onClose={() => setOpenUid("")}
      />
    )}
    </>
  );
}
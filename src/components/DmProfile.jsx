// src/components/DmProfile.jsx
//
// The left column of the Messages page on a wide PC screen: who you are talking to.
// Banner, picture, name, bio, your own circles, friend status, Report and Block.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchProfileCard } from "../lib/publicProfile";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, useFriendship } from "../lib/friends";
import { useBlocked } from "../lib/moderation";
import { listMyCommunities } from "../lib/communities";
import { BlockDialog, ReportDialog } from "./ModerationDialogs";
import "../styles/profile-card.css";
import "../styles/dm.css";

const TONES = [
  ["#3b82f6", "#93c5fd"],
  ["#8b5cf6", "#c4b5fd"],
  ["#0ea5e9", "#7dd3fc"],
  ["#14b8a6", "#99f6e4"],
  ["#f59e0b", "#fcd34d"],
  ["#ec4899", "#f9a8d4"],
];
function toneFor(uid) {
  let h = 0;
  for (let i = 0; i < String(uid).length; i += 1) h = (h * 31 + String(uid).charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export default function DmProfile({ uid, fallback = {}, user }) {
  const navigate = useNavigate();
  const me = user?.uid || "";
  const [card, setCard] = useState(null);
  const [shared, setShared] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reportInfo, setReportInfo] = useState(null);
  const [blockInfo, setBlockInfo] = useState(null);
  const { status, loading: relLoading } = useFriendship(me, uid);
  const { blocked, block: blockPerson } = useBlocked(me);
  const iBlocked = blocked.has(uid);

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setConfirmRemove(false);
    fetchProfileCard(uid).then((c) => {
      if (!cancelled) setCard(c);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Your own circles, for quick jumping while you chat.
  useEffect(() => {
    let cancelled = false;
    setShared([]);
    if (!me) return undefined;
    listMyCommunities(me)
      .then((rows) => {
        if (!cancelled) setShared(rows || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me]);

  const name = card?.displayName || fallback.name || "Member";
  const photo = card?.photoURL || fallback.photo || "";
  const bio = card?.bio || "";
  const banner = card?.banner || "";
  const tone = useMemo(() => toneFor(uid), [uid]);
  const meInfo = { uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" };

  const run = async (fn, failMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      toast.error(failMsg);
    } finally {
      setBusy(false);
    }
  };

  let actions = null;
  if (iBlocked) {
    actions = <span className="pc-pill warn">You blocked this person</span>;
  } else if (relLoading) {
    actions = null;
  } else if (status === "none") {
    actions = (
      <button type="button" className="pc-btn pc-primary" disabled={busy} onClick={() => run(async () => { await sendFriendRequest(meInfo, uid); toast.success("Friend request sent"); }, "Could not send the request")}>
        Add friend
      </button>
    );
  } else if (status === "sent") {
    actions = (
      <>
        <span className="pc-pill">Request sent</span>
        <button type="button" className="pc-btn pc-ghost" disabled={busy} onClick={() => run(() => removeFriendship(me, uid), "Could not update")}>Cancel</button>
      </>
    );
  } else if (status === "received") {
    actions = (
      <>
        <button type="button" className="pc-btn pc-primary" disabled={busy} onClick={() => run(async () => { await acceptFriendRequest(meInfo, uid); toast.success(`You and ${name} are friends`); }, "Could not accept")}>Accept</button>
        <button type="button" className="pc-btn" disabled={busy} onClick={() => run(() => removeFriendship(me, uid), "Could not update")}>Decline</button>
      </>
    );
  } else if (status === "friends") {
    actions = confirmRemove ? (
      <>
        <span className="pc-pill warn">Remove {name}?</span>
        <button type="button" className="pc-btn pc-danger" disabled={busy} onClick={() => run(async () => { await removeFriendship(me, uid); setConfirmRemove(false); toast.info("Friend removed"); }, "Could not update")}>Remove</button>
        <button type="button" className="pc-btn" onClick={() => setConfirmRemove(false)}>Keep</button>
      </>
    ) : (
      <>
        <span className="pc-pill dm-friends-pill">Friends</span>
        <button type="button" className="pc-btn pc-ghost" onClick={() => setConfirmRemove(true)}>Remove friend</button>
      </>
    );
  }

  return (
    <aside className="dm-prof" aria-label={`${name}'s profile`}>
      <div className="dm-prof-banner" style={banner ? undefined : { background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})` }}>
        {banner ? <img src={banner} alt="" /> : null}
      </div>
      <div className="dm-prof-body">
        <span className="pc-avatar dm-prof-avatar">
          {photo ? <img src={photo} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
        </span>
        <h2 className="pc-name">{name}</h2>
        {bio ? <p className="pc-bio">{bio}</p> : <p className="pc-bio pc-bio-empty">{card ? "No bio yet." : " "}</p>}
        {actions && <div className="pc-actions dm-prof-actions">{actions}</div>}

        {shared.length > 0 && (
          <section className="dm-prof-section">
            <h3>Your circles</h3>
            <ul className="dm-shared">
              {shared.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => navigate(`/community/${c.id}`)}>
                    <span className="dm-shared-av" style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}>
                      {!c.photoUrl && (c.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="dm-shared-copy">
                      <strong>{c.name}</strong>
                      {c.tag ? <small>{c.tag}</small> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="dm-prof-foot">
          <button
            type="button"
            className="dm-prof-link"
            onClick={() =>
              setReportInfo({
                kind: "profile",
                communityId: "",
                contentId: uid,
                contentUid: uid,
                contentName: name,
                preview: bio || (banner ? "[banner picture]" : ""),
              })
            }
          >
            Report profile
          </button>
          {!iBlocked && (
            <button type="button" className="dm-prof-link danger" onClick={() => setBlockInfo({ uid, name, photo })}>
              Block user
            </button>
          )}
        </div>
      </div>

      {reportInfo && <ReportDialog info={reportInfo} user={user} onClose={() => setReportInfo(null)} />}
      {blockInfo && (
        <BlockDialog person={blockInfo} onClose={() => setBlockInfo(null)} onConfirm={(p) => blockPerson(p, "")} />
      )}
    </aside>
  );
}
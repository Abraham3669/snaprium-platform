// src/components/ProfileCard.jsx
//
// The card that opens when you tap a person's name or picture (chat, questions, circle faces).
// Banner, picture, name, bio, a friend button, and a ⋯ menu with Report and Block.
//   phone / iPhone app: slides up from the bottom      PC: a centred card
//
// Props
//   uid        the person
//   fallback   { name, photo } to show instantly while the full card loads
//   user       you (from useAuth)
//   communityId  optional, only used to tell us which circle a report came from
//   onClose    close the card
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchProfileCard } from "../lib/publicProfile";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, useFriendship } from "../lib/friends";
import { useBlocked } from "../lib/moderation";
import { BlockDialog, ReportDialog } from "./ModerationDialogs";
import DmPanel from "./DmPanel";
import "../styles/profile-card.css";

// A calm, steady colour for people who have no banner yet (same person = same colour).
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

function Icon({ d, extra }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {extra}
    </svg>
  );
}

export default function ProfileCard({ uid, fallback = {}, user, communityId = "", onClose }) {
  const navigate = useNavigate();
  const me = user?.uid || "";
  const isMe = !!me && me === uid;
  const [card, setCard] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [reportInfo, setReportInfo] = useState(null);
  const [blockInfo, setBlockInfo] = useState(null);
  const { status, loading: relLoading } = useFriendship(me, uid);
  const { blocked, block: blockPerson, unblock } = useBlocked(me);
  const iBlocked = blocked.has(uid);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchProfileCard(uid).then((c) => {
      if (cancelled) return;
      setCard(c);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !reportInfo && !blockInfo) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, reportInfo, blockInfo]);

  const name = card?.displayName || fallback.name || "Member";
  const photo = card?.photoURL || fallback.photo || "";
  const bio = card?.bio || "";
  const banner = card?.banner || "";
  const tone = useMemo(() => toneFor(uid), [uid]);

  const meInfo = user
    ? { uid: user.uid, displayName: user.displayName || "Member", photoURL: user.photoURL || "" }
    : null;

  const run = async (fn, failMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.warn("[friends]", err?.message || err);
      toast.error(failMsg);
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      await sendFriendRequest(meInfo, uid);
      toast.success("Friend request sent");
    }, "Could not send the request");
  const accept = () =>
    run(async () => {
      await acceptFriendRequest(meInfo, uid);
      toast.success(`You and ${name} are friends`);
    }, "Could not accept the request");
  const remove = (okMsg) =>
    run(async () => {
      await removeFriendship(me, uid);
      setConfirmRemove(false);
      if (okMsg) toast.info(okMsg);
    }, "Could not update");

  let actions = null;
  if (isMe) {
    actions = (
      <button type="button" className="pc-btn pc-primary" onClick={() => { onClose(); navigate("/profile"); }}>
        Edit profile
      </button>
    );
  } else if (!me) {
    actions = null;
  } else if (iBlocked) {
    actions = (
      <button
        type="button"
        className="pc-btn"
        disabled={busy}
        onClick={() => run(async () => { await unblock(uid); toast.success("Unblocked"); }, "Could not unblock")}
      >
        You blocked this person · Unblock
      </button>
    );
  } else if (relLoading) {
    actions = <button type="button" className="pc-btn" disabled>…</button>;
  } else if (status === "none") {
    actions = (
      <button type="button" className="pc-btn pc-primary" disabled={busy} onClick={add}>
        <Icon d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" extra={<><circle cx="9" cy="8" r="3.5" /><path d="M19 8v6M16 11h6" /></>} />
        Add friend
      </button>
    );
  } else if (status === "sent") {
    actions = (
      <>
        <span className="pc-pill">Request sent</span>
        <button type="button" className="pc-btn pc-ghost" disabled={busy} onClick={() => remove("Request cancelled")}>
          Cancel
        </button>
      </>
    );
  } else if (status === "received") {
    actions = (
      <>
        <button type="button" className="pc-btn pc-primary" disabled={busy} onClick={accept}>Accept</button>
        <button type="button" className="pc-btn" disabled={busy} onClick={() => remove("Request declined")}>Decline</button>
      </>
    );
  } else if (status === "friends") {
    actions = confirmRemove ? (
      <>
        <span className="pc-pill warn">Remove {name}?</span>
        <button type="button" className="pc-btn pc-danger" disabled={busy} onClick={() => remove("Friend removed")}>Remove</button>
        <button type="button" className="pc-btn" onClick={() => setConfirmRemove(false)}>Keep</button>
      </>
    ) : (
      <>
        <button type="button" className="pc-btn pc-msg" onClick={() => setDmOpen(true)}>
          <Icon d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /> Message
        </button>
        <button type="button" className="pc-btn pc-friends" onClick={() => setConfirmRemove(true)}>
          <Icon d="M20 6L9 17l-5-5" /> Friends
        </button>
      </>
    );
  }

  // Message opens the conversation in place of the card; closing it closes both.
  if (dmOpen) return <DmPanel other={uid} fallback={{ name, photo }} onClose={onClose} />;

  return createPortal(
    <>
      <div className="pc-backdrop" onClick={onClose}>
        <div
          className="pc-card"
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s profile`}
          onClick={(e) => { e.stopPropagation(); setMenu(false); }}
        >
          <div
            className="pc-banner"
            style={banner ? undefined : { background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})` }}
          >
            {banner ? <img src={banner} alt="" /> : null}
            <button type="button" className="pc-x" onClick={onClose} aria-label="Close">×</button>
            {!isMe && !!me && (
              <div className="pc-more-wrap">
                <button
                  type="button"
                  className="pc-more"
                  aria-label="More"
                  onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}
                >
                  ⋯
                </button>
                {menu && (
                  <div className="pc-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        setReportInfo({
                          kind: "profile",
                          communityId,
                          contentId: uid,
                          contentUid: uid,
                          contentName: name,
                          preview: bio || (banner ? "[banner picture]" : ""),
                        });
                      }}
                    >
                      Report profile
                    </button>
                    {!iBlocked && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => { setMenu(false); setBlockInfo({ uid, name, photo }); }}
                      >
                        Block user
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pc-body">
            <span className="pc-avatar">
              {photo ? <img src={photo} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
            </span>
            <h2 className="pc-name">{name}</h2>
            {bio ? (
              <p className="pc-bio">{bio}</p>
            ) : loaded ? (
              <p className="pc-bio pc-bio-empty">{isMe ? "Add a short bio in your profile." : "No bio yet."}</p>
            ) : (
              <p className="pc-bio pc-bio-empty">&nbsp;</p>
            )}
            {actions && <div className="pc-actions">{actions}</div>}
          </div>
        </div>
      </div>

      {reportInfo && <ReportDialog info={reportInfo} user={user} onClose={() => setReportInfo(null)} />}
      {blockInfo && (
        <BlockDialog
          person={blockInfo}
          onClose={() => setBlockInfo(null)}
          onConfirm={async (p) => {
            await blockPerson(p, communityId);
            onClose();
          }}
        />
      )}
    </>,
    document.body
  );
}
// src/components/profile/PeopleDialog.jsx  -  the Followers / Following list (opens from the numbers on a profile)
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { fetchFollowList } from "../../lib/profileData";
import { useLiveProfiles } from "../../lib/publicProfile";
import { useFeed } from "../feed/FeedContext";
import Avatar from "../feed/Avatar";
import { CloseIcon } from "../feed/Icons";

export default function PeopleDialog({ uid, kind, name, onClose }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    setRows(null);
    setFailed(false);
    fetchFollowList(uid, kind)
      .then((l) => !off && setRows(l.filter((x) => !feed.blocked.has(x.uid))))
      .catch(() => !off && (setFailed(true), setRows([])));
    return () => {
      off = true;
    };
  }, [uid, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const uids = useMemo(() => (rows || []).map((r) => r.uid), [rows]);
  const profiles = useLiveProfiles(uids);
  const title = kind === "followers" ? "Followers" : "Following";
  const go = (u) => {
    onClose();
    navigate(u === feed.me ? "/profile" : `/u/${u}`);
  };

  return createPortal(
    <div className="fd-modal-back" onClick={onClose}>
      <div className="fd-modal fd-people-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-ppl-title" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-head">
          <h2 id="fd-ppl-title">{title}{name ? <span className="fd-ppl-of"> · {name}</span> : null}</h2>
          <button type="button" className="fd-icon-btn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="fd-ppl-body">
          {rows === null ? (
            <p className="fd-end">Loading…</p>
          ) : failed ? (
            <p className="fd-muted fd-ppl-empty">Couldn't load this list. Try again in a moment.</p>
          ) : rows.length === 0 ? (
            <p className="fd-muted fd-ppl-empty">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
          ) : (
            <ul className="fd-ppl">
              {rows.map((r) => {
                const p = profiles[r.uid];
                const nm = p?.displayName || "Member";
                const mine = r.uid === feed.me;
                const following = feed.following.has(r.uid);
                return (
                  <li key={r.uid}>
                    <button type="button" className="fd-ppl-main" onClick={() => go(r.uid)}>
                      <Avatar name={nm} photo={p?.photoURL || ""} size={42} />
                      <span className="fd-li-main"><strong>{nm}</strong>{p?.handle ? <em>@{p.handle}</em> : null}</span>
                    </button>
                    {!mine && (
                      <button type="button" className={`fd-btn ${following ? "" : "primary"}`} onClick={() => feed.toggleFollow(r.uid)}>
                        {following ? "Following" : "Follow"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
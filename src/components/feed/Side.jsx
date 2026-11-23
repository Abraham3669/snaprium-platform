// src/components/feed/Side.jsx
// Circles strip (phone) and the right column (computer): your circles, topics, questions waiting, circles to discover.
import SearchBox from "./SearchBox";
import { useEffect, useMemo, useRef, useState } from "react";
import useStickyColumn from "../../lib/useStickyColumn";
import { useNavigate } from "react-router-dom";
import { listMyCommunities, listPublicCommunities } from "../../lib/communities";
import { circleCardPath, circleChatPath, rememberCircle } from "../../lib/circleNav";
import { TOPICS, topicFromCircleTag } from "../../lib/topics";
import { waitingQuestions } from "../../lib/feedRank";
import Avatar from "./Avatar";
import { PlusIcon } from "./Icons";
import { useFeed } from "./FeedContext";
import { GuestBanner } from "./SignInGate";

export function useMyCircles(uid) {
  const [circles, setCircles] = useState(null);
  useEffect(() => {
    if (!uid) {
      setCircles([]);
      return undefined;
    }
    let off = false;
    listMyCommunities(uid)
      .then((l) => !off && setCircles(l.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))))
      .catch(() => !off && setCircles([]));
    return () => {
      off = true;
    };
  }, [uid]);
  return circles;
}

export function CirclesStrip({ uid, circles }) {
  const navigate = useNavigate();
  const go = (c) => {
    rememberCircle(uid, c.id);
    navigate(circleChatPath(c.id));
  };
  return (
    <div className="fd-strip" role="list" aria-label="Your circles">
      <button type="button" className="fd-strip-item" role="listitem" onClick={() => navigate("/community")}>
        <span className="fd-strip-new"><PlusIcon /></span>
        <span>Circles</span>
      </button>
      {(circles || []).map((c) => (
        <button type="button" className="fd-strip-item" role="listitem" key={c.id} onClick={() => go(c)}>
          <Avatar name={c.name} photo={c.photoUrl && c.photoUrl.length < 60000 ? c.photoUrl : ""} size={52} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export function RightColumn({ uid, circles, pool }) {
  const sideRef = useRef(null);
  useStickyColumn(sideRef);
  const navigate = useNavigate();
  const feed = useFeed();
  const [discover, setDiscover] = useState([]);

  useEffect(() => {
    let off = false;
    listPublicCommunities()
      .then((l) => !off && setDiscover(l))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const mineIds = useMemo(() => new Set((circles || []).map((c) => c.id)), [circles]);
  const suggest = useMemo(() => {
    const want = new Set((circles || []).map((c) => topicFromCircleTag(c.tag)).filter(Boolean));
    return discover
      .filter((c) => !mineIds.has(c.id))
      .sort((a, b) => Number(want.has(topicFromCircleTag(b.tag))) - Number(want.has(topicFromCircleTag(a.tag))) || (b.memberCount || 0) - (a.memberCount || 0))
      .slice(0, 3);
  }, [discover, mineIds, circles]);

  const waiting = useMemo(() => waitingQuestions(pool, { me: uid, blocked: feed.blocked, hidden: feed.prefs.hidden }, 3), [pool, uid, feed.blocked, feed.prefs.hidden]);

  return (
    <aside className="fd-side" aria-label="More" ref={sideRef}>
      <SearchBox className="side" />
      {feed.guest && <GuestBanner />}
      {!feed.guest && (
      <section className="fd-panel">
        <h3>Your circles</h3>
        {circles === null ? (
          <p className="fd-muted">Loading…</p>
        ) : circles.length === 0 ? (
          <p className="fd-muted">You haven't joined a circle yet.</p>
        ) : (
          <ul className="fd-list">
            {circles.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => { rememberCircle(uid, c.id); navigate(circleChatPath(c.id)); }}>
                  <Avatar name={c.name} photo={c.photoUrl && c.photoUrl.length < 60000 ? c.photoUrl : ""} size={32} />
                  <span className="fd-li-main"><strong>{c.name}</strong><em>{c.memberCount || 1} member{(c.memberCount || 1) === 1 ? "" : "s"}</em></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="fd-link" onClick={() => navigate("/community")}>Explore circles</button>
      </section>
      )}

      {!feed.guest && (
      <section className="fd-panel">
        <h3>Topics you follow</h3>
        <div className="fd-chips">
          {TOPICS.map((t) => (
            <button key={t.id} type="button" aria-pressed={feed.prefs.topics.has(t.id)} className={`fd-chip small ${feed.prefs.topics.has(t.id) ? "on" : ""}`} onClick={() => feed.prefs.toggleTopic(t.id).catch(() => {})}>
              {t.label}
            </button>
          ))}
        </div>
      </section>
      )}

      {waiting.length > 0 && (
        <section className="fd-panel">
          <h3>Waiting for an answer</h3>
          <ul className="fd-list">
            {waiting.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate(`/post/${p.id}`)}>
                  <span className="fd-li-main"><strong className="clamp2">{p.text}</strong><em>{p.replyCount ? `${p.replyCount} repl${p.replyCount === 1 ? "y" : "ies"}` : "No replies yet"}</em></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggest.length > 0 && (
        <section className="fd-panel">
          <h3>Circles to join</h3>
          <ul className="fd-list">
            {suggest.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate(circleCardPath(c, false))}>
                  <Avatar name={c.name} photo={c.photoUrl && c.photoUrl.length < 60000 ? c.photoUrl : ""} size={32} />
                  <span className="fd-li-main"><strong>{c.name}</strong><em>{c.tag} · {c.memberCount || 1} member{(c.memberCount || 1) === 1 ? "" : "s"}</em></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
// src/pages/FeedHome.jsx  -  the main screen for signed-in people.
// Tabs: For you (ranked) / Following (newest first) / Questions (people waiting for help) / Saved.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankFeed } from "../lib/feedRank";
import {
  countNewerPosts,
  fetchCandidates,
  fetchOlder,
  fetchPostsByIds,
  readInteracted,
  readSeen,
} from "../lib/feed";
import { useLiveProfiles } from "../lib/publicProfile";
import { TOPICS } from "../lib/topics";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import PostCard from "../components/feed/PostCard";
import Composer from "../components/feed/Composer";
import Avatar from "../components/feed/Avatar";
import { ImageIcon } from "../components/feed/Icons";
import { LeftRail, NativeFab, PhoneBar } from "../components/feed/FeedNav";
import { CirclesStrip, RightColumn, useMyCircles } from "../components/feed/Side";
import "../styles/feed.css";

const PAGE = 10;
const TABS = [
  { id: "foryou", label: "For you" },
  { id: "following", label: "Following" },
  { id: "questions", label: "Questions" },
  { id: "saved", label: "Saved" },
];
const ONBOARD_KEY = "snaprium_feed_onboard_v1";
// Switched off for now (there are not enough posts yet). Set to true to bring the "Pick topics you like" row back.
const SHOW_TOPIC_NUDGE = false;

export function FeedSkeleton() {
  return (
    <div className="fd-page">
      <div className="fd-main" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div className="fd-card fd-skel" key={i}>
            <div className="sk-row"><i className="sk-av" /><i className="sk-line w40" /></div>
            <i className="sk-line w90" /><i className="sk-line w75" /><i className="sk-line w50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Inner({ unread, social }) {
  const feed = useFeed();
  const { me, user } = feed;
  const circles = useMyCircles(me);

  const [tab, setTab] = useState("foryou");
  const [pool, setPool] = useState([]);
  const [order, setOrder] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [composer, setComposer] = useState(null); // null | kind
  const [local, setLocal] = useState([]); // posts I just wrote
  const [removed, setRemoved] = useState(() => new Set());
  const [onboard, setOnboard] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const latest = useRef({});
  latest.current = { feed, tab };
  const loadedAt = useRef(0);
  const reqId = useRef(0);
  const ready = feed.followReady && feed.prefs.ready;

  const buildCtx = useCallback((mode, seed) => {
    const f = latest.current.feed;
    return {
      me: f.me,
      mode,
      now: Date.now(),
      seed,
      following: f.following,
      topics: f.prefs.topics,
      blocked: f.blocked,
      hidden: f.prefs.hidden,
      seen: readSeen(),
      interacted: readInteracted(),
    };
  }, []);

  const load = useCallback(
    async (mode) => {
      const id = ++reqId.current;
      setStatus("loading");
      setShown(PAGE);
      setFresh(0);
      setRemoved(new Set());
      try {
        const f = latest.current.feed;
        if (mode === "saved") {
          const posts = await fetchPostsByIds([...f.saved.order]);
          if (id !== reqId.current) return;
          setPool(posts);
          setOrder(posts.filter((p) => !f.blocked.has(p.uid)).map((p) => p.id));
          setCursor(null);
          setDone(true);
        } else if (mode === "following" && f.following.size === 0) {
          if (id !== reqId.current) return;
          setPool([]);
          setOrder([]);
          setCursor(null);
          setDone(true);
        } else {
          const res = await fetchCandidates({ following: [...f.following], topics: [...f.prefs.topics], mode });
          if (id !== reqId.current) return;
          if (res.failed) throw new Error("load failed");
          const ranked = rankFeed(res.posts, buildCtx(mode, Date.now() % 100000));
          setPool(res.posts);
          setOrder(ranked.map((p) => p.id));
          setCursor(res.cursor);
          setDone(mode !== "foryou" || !res.cursor);
        }
        loadedAt.current = Date.now();
        setStatus("ready");
      } catch (err) {
        if (id !== reqId.current) return;
        console.warn("[feed]", err?.message || err);
        setStatus("error");
      }
    },
    [buildCtx]
  );

  // First load, and every time the tab changes (once my follows and topics are known).
  useEffect(() => {
    if (!ready || !me) return;
    load(tab);
  }, [ready, me, tab, load]);

  // "N new posts" pill
  useEffect(() => {
    if (!ready || !me || (tab !== "foryou" && tab !== "following")) return undefined;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible" || status !== "ready") return;
      const n = await countNewerPosts(loadedAt.current, me);
      setFresh(n);
    }, 60000);
    return () => clearInterval(t);
  }, [ready, me, tab, status]);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const localIds = useMemo(() => new Set(local.map((p) => p.id)), [local]);
  const visible = useMemo(() => {
    const list = order
      .map((id) => byId.get(id))
      .filter((p) => p && !removed.has(p.id) && !localIds.has(p.id) && !feed.prefs.hidden.has(p.id) && !feed.blocked.has(p.uid))
      .filter((p) => tab !== "saved" || feed.saved.ids.has(p.id));
    const mineFirst = tab === "foryou" ? local.filter((p) => !removed.has(p.id)) : [];
    return [...mineFirst, ...list];
  }, [order, byId, removed, localIds, local, tab, feed.prefs.hidden, feed.blocked, feed.saved.ids]);

  const page = visible.slice(0, shown);
  const profiles = useLiveProfiles(useMemo(() => page.map((p) => p.uid), [page]));
  const pageIds = page.map((p) => p.id).join(",");
  useEffect(() => {
    feed.loadSparks(pageIds ? pageIds.split(",") : []);
  }, [pageIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const showMore = async () => {
    if (shown < visible.length) {
      setShown((s) => s + PAGE);
      return;
    }
    if (tab !== "foryou" || !cursor || done || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetchOlder({ cursor });
      const known = new Set(pool.map((p) => p.id));
      const fresh2 = r.posts.filter((p) => !known.has(p.id));
      const ranked = rankFeed(fresh2, buildCtx("foryou", Date.now() % 100000));
      setPool((p) => [...p, ...fresh2]);
      setOrder((o) => [...o, ...ranked.map((p) => p.id)]);
      setCursor(r.cursor);
      if (r.done || !fresh2.length) setDone(true);
      setShown((s) => s + PAGE);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = shown < visible.length || (tab === "foryou" && !!cursor && !done);
  const remove = useCallback((id) => setRemoved((r) => new Set(r).add(id)), []);
  const refresh = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    load(tab);
  };
  const posted = (p) => setLocal((l) => [p, ...l]);

  const needsTopics = SHOW_TOPIC_NUDGE && onboard && ready && feed.prefs.topics.size === 0 && tab === "foryou";

  // A small, skippable row of topics. It sits after the first few posts (never first), and the Topics panel on the
  // right (computers) always lets you change them later.
  const closeNudge = () => {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboard(false);
  };
  const nudge = (
    <section className="fd-nudge" aria-label="Choose topics">
      <div className="fd-nudge-head">
        <strong>Pick topics you like</strong>
        <button type="button" className="fd-icon-btn" aria-label="Dismiss" onClick={closeNudge}>×</button>
      </div>
      <div className="fd-nudge-row">
        {TOPICS.map((t) => (
          <button key={t.id} type="button" aria-pressed={feed.prefs.topics.has(t.id)} className={`fd-chip small ${feed.prefs.topics.has(t.id) ? "on" : ""}`} onClick={() => feed.prefs.toggleTopic(t.id).catch(() => {})}>
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="fd-page">
      <LeftRail uid={me} unread={unread} social={social} onCompose={() => setComposer("insight")} />

      <div className="fd-main" id="feed-main">
        <div className="fd-only-small">
          <CirclesStrip uid={me} circles={circles || []} />
        </div>

        <div className="fd-prompt">
          <Avatar name={user?.displayName} photo={user?.photoURL && user.photoURL.length < 400 ? user.photoURL : ""} size={42} />
          <button type="button" className="fd-prompt-input" onClick={() => setComposer("insight")}>
            What are you learning today?
          </button>
          <button type="button" className="fd-icon-btn" aria-label="Add a picture" onClick={() => setComposer("log")}><ImageIcon /></button>
          <button type="button" className="fd-btn primary" onClick={() => setComposer("question")}>Ask</button>
        </div>

        <div className="fd-tabs" role="tablist" aria-label="Feed">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`fd-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {fresh > 0 && (
          <button type="button" className="fd-newpill" onClick={refresh}>
            {fresh} new post{fresh === 1 ? "" : "s"}
          </button>
        )}

        {(!ready || status === "loading") && visible.length === 0 ? (
          <div aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div className="fd-card fd-skel" key={i}>
                <div className="sk-row"><i className="sk-av" /><i className="sk-line w40" /></div>
                <i className="sk-line w90" /><i className="sk-line w75" /><i className="sk-line w50" />
              </div>
            ))}
          </div>
        ) : status === "error" && visible.length === 0 ? (
          <div className="fd-empty">
            <strong>Couldn't load the feed</strong>
            <p>Check your connection and try again.</p>
            <button type="button" className="fd-btn primary" onClick={() => load(tab)}>Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <Empty tab={tab} onCompose={() => setComposer(tab === "questions" ? "question" : "insight")} goForYou={() => setTab("foryou")} />
        ) : (
          <>
            {page.map((p, i) => (
              <Fragment key={p.id}>
                <PostCard post={p} profile={profiles[p.uid]} onRemoved={remove} trackSeen />
                {i === 2 && needsTopics && nudge}
              </Fragment>
            ))}
            {page.length > 0 && page.length < 3 && needsTopics && nudge}
            {hasMore && (
              <button type="button" className="fd-showmore" onClick={showMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            )}
            {!hasMore && <p className="fd-end">You're all caught up</p>}
          </>
        )}
      </div>

      <RightColumn uid={me} circles={circles} pool={pool} />
      <PhoneBar uid={me} social={social} onCompose={() => setComposer("insight")} />
      <NativeFab onCompose={() => setComposer("insight")} />
      {composer && <Composer user={user} defaultKind={composer} onClose={() => setComposer(null)} onPosted={posted} />}
    </div>
  );
}

function Empty({ tab, onCompose, goForYou }) {
  if (tab === "following")
    return (
      <div className="fd-empty">
        <strong>Nothing from people you follow yet</strong>
        <p>Follow people from their posts and their newest posts will show up here, in order.</p>
        <button type="button" className="fd-btn primary" onClick={goForYou}>See For you</button>
      </div>
    );
  if (tab === "saved")
    return (
      <div className="fd-empty">
        <strong>Nothing saved yet</strong>
        <p>Tap the bookmark on a post to keep it here.</p>
      </div>
    );
  if (tab === "questions")
    return (
      <div className="fd-empty">
        <strong>No questions right now</strong>
        <p>Stuck on something? Ask and people can help.</p>
        <button type="button" className="fd-btn primary" onClick={onCompose}>Ask a question</button>
      </div>
    );
  return (
    <div className="fd-empty">
      <strong>The feed is waiting for its first post</strong>
      <p>Share something you learned or ask a question.</p>
      <button type="button" className="fd-btn primary" onClick={onCompose}>Write a post</button>
    </div>
  );
}

export default function FeedHome({ user, unread = 0, social = 0 }) {
  return (
    <FeedProvider user={user}>
      <Inner unread={unread} social={social} />
    </FeedProvider>
  );
}
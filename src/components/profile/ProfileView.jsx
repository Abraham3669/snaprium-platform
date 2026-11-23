// src/components/profile/ProfileView.jsx  -  one profile, seen by its owner (isMe) or by anyone else.
//
// Header: banner, photo, name, @username, bio, numbers (Posts / Followers / Following), the buttons.
// Tabs:   Posts | Replies | Saved (only you) | Circles. Account things live behind the "⋯" menu (you) and /settings.
// Must be rendered inside <FeedProvider>.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPostsBy, fetchPostsByIds } from "../../lib/feed";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, useFriendship, useFriendships } from "../../lib/friends";
import { useInbox } from "../../lib/dms";
import { timeAgo } from "../../lib/feedRank";
import { fetchCirclesOf, fetchRepliesBy } from "../../lib/profileData";
import { fetchProfileCard, useLiveProfiles } from "../../lib/publicProfile";
import { circleCardPath } from "../../lib/circleNav";
import LinkedText, { clampText } from "../../lib/linkify";
import { useFeed } from "../feed/FeedContext";
import PostCard from "../feed/PostCard";
import Avatar from "../feed/Avatar";
import ProfileStats from "../feed/ProfileStats";
import PeopleDialog from "./PeopleDialog";
import ProfileMenu from "./ProfileMenu";
import { SparkIcon } from "../feed/Icons";
import "../../styles/feed.css";

const TAB_LABEL = { posts: "Posts", replies: "Replies", saved: "Saved", circles: "Circles" };

function FriendButton({ uid }) {
  const feed = useFeed();
  const { status } = useFriendship(feed.me, uid);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    if (feed.requireAuth("default")) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.warn("[friend]", e?.code || e?.message || e);
    } finally {
      setBusy(false);
    }
  };
  if (status === "friends") return <button type="button" className="fd-btn" disabled={busy} onClick={() => run(() => removeFriendship(feed.me, uid))} title="Tap to remove from friends">Friends ✓</button>;
  if (status === "sent") return <button type="button" className="fd-btn" disabled={busy} onClick={() => run(() => removeFriendship(feed.me, uid))} title="Tap to cancel">Requested</button>;
  if (status === "received") return <button type="button" className="fd-btn primary" disabled={busy} onClick={() => run(() => acceptFriendRequest(feed.user, uid))}>Accept friend</button>;
  return <button type="button" className="fd-btn" disabled={busy} onClick={() => run(() => sendFriendRequest(feed.user, uid))}>Add friend</button>;
}

function OwnerRow() {
  const feed = useFeed();
  const navigate = useNavigate();
  const { incoming, friends } = useFriendships(feed.me);
  const { unread } = useInbox(feed.me);
  return (
    <div className="pv-social">
      <button type="button" className="pv-chip" onClick={() => navigate("/friends")}>
        <strong>Friends</strong>
        <span>{friends.length}</span>
        {incoming.length > 0 && <i className="pv-dot" aria-label={`${incoming.length} new requests`}>{incoming.length}</i>}
      </button>
      <button type="button" className="pv-chip" onClick={() => navigate("/messages")}>
        <strong>Messages</strong>
        {unread > 0 && <i className="pv-dot" aria-label={`${unread} unread`}>{unread}</i>}
      </button>
    </div>
  );
}

function Empty({ title, text, action, onAction }) {
  return (
    <div className="fd-empty">
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action && <button type="button" className="fd-btn primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

function PostsPanel({ uid, isMe, profiles }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let off = false;
    setPosts([]);
    setDone(false);
    setFailed(false);
    setLoading(true);
    fetchPostsBy(uid)
      .then((r) => {
        if (off) return;
        setPosts(r.posts);
        setCursor(r.cursor);
        setDone(r.done);
      })
      .catch(() => !off && setFailed(true))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [uid, attempt]);

  const ids = posts.map((p) => p.id).join(",");
  useEffect(() => {
    feed.loadSparks(ids ? ids.split(",") : []);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = async () => {
    setLoading(true);
    try {
      const r = await fetchPostsBy(uid, 30, cursor);
      setPosts((p) => [...p, ...r.posts]);
      setCursor(r.cursor);
      setDone(r.done);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} profile={profiles[uid]} onRemoved={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
      ))}
      {!loading && failed && (
        <div className="fd-empty"><strong>Couldn't load posts</strong><p>Check your connection and try again.</p><button type="button" className="fd-btn primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>
      )}
      {!loading && !failed && posts.length === 0 && (
        <Empty title={isMe ? "You haven't posted yet" : "No posts yet"} text={isMe ? "Share something you learned or ask a question." : ""} action={isMe ? "Go to the feed" : ""} onAction={() => navigate("/")} />
      )}
      {loading && <p className="fd-end">Loading…</p>}
      {!loading && !done && posts.length > 0 && <button type="button" className="fd-showmore" onClick={more}>Show more</button>}
    </>
  );
}

function RepliesPanel({ uid, isMe, profiles: owner }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(undefined); // undefined = loading, null = could not load
  useEffect(() => {
    let off = false;
    setRows(undefined);
    fetchRepliesBy(uid).then((r) => !off && setRows(r));
    return () => {
      off = true;
    };
  }, [uid]);
  const authors = useLiveProfiles(useMemo(() => (rows || []).map((r) => r.post.uid), [rows]));

  if (rows === undefined) return <p className="fd-end">Loading…</p>;
  if (rows === null) return <Empty title="Couldn't load replies" text="Check your connection and try again." />;
  if (!rows.length) return <Empty title={isMe ? "You haven't replied yet" : "No replies yet"} text={isMe ? "Answer a question or join a conversation and it will show up here." : ""} />;
  return (
    <ul className="pv-replies">
      {rows.map((r) => {
        const a = authors[r.post.uid];
        const who = a?.handle ? `@${a.handle}` : a?.displayName || r.post.authorName || "a member";
        return (
          <li key={r.id}>
            <button type="button" className="pv-reply" onClick={() => navigate(`/post/${r.postId}`)}>
              <span className="fd-replying">Replying to <strong>{who}</strong></span>
              <span className="pv-reply-post">{clampText(r.post.text || "", 110)}</span>
              <span className="pv-reply-text"><LinkedText text={clampText(r.text, 280)} /></span>
              <span className="fd-meta">
                {owner[uid]?.handle ? `@${owner[uid].handle} · ` : ""}{timeAgo(r.createdAt)}
                {(r.sparkCount || 0) > 0 && <span className="pv-spk"><SparkIcon filled /> {r.sparkCount}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SavedPanel({ profiles }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(undefined);
  const order = feed.saved.order;
  const key = order.join(",");
  useEffect(() => {
    let off = false;
    fetchPostsByIds(order).then((l) => !off && setPosts(l));
    return () => {
      off = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const authors = useLiveProfiles(useMemo(() => (posts || []).map((p) => p.uid), [posts]));
  const ids = (posts || []).map((p) => p.id).join(",");
  useEffect(() => {
    feed.loadSparks(ids ? ids.split(",") : []);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  if (posts === undefined) return <p className="fd-end">Loading…</p>;
  if (!posts.length) return <Empty title="Nothing saved yet" text="Tap the bookmark on a post to keep it here. Only you can see this." action="Go to the feed" onAction={() => navigate("/")} />;
  return posts.filter((p) => !feed.blocked.has(p.uid)).map((p) => <PostCard key={p.id} post={p} profile={authors[p.uid] || profiles[p.uid]} />);
}

function CirclesPanel({ uid, isMe }) {
  const navigate = useNavigate();
  const [list, setList] = useState(undefined);
  useEffect(() => {
    let off = false;
    setList(undefined);
    fetchCirclesOf(uid, isMe).then((l) => !off && setList(l));
    return () => {
      off = true;
    };
  }, [uid, isMe]);
  if (list === undefined) return <p className="fd-end">Loading…</p>;
  if (!list.length) return <Empty title={isMe ? "You haven't joined a circle yet" : "No public circles"} text={isMe ? "Circles are small groups of people learning the same thing." : ""} action={isMe ? "Explore circles" : ""} onAction={() => navigate("/community")} />;
  return (
    <ul className="fd-people pv-circles">
      {list.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => navigate(circleCardPath(c, isMe))}>
            <Avatar name={c.name} photo={c.photoUrl && c.photoUrl.length < 60000 ? c.photoUrl : ""} size={44} />
            <span className="fd-li-main"><strong>{c.name}</strong><em>{c.memberCount || 1} member{(c.memberCount || 1) === 1 ? "" : "s"}{c.tag ? ` · ${c.tag}` : ""}</em></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ProfileView({ uid, isMe }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [card, setCard] = useState(undefined);
  const [tab, setTab] = useState("posts");
  const [statsKey, setStatsKey] = useState(0);
  const [people, setPeople] = useState(""); // "" | "followers" | "following"
  const profiles = useLiveProfiles(useMemo(() => [uid], [uid]));

  useEffect(() => {
    let off = false;
    setCard(undefined);
    setTab("posts");
    fetchProfileCard(uid).then((c) => !off && setCard(c));
    return () => {
      off = true;
    };
  }, [uid]);

  const tabs = isMe ? ["posts", "replies", "saved", "circles"] : ["posts", "replies", "circles"];
  const name = profiles[uid]?.displayName || card?.displayName || (isMe ? feed.meInfo.displayName : "") || "Member";
  const photo = profiles[uid]?.photoURL || card?.photoURL || (isMe && feed.user?.photoURL && feed.user.photoURL.length < 400 ? feed.user.photoURL : "");
  const handle = profiles[uid]?.handle || card?.handle || "";
  const following = feed.following.has(uid);

  return (
    <>
      <section className="fd-card pv-head">
        {card?.banner ? <img className="fd-banner" src={card.banner} alt="" /> : <div className="fd-banner empty" />}
        <div className="pv-top">
          <Avatar name={name} photo={photo} size={76} />
          <div className="pv-actions">
            {isMe ? (
              <>
                <button type="button" className="fd-btn" onClick={() => navigate("/settings")}>Edit profile</button>
                <ProfileMenu onSaved={() => setTab("saved")} />
              </>
            ) : (
              <>
                <button type="button" className="fd-btn" onClick={() => { if (!feed.requireAuth("default")) navigate(`/messages/${uid}`); }}>Message</button>
                <FriendButton uid={uid} />
                <button
                  type="button"
                  className={`fd-btn ${following ? "" : "primary"}`}
                  onClick={async () => {
                    await feed.toggleFollow(uid);
                    if (feed.me) setStatsKey((k) => k + 1);
                  }}
                >
                  {following ? "Following" : "Follow"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="pv-body">
          <h1 className="pv-name">{name}</h1>
          {handle ? <p className="fd-handle">@{handle}</p> : isMe ? <button type="button" className="fd-link" onClick={() => navigate("/settings")}>Choose a username</button> : null}
          {card?.bio && <p className="fd-bio">{card.bio}</p>}
          <ProfileStats uid={uid} refreshKey={statsKey} onOpen={setPeople} />
          {isMe && <OwnerRow />}
        </div>
        <div className="pv-tabs" role="tablist" aria-label="Profile">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`pv-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </section>

      <div className="pv-panel" role="tabpanel">
        {tab === "posts" && <PostsPanel uid={uid} isMe={isMe} profiles={profiles} />}
        {tab === "replies" && <RepliesPanel uid={uid} isMe={isMe} profiles={profiles} />}
        {tab === "saved" && isMe && <SavedPanel profiles={profiles} />}
        {tab === "circles" && <CirclesPanel uid={uid} isMe={isMe} />}
      </div>

      {people && <PeopleDialog uid={uid} kind={people} name={isMe ? "" : name} onClose={() => setPeople("")} />}
    </>
  );
}
// src/pages/AuthorPage.jsx  -  a person's public posts (/u/:uid)
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPostsBy } from "../lib/feed";
import { looksLikeHandle, resolveHandle } from "../lib/handles";
import { fetchProfileCard, useLiveProfiles } from "../lib/publicProfile";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import PostCard from "../components/feed/PostCard";
import Avatar from "../components/feed/Avatar";
import ProfileStats from "../components/feed/ProfileStats";
import { BackIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

function Inner({ uid }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [card, setCard] = useState(undefined);
  const [statsKey, setStatsKey] = useState(0);
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const mine = uid === feed.me;
  const isBlocked = feed.blocked.has(uid);

  useEffect(() => {
    let off = false;
    setCard(undefined);
    setPosts([]);
    setDone(false);
    setLoading(true);
    fetchProfileCard(uid).then((c) => !off && setCard(c));
    fetchPostsBy(uid)
      .then((r) => {
        if (off) return;
        setPosts(r.posts);
        setCursor(r.cursor);
        setDone(r.done);
      })
      .catch(() => {})
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [uid]);

  const profiles = useLiveProfiles(useMemo(() => [uid], [uid]));
  const ids = posts.map((p) => p.id).join(",");
  useEffect(() => {
    feed.loadSparks(ids ? ids.split(",") : []);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const following = feed.following.has(uid);
  const name = profiles[uid]?.displayName || card?.displayName || "Member";
  const photo = profiles[uid]?.photoURL || card?.photoURL || "";
  const handle = profiles[uid]?.handle || card?.handle || "";

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
    <div className="fd-page single">
      <div className="fd-main">
        <button type="button" className="fd-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}><BackIcon /> Back</button>
        {isBlocked ? (
          <div className="fd-empty"><strong>You blocked this person</strong><p>Unblock them in Profile, Blocked users, to see their posts.</p></div>
        ) : (
          <>
            <section className="fd-card fd-author">
              {card?.banner ? <img className="fd-banner" src={card.banner} alt="" /> : <div className="fd-banner empty" />}
              <div className="fd-author-row">
                <Avatar name={name} photo={photo} size={72} />
                <div className="fd-author-main">
                  <h1>{name}</h1>
                  {handle && <p className="fd-handle">@{handle}</p>}
                  {card?.bio && <p className="fd-bio">{card.bio}</p>}
                  <ProfileStats uid={uid} refreshKey={statsKey} />
                </div>
                {mine ? (
                  <button type="button" className="fd-btn" onClick={() => navigate("/profile")}>Edit profile</button>
                ) : (
                  <button type="button" className={`fd-btn ${following ? "" : "primary"}`} onClick={async () => {
                    await feed.toggleFollow(uid);
                    if (feed.me) setStatsKey((k) => k + 1);
                  }}>
                    {following ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </section>
            <h2 className="fd-h2">Posts</h2>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} profile={profiles[uid]} onRemoved={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
            ))}
            {!loading && posts.length === 0 && <div className="fd-empty"><strong>No posts yet</strong></div>}
            {loading && <p className="fd-end">Loading…</p>}
            {!loading && !done && <button type="button" className="fd-showmore" onClick={more}>Show more</button>}
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthorPage() {
  const { uid: param } = useParams();
  const { user, loading } = useAuth();
  // /u/<account id> or /u/<username>. A username is looked up first.
  const isName = looksLikeHandle(param);
  const [target, setTarget] = useState(isName ? undefined : param);
  useEffect(() => {
    let off = false;
    if (!isName) return setTarget(param);
    setTarget(undefined);
    resolveHandle(param)
      .then(async (u) => {
        if (u) return u;
        // Not a username: maybe a short account id that has a public card.
        return (await fetchProfileCard(param)) ? param : "";
      })
      .then((u) => !off && setTarget(u || ""));
    return () => {
      off = true;
    };
  }, [param, isName]);

  // Signed-out visitors can look at a profile and its posts; Follow asks them to sign in.
  if ((loading && !user) || target === undefined) return <FeedSkeleton />;
  return (
    <FeedProvider user={user || null}>
      {target ? (
        <Inner uid={target} />
      ) : (
        <div className="fd-page single">
          <div className="fd-main">
            <div className="fd-empty"><strong>No one has that username</strong><p>Check the spelling, or search for the person.</p></div>
          </div>
        </div>
      )}
    </FeedProvider>
  );
}
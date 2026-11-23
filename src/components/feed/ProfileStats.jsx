// src/components/feed/ProfileStats.jsx
// "12 Posts · 340 Followers · 58 Following" for a profile (yours or someone else's).
// Posts are public, so everyone sees that count. Followers and Following are for signed-in people.
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { countFollowers, countFollowing, countPosts } from "../../lib/feed";
import "../../styles/feed.css";

export const compactCount = (n) => {
  if (n === null || n === undefined) return "";
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1000000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
};

export default function ProfileStats({ uid, refreshKey = 0 }) {
  const { user } = useAuth();
  const signedIn = !!user?.uid;
  const [stats, setStats] = useState({ posts: null, followers: null, following: null });

  useEffect(() => {
    if (!uid) return undefined;
    let off = false;
    setStats({ posts: null, followers: null, following: null });
    countPosts(uid).then((n) => !off && setStats((s) => ({ ...s, posts: n })));
    if (signedIn) {
      countFollowers(uid).then((n) => !off && setStats((s) => ({ ...s, followers: n })));
      countFollowing(uid).then((n) => !off && setStats((s) => ({ ...s, following: n })));
    }
    return () => {
      off = true;
    };
  }, [uid, signedIn, refreshKey]);

  const item = (key, n, one, many) =>
    n === null ? null : (
      <span className="fd-stat" key={key}>
        <strong>{compactCount(n)}</strong> {n === 1 ? one : many}
      </span>
    );

  const parts = [item("p", stats.posts, "Post", "Posts"), item("f", stats.followers, "Follower", "Followers"), item("g", stats.following, "Following", "Following")].filter(Boolean);
  if (!parts.length) return <div className="fd-stats" aria-hidden="true" />;
  return <div className="fd-stats">{parts}</div>;
}
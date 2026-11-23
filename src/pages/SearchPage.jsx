// src/pages/SearchPage.jsx  -  /search?q=...   People (by username or name) and posts (from recent posts)
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchCandidates } from "../lib/feed";
import { topicLabel } from "../lib/topics";
import { recentPostPool, searchPeople } from "../lib/handles";
import { useLiveProfiles } from "../lib/publicProfile";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import PostCard from "../components/feed/PostCard";
import Avatar from "../components/feed/Avatar";
import SearchBox from "../components/feed/SearchBox";
import { BackIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

const norm = (s) => String(s || "").toLowerCase();

function Inner() {
  const feed = useFeed();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const [people, setPeople] = useState(null); // null = looking
  const [pool, setPool] = useState(null);
  const [removed, setRemoved] = useState(() => new Set());

  useEffect(() => {
    let off = false;
    setPeople(null);
    if (q.replace(/^@/, "").length < 2) {
      setPeople([]);
      return undefined;
    }
    const t = setTimeout(() => {
      searchPeople(q)
        .then((l) => !off && setPeople(l))
        .catch(() => !off && setPeople([]));
    }, 250);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    let off = false;
    recentPostPool(fetchCandidates)
      .then((l) => !off && setPool(l))
      .catch(() => !off && setPool([]));
    return () => {
      off = true;
    };
  }, []);

  const words = useMemo(() => norm(q.replace(/^@/, "")).split(/\s+/).filter(Boolean), [q]);
  const posts = useMemo(() => {
    if (!pool || !words.length || q.replace(/^@/, "").length < 2) return [];
    return pool
      .filter((p) => !removed.has(p.id) && !feed.blocked.has(p.uid))
      .filter((p) => {
        const hay = norm(`${p.text} ${p.authorName} ${(p.topics || []).map(topicLabel).join(" ")}`);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 30);
  }, [pool, words, q, removed, feed.blocked]);

  const uids = useMemo(() => [...(people || []).map((p) => p.uid), ...posts.map((p) => p.uid)], [people, posts]);
  const profiles = useLiveProfiles(uids);
  const ids = posts.map((p) => p.id).join(",");
  useEffect(() => {
    feed.loadSparks(ids ? ids.split(",") : []);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const tooShort = q.replace(/^@/, "").length < 2;

  return (
    <div className="fd-page single">
      <div className="fd-main">
        <button type="button" className="fd-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}><BackIcon /> Back</button>
        <SearchBox key={q} initial={q} autoFocus={!q} className="big" />

        {tooShort ? (
          <div className="fd-empty"><strong>Search Snaprium</strong><p>Type a username, a name, or something you want to learn about.</p></div>
        ) : (
          <>
            <h2 className="fd-h2">People</h2>
            {people === null ? (
              <p className="fd-end">Looking…</p>
            ) : people.length === 0 ? (
              <p className="fd-muted fd-search-none">No one found. People can be found by their username once they have chosen one.</p>
            ) : (
              <ul className="fd-people">
                {people.map((p) => {
                  const pr = profiles[p.uid];
                  const name = pr?.displayName || "Member";
                  return (
                    <li key={p.uid}>
                      <button type="button" onClick={() => navigate(p.uid === feed.me ? "/profile" : `/u/${p.handle}`)}>
                        <Avatar name={name} photo={pr?.photoURL || ""} size={44} />
                        <span className="fd-li-main"><strong>{name}</strong><em>@{pr?.handle || p.handle}</em></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="fd-h2">Posts</h2>
            {pool === null ? (
              <p className="fd-end">Looking…</p>
            ) : posts.length === 0 ? (
              <p className="fd-muted fd-search-none">No recent posts match "{q}".</p>
            ) : (
              <>
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} profile={profiles[p.uid]} onRemoved={(id) => setRemoved((s) => new Set(s).add(id))} />
                ))}
                <p className="fd-end">Searching the latest posts</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { user, loading } = useAuth();
  if (loading && !user) return <FeedSkeleton />;
  return (
    <FeedProvider user={user || null}>
      <Inner />
    </FeedProvider>
  );
}
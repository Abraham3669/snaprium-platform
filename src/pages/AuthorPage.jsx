// src/pages/AuthorPage.jsx  -  a person's public posts (/u/:uid)
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { looksLikeHandle, resolveHandle } from "../lib/handles";
import { fetchProfileCard } from "../lib/publicProfile";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import ProfileView from "../components/profile/ProfileView";
import { BackIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

function Inner({ uid }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const mine = uid === feed.me;
  const isBlocked = feed.blocked.has(uid);

  return (
    <div className="fd-page single">
      <div className="fd-main">
        <button type="button" className="fd-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}><BackIcon /> Back</button>
        {isBlocked ? (
          <div className="fd-empty"><strong>You blocked this person</strong><p>Unblock them in Settings, Blocked users, to see their posts.</p></div>
        ) : (
          <ProfileView uid={uid} isMe={mine} />
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
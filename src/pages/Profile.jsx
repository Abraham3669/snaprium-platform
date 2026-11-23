// src/pages/Profile.jsx  -  YOUR profile (/profile): header, numbers and tabs, the way other people see it, plus your own extras.
// Account settings (name, photo, banner, plan, alerts, delete) are on /settings, behind "Edit profile" and the "⋯" menu.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FeedProvider } from "../components/feed/FeedContext";
import ProfileView from "../components/profile/ProfileView";
import { BackIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Older links and notifications that still point here (?friends=1, ?dm=<person>) go on to their pages.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const dm = q.get("dm");
    if (dm) navigate(`/messages/${dm}`, { replace: true });
    else if (q.get("friends") === "1") navigate("/friends", { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return <FeedSkeleton />;
  return (
    <FeedProvider user={user}>
      <div className="fd-page single">
        <div className="fd-main">
          <button type="button" className="fd-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}><BackIcon /> Back</button>
          <ProfileView uid={user.uid} isMe />
        </div>
      </div>
    </FeedProvider>
  );
}
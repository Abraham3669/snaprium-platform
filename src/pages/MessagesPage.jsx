// src/pages/MessagesPage.jsx
//
// Friends and private chats as a real page, so a refresh, the back button and shared links all work.
//   /messages          conversation list
//   /messages/:uid     one conversation
//   /friends           the same page, opened on the Friends tab
//
// Wide PC (1100px+)   friend's profile | chat | conversations and friends
// PC (701px+)         chat | conversations and friends
// Phone / iPhone app  the list, then one chat at a time (back arrow returns to the list)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLiveProfiles } from "../lib/publicProfile";
import DmPanel from "../components/DmPanel";
import DmSidebar from "../components/DmSidebar";
import DmProfile from "../components/DmProfile";
import ProfileCard from "../components/ProfileCard";
import "../styles/community-chat.css";
import "../styles/dm.css";

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = (e) => setMatch(e.matches);
    setMatch(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return match;
}

export default function MessagesPage() {
  const { uid: other = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isPhone = useMedia("(max-width: 700px)");
  const wide = useMedia("(min-width: 1100px)");
  const [cardOpen, setCardOpen] = useState(false);
  const profiles = useLiveProfiles(other ? [other] : []);

  // Signed out: go to login (only once we know for sure, so a refresh never bounces you).
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  // A link to a chat with yourself is just the list.
  useEffect(() => {
    if (user?.uid && other && other === user.uid) navigate("/messages", { replace: true });
  }, [user?.uid, other, navigate]);

  useEffect(() => {
    setCardOpen(false);
  }, [other]);

  // Leave the Messages area: go back to where you came from, or Home if this page was opened directly.
  const leave = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };

  // Phone: list -> chat is a new history entry, so the phone's own back gesture returns to the list.
  // PC: switching chats replaces the entry, so the close button always leaves in one step.
  const openChat = (uid) => {
    if (!uid) return;
    if (isPhone) navigate(`/messages/${uid}`, { state: { fromList: true } });
    else navigate(`/messages/${uid}`, { replace: true });
  };

  const backToList = () => {
    if (location.state?.fromList) navigate(-1);
    else navigate("/messages", { replace: true });
  };

  if (loading || !user) {
    return createPortal(
      <div className="cc-frame dm-page no-chat">
        <p className="cc-muted">Loading…</p>
      </div>,
      document.body
    );
  }

  const withProfile = wide && !!other;
  const fallback = { name: profiles[other]?.displayName, photo: profiles[other]?.photoURL };
  const startTab = location.pathname.startsWith("/friends") ? "friends" : "chats";

  return createPortal(
    <div className={`cc-frame dm-page ${other ? "has-chat" : "no-chat"} ${withProfile ? "with-prof" : ""}`}>
      {withProfile && <DmProfile key={`p-${other}`} uid={other} fallback={fallback} user={user} />}

      <main className="dm-main">
        {other ? (
          <DmPanel
            key={other}
            other={other}
            fallback={fallback}
            onBack={backToList}
            onClose={leave}
            onOpenProfile={withProfile ? undefined : () => setCardOpen(true)}
          />
        ) : (
          <div className="dm-empty">
            <span className="cc-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" /></svg>
            </span>
            <strong>Your messages</strong>
            <p>Pick a conversation or a friend on the right to start chatting.</p>
          </div>
        )}
      </main>

      <DmSidebar initialTab={startTab} activeUid={other} onOpen={openChat} onLeave={leave} />

      {cardOpen && other && (
        <ProfileCard uid={other} fallback={fallback} user={user} onClose={() => setCardOpen(false)} />
      )}
    </div>,
    document.body
  );
}
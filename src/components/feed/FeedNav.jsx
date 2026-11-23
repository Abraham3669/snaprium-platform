// src/components/feed/FeedNav.jsx
// Navigation the feed needs on the web: a left rail on computers, a bottom bar on phone browsers.
// (The iPhone app already has its own bottom bar, so there it only gets a round "+" button.)
import { useNavigate, useLocation } from "react-router-dom";
import { useRef } from "react";
import { Capacitor } from "@capacitor/core";
import useStickyColumn from "../../lib/useStickyColumn";
import { openCircles } from "../../lib/circleNav";
import { BellIcon, ChatIcon, CirclesIcon, HomeIcon, PlusIcon, UserIcon } from "./Icons";

const native = Capacitor.isNativePlatform();

export function LeftRail({ uid, unread = 0, social = 0, onCompose }) {
  const railRef = useRef(null);
  useStickyColumn(railRef, !!uid);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const item = (label, icon, active, go, badge) => (
    <button type="button" className={`fd-nav-item ${active ? "on" : ""}`} onClick={go} aria-current={active ? "page" : undefined}>
      <span className="fd-nav-ico">
        {icon}
        {badge > 0 && <i className="fd-badge">{badge > 9 ? "9+" : badge}</i>}
      </span>
      <span>{label}</span>
    </button>
  );
  if (!uid)
    return (
      <nav className="fd-rail" aria-label="Main" ref={railRef}>
        {item("Home", <HomeIcon />, pathname === "/", () => navigate("/"))}
        {item("Circles", <CirclesIcon />, pathname.startsWith("/community"), () => navigate("/community"))}
      </nav>
    );
  return (
    <nav className="fd-rail" aria-label="Main" ref={railRef}>
      {item("Home", <HomeIcon />, pathname === "/", () => navigate("/"))}
      {item("Circles", <CirclesIcon />, pathname.startsWith("/community"), () => openCircles(navigate, uid))}
      {item("Messages", <ChatIcon />, pathname.startsWith("/messages") || pathname === "/friends", () => navigate("/friends"), social)}
      {item("Notifications", <BellIcon />, pathname === "/notifications", () => navigate("/notifications"), unread)}
      {item("Profile", <UserIcon />, pathname === "/profile", () => navigate("/profile"))}
      <button type="button" className="fd-btn primary fd-rail-post" onClick={onCompose}>Post</button>
    </nav>
  );
}

// Phone browser only (hidden by CSS on wide screens, and never rendered inside the iPhone app).
export function PhoneBar({ uid, social = 0, onCompose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (native) return null;
  const it = (label, icon, active, go, badge) => (
    <button type="button" className={`fd-bar-item ${active ? "on" : ""}`} onClick={go} aria-label={label} aria-current={active ? "page" : undefined}>
      <span className="fd-nav-ico">
        {icon}
        {badge > 0 && <i className="fd-badge">{badge > 9 ? "9+" : badge}</i>}
      </span>
      <span>{label}</span>
    </button>
  );
  if (!uid)
    return (
      <nav className="fd-bar guest" aria-label="Main">
        {it("Home", <HomeIcon />, pathname === "/", () => navigate("/"))}
        {it("Circles", <CirclesIcon />, pathname.startsWith("/community"), () => navigate("/community"))}
        {it("Sign in", <UserIcon />, false, () => navigate("/login"))}
      </nav>
    );
  return (
    <nav className="fd-bar" aria-label="Main">
      {it("Home", <HomeIcon />, pathname === "/", () => navigate("/"))}
      {it("Circles", <CirclesIcon />, pathname.startsWith("/community"), () => openCircles(navigate, uid))}
      <button type="button" className="fd-bar-post" onClick={onCompose} aria-label="New post"><PlusIcon /></button>
      {it("Friends", <ChatIcon />, pathname.startsWith("/messages") || pathname === "/friends", () => navigate("/friends"), social)}
      {it("Profile", <UserIcon />, pathname === "/profile", () => navigate("/profile"))}
    </nav>
  );
}

// Inside the iPhone app: floating "+" above the app's own bottom bar.
export function NativeFab({ onCompose }) {
  if (!native) return null;
  return (
    <button type="button" className="fd-fab" onClick={onCompose} aria-label="New post">
      <PlusIcon />
    </button>
  );
}
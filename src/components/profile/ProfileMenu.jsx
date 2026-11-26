// src/components/profile/ProfileMenu.jsx  -  the "⋯" menu on your own profile: everything that isn't your posts
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { MoreIcon } from "../feed/Icons";

export default function ProfileMenu({ onSaved }) {
  const navigate = useNavigate();
  const { signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const go = (fn) => () => {
    setOpen(false);
    fn();
  };
  const items = [
    ["Settings and account", () => navigate("/settings")],
    ["Saved posts", onSaved],
    ["Blocked users", () => navigate("/settings?blocked=1")],
    // Solo study hidden from the menu for now (the /solo page still works). Remove the // below to show it again.
    // ["Solo study", () => navigate("/solo")],
    ["Upgrade", () => navigate("/upgrade")],
  ];

  return (
    <div className="pv-menu-wrap" ref={ref}>
      <button type="button" className="fd-btn pv-more" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreIcon />
      </button>
      {open && (
        <div className="fd-menu pv-menu" role="menu">
          {items.map(([label, fn]) => (
            <button key={label} type="button" role="menuitem" onClick={go(fn)}>{label}</button>
          ))}
          <button type="button" role="menuitem" className="danger" onClick={go(async () => { await signOutUser(); navigate("/"); })}>Log out</button>
        </div>
      )}
    </div>
  );
}
// src/components/CirclesMenu.jsx
//
// "Circles" button in the top bar. One tap lists the circles you are in (with unread counts)
// and takes you straight to one. PC: a small dropdown under the button. Phone and iPhone app: a sheet
// that slides up from the bottom.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { countCommunityUnread, listMyCommunities } from "../lib/communities";
import "../styles/circles-menu.css";

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function CirclesMenu({ user }) {
  const navigate = useNavigate();
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null); // null = not loaded yet
  const [unread, setUnread] = useState({});
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState({ top: 60, right: 12 });

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setFailed(false);
    try {
      const own = await listMyCommunities(user.uid);
      setRows(own || []);
      const pairs = await Promise.all(
        (own || []).map(async (c) => {
          try {
            return [c.id, await countCommunityUnread(c.id, user.uid)];
          } catch {
            return [c.id, 0];
          }
        })
      );
      setUnread(Object.fromEntries(pairs));
    } catch {
      setFailed(true);
      setRows((prev) => prev || []);
    }
  }, [user?.uid]);

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) });
      load();
    }
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    const away = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [open]);

  const go = (path) => {
    close();
    navigate(path);
  };

  const list = rows || [];
  const total = Object.values(unread).reduce((a, b) => a + (b || 0), 0);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`snaprium-menu-btn header-bell-btn cm-btn ${open ? "on" : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Your circles"
        title="Your circles"
      >
        <UsersIcon />
        <span className="cm-btn-label">Circles</span>
      </button>

      {open &&
        createPortal(
          <>
            <div className="cm-backdrop" onClick={close} aria-hidden="true" />
            <div
              ref={popRef}
              className="cm-pop"
              role="dialog"
              aria-label="Your circles"
              style={{ "--cm-top": `${pos.top}px`, "--cm-right": `${pos.right}px` }}
            >
              <span className="cm-grab" aria-hidden="true" />
              <header className="cm-head">
                <h2>Your circles</h2>
                {total > 0 && <span className="cm-total">{total > 99 ? "99+" : total} new</span>}
              </header>

              <div className="cm-list">
                {rows === null ? (
                  <p className="cm-note">Loading…</p>
                ) : failed && list.length === 0 ? (
                  <div className="cm-empty">
                    <p>Could not load your circles.</p>
                    <button type="button" className="cm-btn-soft" onClick={load}>Try again</button>
                  </div>
                ) : list.length === 0 ? (
                  <div className="cm-empty">
                    <p>You haven't joined a circle yet.</p>
                    <button type="button" className="cm-btn-main" onClick={() => go("/community")}>Find a circle</button>
                  </div>
                ) : (
                  <ul>
                    {list.map((c) => {
                      const n = unread[c.id] || 0;
                      return (
                        <li key={c.id}>
                          <button type="button" className="cm-item" onClick={() => go(`/community/${c.id}`)}>
                            <span className="cm-av" style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}>
                              {!c.photoUrl && (c.name || "?").trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="cm-copy">
                              <strong>{c.name}</strong>
                              {c.tag ? <small>{c.tag}</small> : null}
                            </span>
                            {n > 0 && <span className="cm-badge">{n > 9 ? "9+" : n}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {list.length > 0 && (
                <footer className="cm-foot">
                  <button type="button" onClick={() => go("/community")}>Browse all circles</button>
                </footer>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
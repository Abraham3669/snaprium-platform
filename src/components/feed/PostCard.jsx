// src/components/feed/PostCard.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Capacitor } from "@capacitor/core";
import Avatar from "./Avatar";
import { CloseIcon, ReplyIcon, SaveIcon, ShareIcon, SparkIcon } from "./Icons";
import { useFeed } from "./FeedContext";
import { kindLabel, topicLabel } from "../../lib/topics";
import { timeAgo } from "../../lib/feedRank";
import { deletePost, markSeen } from "../../lib/feed";
import LinkedText, { clampText } from "../../lib/linkify";

const SITE = "https://snaprium.com";
const CLAMP = 360;

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="fd-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="fd-lightbox-x" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body
  );
}

function DeleteDialog({ onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onCancel]);
  return createPortal(
    <div className="fd-modal-back center" onClick={busy ? undefined : onCancel}>
      <div className="fd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="fd-del-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="fd-del-title">Delete this post?</h3>
        <p>It will be removed for everyone, together with its replies. This can't be undone.</p>
        <div className="fd-dialog-actions">
          <button type="button" className="fd-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="fd-btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * One post.
 *   post       the post document
 *   profile    { displayName, photoURL } current name and photo of the author (optional, falls back to the stored name)
 *   expanded   post page: full text, no "open" click, counters follow the live post
 *   onRemoved  called after the post was deleted or hidden so the list can drop it
 */
export default function PostCard({ post, profile, expanded = false, onRemoved, trackSeen = false }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = post.uid === feed.me;
  const name = profile?.displayName || post.authorName || "Member";
  const photo = profile?.photoURL || "";
  const isSparked = feed.sparked.has(post.id);
  const sparks = Math.max(0, (post.sparkCount || 0) + (expanded ? 0 : feed.delta[post.id] || 0));
  const isSaved = feed.saved.ids.has(post.id);
  const isFollowing = feed.following.has(post.uid);
  const long = !expanded && post.text.length > CLAMP;
  const text = long && !more ? clampText(post.text, CLAMP) : post.text;
  const open = () => navigate(`/post/${post.id}`);
  // Tapping anywhere on the card (not on a button, menu or picture) opens the post with its replies, like Twitter.
  const openFromCard = (e) => {
    if (e.target.closest("button, a, textarea, input, .fd-menu, .fd-confirm")) return;
    if (window.getSelection && String(window.getSelection()).length > 0) return; // they were selecting text
    open();
  };
  const openAuthor = () => navigate(mine ? "/profile" : `/u/${post.uid}`);

  // "Seen": it was on screen for a moment. Next refresh it sinks, so the feed keeps feeling new.
  useEffect(() => {
    if (!trackSeen || !ref.current || typeof IntersectionObserver === "undefined") return undefined;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer);
        if (e.isIntersecting) timer = setTimeout(() => markSeen([post.id]), 1200);
      },
      { threshold: 0.6 }
    );
    io.observe(ref.current);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [trackSeen, post.id]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!e.target.closest?.(".fd-menu-wrap")) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const share = async () => {
    const url = `${SITE}/post/${post.id}`;
    try {
      if (navigator.share && (Capacitor.isNativePlatform() || /Mobi|Android/i.test(navigator.userAgent))) {
        await navigator.share({ title: "Snaprium", text: post.text.slice(0, 100), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (err) {
      if (err?.name !== "AbortError") toast.error("Could not share");
    }
  };

  const remove = async () => {
    try {
      await deletePost(post.id);
      setConfirmDelete(false);
      toast.success("Post deleted");
      onRemoved?.(post.id);
    } catch {
      toast.error("Could not delete. Please try again.");
    }
  };

  const hide = async () => {
    setMenu(false);
    try {
      await feed.prefs.hidePost(post.id);
      toast.info("Post hidden. You won't see it again.");
      onRemoved?.(post.id);
    } catch {
      toast.error("Could not hide. Please try again.");
    }
  };

  const waiting = post.kind === "question" && !post.answered;
  const media = Array.isArray(post.media) ? post.media : [];

  return (
    <article
      className={`fd-card ${expanded ? "expanded" : "openable"}`}
      ref={ref}
      aria-label={`Post by ${name}`}
      onClick={expanded ? undefined : openFromCard}
    >
      <header className="fd-card-head">
        <Avatar name={name} photo={photo} size={42} onClick={openAuthor} />
        <div className="fd-who">
          <button type="button" className="fd-name" onClick={openAuthor}>{name}</button>
          <span className="fd-meta">
            {profile?.handle ? `@${profile.handle} · ` : ""}{timeAgo(post.createdAt)}
            {post._local ? " · posting…" : ""}
          </span>
        </div>
        {!mine && !isFollowing && (
          <button type="button" className="fd-follow" onClick={() => feed.toggleFollow(post.uid)}>Follow</button>
        )}
        {feed.me && (
          <span className="fd-menu-wrap">
            <button type="button" className="fd-icon-btn" aria-label="More options" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <span className="fd-dots" aria-hidden="true"><i /><i /><i /></span>
            </button>
            {menu && (
              <div className="fd-menu" role="menu">
                {mine ? (
                  <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>Delete post</button>
                ) : (
                  <>
                    {isFollowing && <button type="button" role="menuitem" onClick={() => { setMenu(false); feed.toggleFollow(post.uid); }}>Unfollow {name}</button>}
                    <button type="button" role="menuitem" onClick={hide}>Hide this post</button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        feed.openReport({ kind: "post", contentId: post.id, contentUid: post.uid, contentName: name, preview: post.text });
                      }}
                    >
                      Report
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); feed.openBlock({ uid: post.uid, name, photo }); }}>
                      Block {name}
                    </button>
                  </>
                )}
              </div>
            )}
          </span>
        )}
      </header>

      <div className="fd-tags">
        {kindLabel(post.kind) && <span className={`fd-kind k-${post.kind}`}>{kindLabel(post.kind)}</span>}
        {(post.topics || []).map((t) => (
          <span key={t} className="fd-topic">{topicLabel(t)}</span>
        ))}
        {waiting && <span className="fd-waiting">Waiting for an answer</span>}
        {post.kind === "question" && post.answered && <span className="fd-answered">Answered</span>}
      </div>

      <div className="fd-body">
        {text && <p className="fd-text"><LinkedText text={text} /></p>}
        {long && (
          <button type="button" className="fd-more" onClick={() => setMore((v) => !v)}>
            {more ? "Show less" : "Show more"}
          </button>
        )}
        {media.length > 0 && (
          <div className={`fd-media n${media.length}`}>
            {media.map((m, i) => (
              <button
                type="button"
                key={i}
                className={`fd-media-item ${m.w && m.h ? "" : "noratio"}`}
                style={media.length === 1 && m.w && m.h ? { aspectRatio: String(Math.min(2.4, Math.max(0.75, m.w / m.h))) } : undefined}
                onClick={() => setZoom(m.url)}
                aria-label="View picture"
              >
                <img src={m.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && <DeleteDialog onCancel={() => setConfirmDelete(false)} onConfirm={remove} />}

      <footer className="fd-actions">
        <button
          type="button"
          className={`fd-act spark ${isSparked ? "on" : ""}`}
          aria-pressed={isSparked}
          aria-label={isSparked ? "Remove Spark" : "Spark: this was helpful"}
          title="Spark: this was helpful"
          onClick={() => feed.toggleSpark(post)}
        >
          <SparkIcon filled={isSparked} />
          <span>{sparks > 0 ? sparks : "Spark"}</span>
        </button>
        <button type="button" className="fd-act" aria-label={`Replies: ${post.replyCount || 0}`} onClick={expanded ? undefined : open}>
          <ReplyIcon />
          <span>{post.replyCount > 0 ? post.replyCount : post.kind === "question" ? "Answer" : "Reply"}</span>
        </button>
        <span className="fd-spacer" />
        <button type="button" className={`fd-act icon ${isSaved ? "on" : ""}`} aria-pressed={isSaved} aria-label={isSaved ? "Remove from Saved" : "Save"} onClick={() => feed.toggleSave(post.id)}>
          <SaveIcon filled={isSaved} />
        </button>
        <button type="button" className="fd-act icon" aria-label="Share" onClick={share}>
          <ShareIcon />
        </button>
      </footer>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom("")} />}
    </article>
  );
}
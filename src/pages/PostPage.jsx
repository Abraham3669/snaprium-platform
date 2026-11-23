// src/pages/PostPage.jsx  -  one post with its replies (/post/:postId)
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import { addReply, deleteReply, fetchMyReplySparks, rememberInteraction, setHelpfulAnswer, setReplySpark, subscribePost, subscribeReplies } from "../lib/feed";
import { notifyPost } from "../lib/notifications";
import { timeAgo } from "../lib/feedRank";
import LinkedText from "../lib/linkify";
import { useLiveProfiles } from "../lib/publicProfile";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import PostCard from "../components/feed/PostCard";
import Avatar from "../components/feed/Avatar";
import ReplyBox from "../components/feed/ReplyBox";
import useDockOffset from "../lib/useDockOffset";
import { BackIcon, CheckIcon, SparkIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

function ReplyRow({ post, reply, profile, profiles, isOwnerView, onHelpful, onSpark, sparked, onReply, replying, replyForm, child, flash }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const mine = reply.uid === feed.me;
  const name = profile?.displayName || reply.authorName || "Member";
  const accepted = post.acceptedReplyId === reply.id;
  const canMark = post.uid === feed.me && post.kind === "question" && !mine && !child;
  const toProfile = reply.replyToUid && reply.replyToUid !== reply.uid ? profiles[reply.replyToUid] : null;
  const toName = reply.replyToUid && child ? (toProfile?.handle ? `@${toProfile.handle}` : toProfile?.displayName || "") : "";
  const sparks = Math.max(0, reply.sparkCount || 0); // live from the database, so it already includes your own Spark

  return (
    <li id={`reply-${reply.id}`} className={`fd-reply ${child ? "child" : ""} ${accepted ? "accepted" : ""} ${flash ? "flash" : ""}`}>
      <Avatar name={name} photo={profile?.photoURL || ""} size={child ? 30 : 34} onClick={() => navigate(mine ? "/profile" : `/u/${reply.uid}`)} />
      <div className="fd-reply-main">
        <div className="fd-reply-head">
          <strong>{name}</strong>
          <span className="fd-meta">{profile?.handle ? `@${profile.handle} · ` : ""}{timeAgo(reply.createdAt)}</span>
          {accepted && <span className="fd-answered"><CheckIcon /> Helpful answer</span>}
        </div>
        {toName && <p className="fd-replying">Replying to <strong>{toName}</strong></p>}
        <p className="fd-text"><LinkedText text={reply.text} /></p>
        <div className="fd-reply-acts">
          {!mine && (
            <button type="button" className={`fd-ract ${sparked.on ? "on" : ""}`} aria-pressed={!!sparked.on} onClick={() => onSpark(reply)}>
              <SparkIcon filled={!!sparked.on} />
              <span>{sparks > 0 ? sparks : "Spark"}</span>
            </button>
          )}
          {mine && sparks > 0 && <span className="fd-ract static"><SparkIcon filled /> <span>{sparks}</span></span>}
          <button type="button" className="fd-link" onClick={() => onReply(reply)}>Reply</button>
          {canMark && (
            <button type="button" className="fd-link" onClick={() => onHelpful(accepted ? "" : reply)}>
              {accepted ? "Unmark helpful answer" : "Mark as helpful answer"}
            </button>
          )}
          {(mine || isOwnerView) && (
            <button
              type="button"
              className="fd-link danger"
              onClick={async () => {
                try {
                  await deleteReply({ post, reply, me: feed.me });
                } catch {
                  toast.error("Could not delete. Please try again.");
                }
              }}
            >
              Delete
            </button>
          )}
          {!mine && feed.me && (
            <button type="button" className="fd-link" onClick={() => feed.openReport({ kind: "reply", contentId: reply.id, questionId: post.id, contentUid: reply.uid, contentName: name, preview: reply.text })}>
              Report
            </button>
          )}
        </div>
        {replying && replyForm}
      </div>
    </li>
  );
}

function Inner({ postId }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [post, setPost] = useState(undefined); // undefined = loading, null = gone
  const [replies, setReplies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // the reply I am answering (null = answering the post)
  const [mySparks, setMySparks] = useState(() => new Set());
  const [fresh, setFresh] = useState(() => new Set()); // replies I wrote on this visit
  const [flash, setFlash] = useState("");
  const wantFocus = params.get("reply") === "1";

  useEffect(() => subscribePost(postId, setPost), [postId]);
  useEffect(() => subscribeReplies(postId, setReplies), [postId]);
  useEffect(() => {
    feed.loadSparks([postId]);
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Which replies did I Spark? Looked up once when the replies first arrive (and for new ones that have Sparks).
  const checked = useRef(new Set());
  useEffect(() => {
    if (!feed.me || !replies.length) return;
    const todo = replies.filter((r) => (r.sparkCount || 0) > 0 && !checked.current.has(r.id));
    if (!todo.length) return;
    todo.forEach((r) => checked.current.add(r.id));
    fetchMyReplySparks(postId, feed.me, todo).then((set) => set.size && setMySparks((cur) => new Set([...cur, ...set])));
  }, [replies, feed.me, postId]);

  // Threads: top replies (best first), each followed by the answers to it (oldest first).
  const threads = useMemo(() => {
    const list = replies.filter((r) => !feed.blocked.has(r.uid));
    const ids = new Set(list.map((r) => r.id));
    const kids = new Map();
    const roots = [];
    for (const r of list) {
      if (r.parentId && ids.has(r.parentId)) kids.set(r.parentId, [...(kids.get(r.parentId) || []), r]);
      else roots.push(r); // a normal reply, or one whose parent is gone
    }
    const t = (r) => r.createdAt?.toMillis?.() || Date.now();
    roots.sort((a, b) => {
      const acc = Number(b.id === post?.acceptedReplyId) - Number(a.id === post?.acceptedReplyId);
      return acc || Number(fresh.has(b.id)) - Number(fresh.has(a.id)) || (b.sparkCount || 0) - (a.sparkCount || 0) || t(a) - t(b);
    });
    return roots.map((r) => ({ root: r, kids: (kids.get(r.id) || []).sort((a, b) => t(a) - t(b)) }));
  }, [replies, feed.blocked, post?.acceptedReplyId, fresh]);

  const uids = useMemo(() => [post?.uid, feed.me, ...replies.map((r) => r.uid), ...replies.map((r) => r.replyToUid)].filter(Boolean), [post?.uid, feed.me, replies]);
  const profiles = useLiveProfiles(uids);

  const canReply = !!post && !feed.blocked.has(post?.uid) && !feed.guest;
  useDockOffset(canReply);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const send = async (body, parent) => {
    if (busy || !post) return false;
    if (!isClean(body)) {
      toast.error(FILTER_MESSAGE);
      return false;
    }
    setBusy(true);
    try {
      const r = await addReply({ post, user: feed.user, text: body, parent });
      setFresh((s) => new Set(s).add(r.id));
      setFlash(r.id);
      setTimeout(() => document.getElementById(`reply-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
      setTimeout(() => setFlash(""), 2500);
      rememberInteraction(post.uid);
      notifyPost({ to: post.uid, type: "post_reply", from: feed.meInfo, post, key: r.id, preview: body });
      if (parent && parent.uid !== post.uid) notifyPost({ to: parent.uid, type: "post_reply", from: feed.meInfo, post, key: `${r.id}_r`, preview: body, replyId: parent.id });
      setReplyTo(null);
      return true;
    } catch (err) {
      console.warn("[reply]", err?.code || "", err?.message || err);
      toast.error("Could not send. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sparkReply = async (reply) => {
    if (feed.requireAuth("spark")) return;
    const on = !mySparks.has(reply.id);
    // show it straight away, undo if the database says no
    setMySparks((s) => { const n = new Set(s); on ? n.add(reply.id) : n.delete(reply.id); return n; });
    try {
      await setReplySpark({ postId: post.id, reply, me: feed.me, on });
      if (on) notifyPost({ to: reply.uid, type: "post_spark", from: feed.meInfo, post, key: `${reply.id}_s`, preview: reply.text, replyId: reply.id });
    } catch (err) {
      console.warn("[reply spark]", err?.code || "", err?.message || err);
      setMySparks((s) => { const n = new Set(s); on ? n.delete(reply.id) : n.add(reply.id); return n; });
      toast.error("Could not update. Please try again.");
    }
  };

  const startReply = (reply) => {
    if (feed.requireAuth("reply")) return;
    setReplyTo(reply);
  };

  const markHelpful = async (reply) => {
    try {
      await setHelpfulAnswer({ post, replyId: reply ? reply.id : "" });
      if (reply) notifyPost({ to: reply.uid, type: "post_answer", from: feed.meInfo, post, key: reply.id, preview: reply.text });
    } catch {
      toast.error("Could not update. Please try again.");
    }
  };

  const nameOf = (r) => {
    const p = profiles[r.uid];
    return p?.handle ? `@${p.handle}` : p?.displayName || r.authorName || "Member";
  };
  const me = profiles[feed.me];
  const row = (r, child) => (
    <ReplyRow
      key={r.id}
      post={post}
      reply={r}
      child={child}
      profile={profiles[r.uid]}
      profiles={profiles}
      isOwnerView={post.uid === feed.me}
      onHelpful={markHelpful}
      onSpark={sparkReply}
      sparked={{ on: mySparks.has(r.id) }}
      onReply={startReply}
      replying={replyTo?.id === r.id}
      flash={flash === r.id}
      replyForm={
        <ReplyBox
          compact
          autoFocus
          name={feed.user?.displayName}
          photo={me?.photoURL || ""}
          replyingTo={nameOf(r)}
          placeholder="Write your reply"
          busy={busy}
          onSend={(body) => send(body, r)}
          onCancel={() => setReplyTo(null)}
        />
      }
    />
  );

  return (
    <div className={`fd-page single ${canReply ? "has-dock" : ""}`}>
      <div className="fd-main">
        <button type="button" className="fd-back" onClick={back}><BackIcon /> Back</button>
        {post === undefined ? (
          <div className="fd-card fd-skel"><div className="sk-row"><i className="sk-av" /><i className="sk-line w40" /></div><i className="sk-line w90" /><i className="sk-line w60" /></div>
        ) : post === null || feed.blocked.has(post.uid) ? (
          <div className="fd-empty">
            <strong>This post isn't available</strong>
            <p>It may have been deleted.</p>
            <button type="button" className="fd-btn primary" onClick={() => navigate("/", { replace: true })}>Go to the feed</button>
          </div>
        ) : (
          <>
            <PostCard post={post} profile={profiles[post.uid]} expanded onRemoved={() => navigate("/", { replace: true })} />
            <h2 className="fd-h2">{post.replyCount > 0 ? `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}` : post.kind === "question" ? "Be the first to answer" : "Replies"}</h2>
            {feed.guest ? (
              <div className="fd-replybox guest">
                <p>Sign in to {post.kind === "question" ? "answer" : "reply"}.</p>
                <button type="button" className="fd-btn primary" onClick={() => feed.requireAuth("reply")}>
                  Sign in to {post.kind === "question" ? "answer" : "reply"}
                </button>
              </div>
            ) : (
              <ReplyBox
                dock
                name={feed.user?.displayName}
                photo={me?.photoURL || ""}
                placeholder={post.kind === "question" ? "Write an answer" : "Write a reply"}
                submitLabel={post.kind === "question" ? "Answer" : "Reply"}
                busy={busy}
                autoFocus={wantFocus}
                onSend={(body) => send(body, null)}
              />
            )}
            <ul className="fd-replies">
              {threads.map(({ root, kids }) => (
                <Fragment key={root.id}>
                  {row(root, false)}
                  {kids.length > 0 && <li className="fd-thread"><ul>{kids.map((k) => row(k, true))}</ul></li>}
                </Fragment>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default function PostPage() {
  const { postId } = useParams();
  const { user, loading } = useAuth();
  // Signed-out visitors can read the post and its replies; acting on them asks them to sign in.
  if (loading && !user) return <FeedSkeleton />;
  return (
    <FeedProvider user={user || null}>
      <Inner postId={postId} />
    </FeedProvider>
  );
}
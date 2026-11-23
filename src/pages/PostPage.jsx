// src/pages/PostPage.jsx  -  one post with its replies (/post/:postId)
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import { addReply, deleteReply, LIMITS, rememberInteraction, setHelpfulAnswer, subscribePost, subscribeReplies } from "../lib/feed";
import { notifyPost } from "../lib/notifications";
import { timeAgo } from "../lib/feedRank";
import { useLiveProfiles } from "../lib/publicProfile";
import { FeedProvider, useFeed } from "../components/feed/FeedContext";
import PostCard from "../components/feed/PostCard";
import Avatar from "../components/feed/Avatar";
import { BackIcon, CheckIcon } from "../components/feed/Icons";
import { FeedSkeleton } from "./FeedHome";
import "../styles/feed.css";

function ReplyRow({ post, reply, profile, isOwnerView, onHelpful }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const mine = reply.uid === feed.me;
  const name = profile?.displayName || reply.authorName || "Member";
  const accepted = post.acceptedReplyId === reply.id;
  const canMark = post.uid === feed.me && post.kind === "question" && !mine;

  return (
    <li className={`fd-reply ${accepted ? "accepted" : ""}`}>
      <Avatar name={name} photo={profile?.photoURL || ""} size={34} onClick={() => navigate(mine ? "/profile" : `/u/${reply.uid}`)} />
      <div className="fd-reply-main">
        <div className="fd-reply-head">
          <strong>{name}</strong>
          <span className="fd-meta">{timeAgo(reply.createdAt)}</span>
          {accepted && <span className="fd-answered"><CheckIcon /> Helpful answer</span>}
        </div>
        <p className="fd-text">{reply.text}</p>
        <div className="fd-reply-acts">
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
          {!mine && (
            <button type="button" className="fd-link" onClick={() => feed.openReport({ kind: "reply", contentId: reply.id, questionId: post.id, contentUid: reply.uid, contentName: name, preview: reply.text })}>
              Report
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function Inner({ postId }) {
  const feed = useFeed();
  const navigate = useNavigate();
  const [post, setPost] = useState(undefined); // undefined = loading, null = gone
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribePost(postId, setPost), [postId]);
  useEffect(() => subscribeReplies(postId, setReplies), [postId]);
  useEffect(() => {
    feed.loadSparks([postId]);
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const list = replies.filter((r) => !feed.blocked.has(r.uid));
    if (!post?.acceptedReplyId) return list;
    return [...list.filter((r) => r.id === post.acceptedReplyId), ...list.filter((r) => r.id !== post.acceptedReplyId)];
  }, [replies, feed.blocked, post?.acceptedReplyId]);

  const uids = useMemo(() => [post?.uid, ...replies.map((r) => r.uid)].filter(Boolean), [post?.uid, replies]);
  const profiles = useLiveProfiles(uids);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy || !post) return;
    if (!isClean(body)) return toast.error(FILTER_MESSAGE);
    setBusy(true);
    try {
      const r = await addReply({ post, user: feed.user, text: body });
      setText("");
      rememberInteraction(post.uid);
      notifyPost({ to: post.uid, type: "post_reply", from: feed.meInfo, post, key: r.id, preview: body });
    } catch (err) {
      console.warn("[reply]", err?.message || err);
      toast.error("Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const markHelpful = async (reply) => {
    try {
      await setHelpfulAnswer({ post, replyId: reply ? reply.id : "" });
      if (reply) notifyPost({ to: reply.uid, type: "post_answer", from: feed.meInfo, post, key: reply.id, preview: reply.text });
    } catch {
      toast.error("Could not update. Please try again.");
    }
  };

  return (
    <div className="fd-page single">
      <div className="fd-main">
        <button type="button" className="fd-back" onClick={back}><BackIcon /> Back</button>
        {post === undefined ? (
          <div className="fd-card fd-skel"><div className="sk-row"><i className="sk-av" /><i className="sk-line w40" /></div><i className="sk-line w90" /><i className="sk-line w60" /></div>
        ) : post === null || feed.blocked.has(post.uid) ? (
          <div className="fd-empty">
            <strong>This post isn't available</strong>
            <p>It may have been deleted.</p>
            <button type="button" className="fd-btn primary" onClick={() => navigate("/")}>Go to the feed</button>
          </div>
        ) : (
          <>
            <PostCard post={post} profile={profiles[post.uid]} expanded onRemoved={() => navigate("/", { replace: true })} />
            <h2 className="fd-h2">{post.replyCount > 0 ? `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}` : post.kind === "question" ? "Be the first to answer" : "Replies"}</h2>
            <form className="fd-replybox" onSubmit={send}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={LIMITS.reply}
                rows={3}
                placeholder={post.kind === "question" ? "Write an answer" : "Write a reply"}
                aria-label="Your reply"
              />
              <div className="fd-replybox-foot">
                <span className="fd-count">{LIMITS.reply - text.length}</span>
                <button type="submit" className="fd-btn primary" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Reply"}</button>
              </div>
            </form>
            <ul className="fd-replies">
              {shown.map((r) => (
                <ReplyRow key={r.id} post={post} reply={r} profile={profiles[r.uid]} isOwnerView={post.uid === feed.me} onHelpful={markHelpful} />
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
  const navigate = useNavigate();
  if (loading && !user) return <FeedSkeleton />;
  if (!user)
    return (
      <div className="fd-page single">
        <div className="fd-main">
          <div className="fd-empty">
            <strong>Sign in to read this post</strong>
            <p>Join Snaprium to read, reply and follow people who share what they learn.</p>
            <button type="button" className="fd-btn primary" onClick={() => navigate("/login")}>Sign in</button>
          </div>
        </div>
      </div>
    );
  return (
    <FeedProvider user={user}>
      <Inner postId={postId} />
    </FeedProvider>
  );
}
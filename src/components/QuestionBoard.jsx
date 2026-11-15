import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import ReactMarkdown from "react-markdown";
import {
  subscribeToQuestions,
  createQuestion,
  subscribeToReplies,
  addQuestionReply,
  toggleQuestionLike,
  setQuestionSolved,
  deleteQuestion,
  editQuestion,
  editQuestionReply,
deleteQuestionReply,
markQuestionRead,
  toggleReplySpark,
} from "../lib/communities";
import { notifyUser } from "../lib/notifications";
import { tinyPhoto, useLiveProfiles } from "../lib/publicProfile";
import { handleOf, resolveMentions, mentionSuggestions } from "../lib/mentions";
import "../styles/question-board.css";


function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function IconPhoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5.5-5-6.5 7" />
    </svg>
  );
}
function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLike() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 11v9H4v-9h3zM7 20h9.2a2 2 0 0 0 2-1.7l1.2-7A2 2 0 0 0 17.4 9H14V6.2A2.2 2.2 0 0 0 11.8 4L9 9v2" strokeLinejoin="round" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 7h14M9 7V5h6v2M8 7l.8 12h6.4L16 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M22 2L11 13" strokeLinecap="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
    </svg>
  );
}

function timeLabel(createdAt) {
  const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ photo, name }) {
  const letter = (name || "?").slice(0, 1).toUpperCase();
  return photo ? (
    <img className="qb-avatar" src={photo} alt="" />
  ) : (
    <span className="qb-avatar qb-avatar-fallback">{letter}</span>
  );
}

function renderWithMentions(text, people, myUid) {
  return String(text)
    .split(/(@[\p{L}\p{N}_.-]{2,})/gu)
    .map((part, i) => {
      if (!part.startsWith("@")) return part;
      const uids = resolveMentions(part, people);
      if (!uids.length) return part;
      return (
        <span key={i} className={`cc-mention ${uids.includes(myUid) ? "me" : ""}`}>
          {part}
        </span>
      );
    });
}

function autolinkMarkdown(text) {
  return String(text || "").replace(
    /(^|[\s(])((https?:\/\/|www\.)[^\s<]+[^.\s<,;:!?"')\]])/gi,
    (_, pre, url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `${pre}[${url}](${href})`;
    }
  );
}

function prepareUserMessage(text) {
  return autolinkMarkdown(String(text || "").replace(/\n/g, "  \n"));
}

function ReplyText({ text, people, myUid }) {
  if (!text) return null;
  return (
    <div className="cc-md cc-user-md">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="cc-link">
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p>
              {Array.isArray(children)
                ? children.map((child, i) =>
                    typeof child === "string" ? renderWithMentions(child, people, myUid) : child
                  )
                : typeof children === "string"
                ? renderWithMentions(children, people, myUid)
                : children}
            </p>
          ),
        }}
      >
        {prepareUserMessage(text)}
      </ReactMarkdown>
    </div>
  );
}

function compressImage(file, max = 900, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function QuestionBoard({ communityId, boardId, user, isMember, communityName = "", initialQuestionId = "", circlePeople = [] }) {
  const [questions, setQuestions] = useState([]);
  const questionUids = useMemo(() => questions.map((x) => x.uid), [questions]);
  const liveAuthors = useLiveProfiles(questionUids);
  const [openId, setOpenId] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
const [seen, setSeen] = useState({});



  useEffect(() => {
    if (!communityId || !boardId) return;
    return subscribeToQuestions(communityId, boardId, setQuestions);
  }, [communityId, boardId]);

  // Opened from a notification: jump straight into that question (once).
  const openedFromLink = useRef("");
  useEffect(() => {
    if (!initialQuestionId || openedFromLink.current === initialQuestionId) return;
    if (questions.some((q) => q.id === initialQuestionId)) {
      openedFromLink.current = initialQuestionId;
      setOpenId(initialQuestionId);
    }
  }, [initialQuestionId, questions]);

  useEffect(() => {
  if (!communityId || !user?.uid) return;
  return onSnapshot(
    collection(db, "communities", communityId, "reads", user.uid, "threads"),
    (snap) => {
      const next = {};
      snap.forEach((d) => {
        next[d.id] = d.data()?.replyCount || 0;
      });
      setSeen(next);
    }
  );
}, [communityId, user?.uid]);

  const resetComposer = () => {
    setTitle("");
    setBody("");
    setImageUrl("");
    setComposerOpen(false);
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImageUrl(await compressImage(file));
    } catch {
      toast.error("Could not add photo");
    }
  };

  const onPost = async (e) => {
    e.preventDefault();
    if (!user || !isMember || posting) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setPosting(true);
    try {
      await createQuestion(communityId, boardId, {
        title: cleanTitle,
        body: body.trim(),
        imageUrl,
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: tinyPhoto(user.photoURL),
      });
      resetComposer();
    } catch {
      toast.error("Could not post question");
    } finally {
      setPosting(false);
    }
  };

  const open = questions.find((q) => q.id === openId) || null;

  return (
    <div className="qb-wrap">
      {!open && (
        <>
          <div className="qb-bar">
            <p>Ask the circle anything.</p>
            <button type="button" className="qb-ask" onClick={() => setComposerOpen(true)}>
              <IconPlus />
              Ask a question
            </button>
          </div>

          {composerOpen && (
            <form className="qb-composer" onSubmit={onPost}>
              <input
                className="qb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's your question?"
                maxLength={140}
                autoFocus
              />
              <textarea
                className="qb-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add detail, or attach a photo of the problem."
                rows={3}
              />
              {imageUrl && (
                <div className="qb-preview">
                  <img src={imageUrl} alt="" />
                  <button type="button" onClick={() => setImageUrl("")}>Remove</button>
                </div>
              )}
              <div className="qb-composer-actions">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                <button type="button" className="qb-ghost" onClick={() => fileRef.current?.click()}>
                  <IconPhoto />
                  Photo
                </button>
                <button type="button" onClick={resetComposer}>Cancel</button>
                <button type="submit" disabled={posting || !title.trim()}>
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          )}

          {questions.length === 0 && !composerOpen && (
            <p className="cc-muted">No questions yet. Post the first one for the circle.</p>
          )}

          <div className="qb-list">
            {questions.map((q) => (
              <button key={q.id} type="button" className="qb-card" onClick={() => setOpenId(q.id)}>
  {(() => {
  const count = q.replyCount || 0;
  const seenCount = seen[q.id] || 0;
  const mine = q.uid === user?.uid;
  const mentioned = (q.mentions || []).includes(user?.uid);
  const unread = count > seenCount && q.lastReplyUid !== user?.uid && (mine || mentioned || seen[q.id]);
  return unread ? <span className="qb-badge">New</span> : null;
})()}
  {q.imageUrl && <img className="qb-thumb" src={q.imageUrl} alt="" />}
                <div className="qb-card-copy">
                  <div className="qb-card-top">
                    <strong>{q.title}</strong>
                    {q.solved && <span className="qb-solved">Solved</span>}
                  </div>
                                    {q.body && (
                    <p className="qb-card-body">
                      {q.body.length > 120 ? `${q.body.slice(0, 120).trim()}…` : q.body}
                    </p>
                  )}
                  <span className="qb-meta">
  {(q.uid === user?.uid ? user?.displayName : liveAuthors[q.uid]?.displayName) || q.displayName || "Member"}
  <span aria-hidden="true"> · </span>
  {Math.max(0, q.replyCount || 0)} {q.replyCount === 1 ? "reply" : "replies"}
  <span aria-hidden="true"> · </span>
  {q.likeCount || 0} {(q.likeCount || 0) === 1 ? "spark" : "sparks"}
</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {open && (
        <QuestionDetail
          communityId={communityId}
          communityName={communityName}
          boardId={boardId}
          question={open}
          user={user}
          isMember={isMember}
          circlePeople={circlePeople}
          onBack={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function QuestionDetail({ communityId, communityName = "", boardId, question, user, isMember, onBack, circlePeople = [] }) {
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const liked = !!(user && (question.likedBy || []).includes(user.uid));
  const mine = user && question.uid === user.uid;
  const [editingPost, setEditingPost] = useState(false);
  const [postTitle, setPostTitle] = useState(question.title || "");
  const [postBody, setPostBody] = useState(question.body || "");
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const composeRef = useRef(null);
  const replyInputRef = useRef(null);
  // Tapping Reply on a long thread: bring the reply box into view and put the cursor in it.
  const startReply = (r) => {
    setReplyTo(r);
    requestAnimationFrame(() => {
      composeRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      replyInputRef.current?.focus();
    });
  };
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyText, setEditReplyText] = useState("");
  const [typingNames, setTypingNames] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const typingTimer = useRef(null);
  const lastTypingWrite = useRef(0);
  const typingRef = user?.uid ? doc(db, "communities", communityId, "typing", user.uid) : null;

  useEffect(() => {
    return subscribeToReplies(communityId, boardId, question.id, setReplies);
  }, [communityId, boardId, question.id]);

 useEffect(() => {
  if (!user?.uid || !question?.id) return;
  markQuestionRead(communityId, user.uid, question.id, question.replyCount || 0).catch(() => {});
}, [communityId, user?.uid, question?.id, question.replyCount]);

  // Close the ⋯ menu when you tap anywhere else
  useEffect(() => {
    if (!menuId) return undefined;
    const close = (e) => {
      if (!e.target.closest?.(".qb-menu-wrap")) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuId]);

  // Current name and photo of everyone on this question (the copy saved inside each post can be old).
  const detailUids = useMemo(
    () => [question?.uid, ...replies.map((x) => x.uid), ...replies.map((x) => x.replyTo?.uid)],
    [question?.uid, replies]
  );
  const live = useLiveProfiles(detailUids);
  const nameFor = (uid, stored) =>
    (uid && uid === user?.uid ? user.displayName : live[uid]?.displayName) || stored || "Member";
  const photoFor = (uid, stored) =>
    (uid && uid === user?.uid ? user.photoURL : live[uid]?.photoURL) || stored || "";

  const people = useMemo(() => {
    const map = new Map();
    // Anyone in the circle can be mentioned, not only the people already in this thread.
    for (const p of circlePeople) {
      if (p.uid && p.name) map.set(p.uid, { uid: p.uid, name: p.name });
    }
    if (question?.uid && question?.displayName) {
      map.set(question.uid, { uid: question.uid, name: nameFor(question.uid, question.displayName) });
    }
    for (const r of replies) {
      if (r.uid && r.displayName) map.set(r.uid, { uid: r.uid, name: nameFor(r.uid, r.displayName) });
    }
    if (user?.uid && user?.displayName) map.set(user.uid, { uid: user.uid, name: user.displayName });
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, replies, user, live, circlePeople]);

  const suggestions = useMemo(
    () => mentionSuggestions(mentionQuery, people, user?.uid),
    [mentionQuery, people, user?.uid]
  );

  const pickMention = (p) => {
    setText((prev) => prev.replace(/@([\p{L}\p{N}_.-]*)$/u, `@${handleOf(p.name)} `));
    setMentionQuery(null);
  };

  const clearTyping = async () => {
    if (!typingRef) return;
    try { await deleteDoc(typingRef); } catch {}
  };

  const pulseTyping = () => {
    if (!typingRef || !user) return;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(clearTyping, 2500);
    const now = Date.now();
    if (now - lastTypingWrite.current < 2000) return;
    lastTypingWrite.current = now;
    setDoc(typingRef, {
      uid: user.uid,
      boardId,
      questionId: question.id,
      displayName: user.displayName || "Member",
      at: serverTimestamp(),
    }).catch(() => {});
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "communities", communityId, "typing"), (snap) => {
      const now = Date.now();
      const names = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => {
          if (row.uid === user?.uid) return false;
          if (row.questionId !== question.id) return false;
          const t = row.at?.toMillis?.() || 0;
          return !t || now - t < 4000;
        })
        .map((row) => row.displayName || "Someone");
      setTypingNames(names);
    });
    return () => {
      unsub();
      clearTimeout(typingTimer.current);
      clearTyping();
    };
  }, [communityId, question.id, user?.uid]);

  const onReply = async (e) => {
    e?.preventDefault?.();
    const clean = text.trim();
    if (!clean || !user || !isMember || sending) return;
    setSending(true);
    try {
      const mentionIds = resolveMentions(clean, people).filter((id) => id !== user.uid);
      const replyId = await addQuestionReply(communityId, boardId, question.id, {
        text: clean,
        mentions: mentionIds,
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: tinyPhoto(user.photoURL),
        replyTo: replyTo
          ? {
              id: replyTo.id,
              uid: replyTo.uid || "",
              displayName: replyTo.displayName || "Member",
              photoURL: tinyPhoto(replyTo.photoURL),
              text: String(replyTo.text || "").slice(0, 140),
            }
          : null,
      });
      // Who hears about it. Later entries win: a mention beats a reply beats an answer.
      const targets = new Map();
      if (question.uid) targets.set(question.uid, "answer");
      if (replyTo?.uid) targets.set(replyTo.uid, "reply");
      mentionIds.forEach((id) => targets.set(id, "mention"));
      const from = { uid: user.uid, displayName: user.displayName || "Member", photoURL: user.photoURL || "" };
      targets.forEach((type, to) => {
        notifyUser({
          to,
          type,
          from,
          community: { id: communityId, name: communityName },
          boardId,
          targetId: replyId,
          preview: clean,
          key: replyId,
          url: `/community/${communityId}/chat?board=${boardId}&q=${question.id}`,
        });
      });
      setText("");
      setReplyTo(null);
      setMentionQuery(null);
      clearTyping();
    } catch {
      toast.error("Could not reply");
    } finally {
      setSending(false);
    }
  };

  const onLike = async () => {
    if (!user || !isMember) return;
    if (mine) return;
    try {
      await toggleQuestionLike(communityId, boardId, question.id, user.uid, liked);
      if (!liked) {
        notifyUser({
          to: question.uid,
          type: "spark",
          emoji: "question",
          from: { uid: user.uid, displayName: user.displayName || "Member", photoURL: user.photoURL || "" },
          community: { id: communityId, name: communityName },
          boardId,
          targetId: question.id,
          preview: question.title,
          key: question.id,
          url: `/community/${communityId}/chat?board=${boardId}&q=${question.id}`,
        });
      }
    } catch {
      toast.error("Could not update Spark");
    }
  };

  const onSpark = async (reply) => {
    if (!user || !isMember || reply.uid === user.uid) return;
    const sparked = (reply.sparkedBy || []).includes(user.uid);
    try {
      await toggleReplySpark(communityId, boardId, question.id, reply.id, user.uid, sparked);
      if (!sparked) {
        notifyUser({
          to: reply.uid,
          type: "spark",
          from: { uid: user.uid, displayName: user.displayName || "Member", photoURL: user.photoURL || "" },
          community: { id: communityId, name: communityName },
          boardId,
          targetId: reply.id,
          preview: reply.text,
          key: reply.id,
          url: `/community/${communityId}/chat?board=${boardId}&q=${question.id}`,
        });
      }
    } catch {
      toast.error("Could not update Spark");
    }
  };

  const onSolve = async () => {
    try {
      await setQuestionSolved(communityId, boardId, question.id, !question.solved);
    } catch {
      toast.error("Could not update");
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteQuestion(communityId, boardId, question.id);
      onBack();
    } catch {
      toast.error("Could not delete");
    }
  };

  const savePost = async () => {
    const title = postTitle.trim();
    if (!title) return;
    try {
      await editQuestion(communityId, boardId, question.id, { title, body: postBody.trim() });
      setEditingPost(false);
    } catch {
      toast.error("Could not edit post");
    }
  };

  const saveReply = async (replyId) => {
    const next = editReplyText.trim();
    if (!next) return;
    try {
      await editQuestionReply(communityId, boardId, question.id, replyId, next);
      setEditingReplyId(null);
      setEditReplyText("");
    } catch {
      toast.error("Could not edit reply");
    }
  };

  const removeReply = async (replyId) => {
    if (!window.confirm("Delete this reply?")) return;
    try {
      await deleteQuestionReply(communityId, boardId, question.id, replyId);
    } catch {
      toast.error("Could not delete reply");
    }
  };

  return (
    <div className="qb-detail">
      <button type="button" className="qb-back" onClick={onBack}>
        <IconBack />
        Back to questions
      </button>
      <article className="qb-question">
        <div className="qb-person">
          <Avatar photo={photoFor(question.uid, question.photoURL)} name={nameFor(question.uid, question.displayName)} />
          <div>
            <strong>{nameFor(question.uid, question.displayName)}</strong>
            <time>{timeLabel(question.createdAt)}</time>
          </div>
                {lightboxUrl && (
        <div className="cc-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxUrl("")}>
          <div className="cc-lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setLightboxUrl("")}>
              Close
            </button>
          </div>
          <div className="cc-lightbox-stage" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} alt="" />
          </div>
        </div>
      )}
        </div>
        {editingPost ? (
          <div className="qb-edit">
            <input className="qb-title" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
            <textarea className="qb-body" value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={3} />
            <button type="button" onClick={savePost}>Save</button>
            <button type="button" className="qb-ghost" onClick={() => setEditingPost(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <div className="qb-card-top">
              <h2>{question.title}</h2>
              {question.solved && <span className="qb-solved">Solved</span>}
            </div>
            {question.body && <ReplyText text={question.body} people={people} myUid={user?.uid} />}
          </>
        )}
               {question.imageUrl && (
          <button
            type="button"
            className="qb-photo-btn"
            onClick={() => setLightboxUrl(question.imageUrl)}
            aria-label="View full image"
          >
            <img className="qb-photo" src={question.imageUrl} alt="" />
          </button>
        )}
        <p className="qb-meta">{replies.length} {replies.length === 1 ? "reply" : "replies"} · {question.likeCount || 0} {(question.likeCount || 0) === 1 ? "spark" : "sparks"}</p>
                <div className="qb-actions">
          {mine ? (
            (question.likeCount || 0) > 0 && (
              <span className="qb-spark-static" title="People this helped">
                <IconSpark />
                {question.likeCount}
              </span>
            )
          ) : (
            <button
              type="button"
              className={`qb-spark qb-spark-lg ${liked ? "on" : ""}`}
              onClick={onLike}
              aria-pressed={liked}
              title={liked ? "Remove Spark" : "Spark this question"}
            >
              <IconSpark />
              <span>{liked ? "Sparked" : "Spark"}</span>
              {(question.likeCount || 0) > 0 && (
                <span className="qb-spark-count">{question.likeCount}</span>
              )}
            </button>
          )}

          {mine && (
            <button type="button" className="qb-text-btn" onClick={onSolve}>
              <IconCheck />
              {question.solved ? "Mark unsolved" : "Mark solved"}
            </button>
          )}

          {mine && !editingPost && (
            <div className="qb-menu-wrap">
              <button
                type="button"
                className="qb-more"
                onClick={() => setMenuId(menuId === "question" ? null : "question")}
                aria-label="More actions"
                aria-expanded={menuId === "question"}
              >
                ⋯
              </button>
              {menuId === "question" && (
                <div className="qb-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); setEditingPost(true); }}>
                    Edit
                  </button>
                  <button type="button" role="menuitem" className="qb-menu-danger" onClick={() => { setMenuId(null); onDelete(); }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
       
        </div>
      </article>

      <div className="qb-replies">
        {replies.length === 0 && <p className="cc-muted">No replies yet.</p>}
        {replies.map((r) => (
          <article key={r.id} className="qb-reply">
            <Avatar photo={photoFor(r.uid, r.photoURL)} name={nameFor(r.uid, r.displayName)} />
            <div>
              <strong>{nameFor(r.uid, r.displayName)}</strong>
              <time>{timeLabel(r.createdAt)}{r.edited ? " · edited" : ""}</time>
              {r.replyTo && (() => {
                const original = replies.find((x) => x.id === r.replyTo.id) || null;
                const qUid = r.replyTo.uid || original?.uid || "";
                const qName = nameFor(qUid, r.replyTo.displayName || original?.displayName);
                const qPhoto = photoFor(qUid, r.replyTo.photoURL || original?.photoURL);
                return (
                  <div className="qb-quote">
                    <span className="qb-quote-avatar" aria-hidden="true">
                      {qPhoto ? (
                        <img src={qPhoto} alt="" />
                      ) : (
                        <span>{qName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </span>
                    <div className="qb-quote-body">
                      <strong>{qName}</strong>
                      <span>{r.replyTo.text}</span>
                    </div>
                  </div>
                );
              })()}
              {editingReplyId === r.id ? (
                <div className="qb-edit">
                  <textarea value={editReplyText} onChange={(e) => setEditReplyText(e.target.value)} rows={2} />
                  <button type="button" onClick={() => saveReply(r.id)}>Save</button>
                  <button type="button" className="qb-ghost" onClick={() => setEditingReplyId(null)}>Cancel</button>
                </div>
              ) : (
                <ReplyText text={r.text} people={people} myUid={user?.uid} />
              )}
              <div className="qb-reply-actions">
                {(() => {
                  const count = Math.max(0, r.sparkCount || (r.sparkedBy || []).length || 0);
                  const sparked = !!user && (r.sparkedBy || []).includes(user.uid);
                  if (user?.uid === r.uid) {
                    return count > 0 ? (
                      <span className="qb-spark-static" title="People this helped">
                        <IconSpark />
                        {count}
                      </span>
                    ) : null;
                  }
                  return (
                    <button
                      type="button"
                      className={`qb-spark ${sparked ? "on" : ""}`}
                      onClick={() => onSpark(r)}
                      aria-pressed={sparked}
                      title={sparked ? "Remove Spark" : "This helped"}
                    >
                      <IconSpark />
                      <span>{sparked ? "Sparked" : "Spark"}</span>
                      {count > 0 && <span className="qb-spark-count">{count}</span>}
                    </button>
                  );
                })()}
                <button type="button" onClick={() => startReply(r)}>Reply</button>
                {user?.uid === r.uid && (
                  <div className="qb-menu-wrap">
                    <button
                      type="button"
                      className="qb-more"
                      onClick={() => setMenuId(menuId === r.id ? null : r.id)}
                      aria-label="More actions"
                      aria-expanded={menuId === r.id}
                    >
                      ⋯
                    </button>
                    {menuId === r.id && (
                      <div className="qb-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuId(null); setEditingReplyId(r.id); setEditReplyText(r.text || ""); }}>
                          Edit
                        </button>
                        <button type="button" role="menuitem" className="qb-menu-danger" onClick={() => { setMenuId(null); removeReply(r.id); }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="qb-compose" ref={composeRef}>
        {typingNames.length > 0 && (
          <p className="qb-typing">
            {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </p>
        )}
        {replyTo && (
          <div className="qb-replying">
            <span>Replying to {nameFor(replyTo.uid, replyTo.displayName)}: {String(replyTo.text || "").slice(0, 80)}</span>
            <button type="button" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="cc-mention-list">
            {suggestions.map((p) => (
              <button key={p.uid} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(p)}>
                @{handleOf(p.name)}
              </button>
            ))}
          </div>
        )}
        <form className="qb-reply-form" onSubmit={onReply}>
          <textarea
            ref={replyInputRef}
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              const m = value.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
              setMentionQuery(m ? m[1].toLowerCase() : null);
              if (value.trim()) pulseTyping();
              else clearTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onReply(e);
              }
            }}
            placeholder="Write a reply…"
            rows={2}
          />
          <button type="submit" className="qb-send" disabled={sending || !text.trim()} aria-label="Send">
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}
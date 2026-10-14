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
} from "../lib/communities";
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

const handleOf = (name) => String(name || "").replace(/\s+/g, "");

function resolveMentions(text, people) {
  const found = new Set();
  const re = /@([\p{L}\p{N}_.-]{2,})/gu;
  let m;
  while ((m = re.exec(text || ""))) {
    const token = m[1].replace(/[.-]+$/, "").toLowerCase();
    if (!token) continue;
    const exact = people.filter(
      (p) => handleOf(p.name).toLowerCase() === token || p.name.toLowerCase().split(/\s+/)[0] === token
    );
    if (exact.length) {
      exact.forEach((p) => found.add(p.uid));
      continue;
    }
    const prefix = people.filter((p) => handleOf(p.name).toLowerCase().startsWith(token));
    if (prefix.length === 1) found.add(prefix[0].uid);
  }
  return [...found];
}

function renderWithMentions(text, people, myUid) {
  return String(text)
    .split(/(@[\p{L}\p{N}_.-]{2,})/gu)
    .map((part, i) => {
      if (!part.startsWith("@")) return part;
      const uids = resolveMentions(part, people);
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

export default function QuestionBoard({ communityId, boardId, user, isMember }) {
  const [questions, setQuestions] = useState([]);
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
        photoURL: user.photoURL || "",
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
                  {q.body && <p>{q.body}</p>}
                  <span className="qb-meta">
  {q.displayName || "Member"}
  <span aria-hidden="true"> · </span>
  {Math.max(0, q.replyCount || 0)} {q.replyCount === 1 ? "reply" : "replies"}
  <span aria-hidden="true"> · </span>
  {q.likeCount || 0} {(q.likeCount || 0) === 1 ? "like" : "likes"}
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
          boardId={boardId}
          question={open}
          user={user}
          isMember={isMember}
          onBack={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function QuestionDetail({ communityId, boardId, question, user, isMember, onBack }) {
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
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyText, setEditReplyText] = useState("");
  const [typingNames, setTypingNames] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
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

  const people = useMemo(() => {
    const map = new Map();
    if (question?.uid && question?.displayName) {
      map.set(question.uid, { uid: question.uid, name: question.displayName });
    }
    for (const r of replies) {
      if (r.uid && r.displayName) map.set(r.uid, { uid: r.uid, name: r.displayName });
    }
    if (user?.uid && user?.displayName) map.set(user.uid, { uid: user.uid, name: user.displayName });
    return [...map.values()];
  }, [question, replies, user]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return people
      .filter((p) => p.uid !== user?.uid)
      .filter(
        (p) =>
          handleOf(p.name).toLowerCase().startsWith(mentionQuery) ||
          p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(mentionQuery))
      )
      .slice(0, 5);
  }, [mentionQuery, people, user?.uid]);

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
      await addQuestionReply(communityId, boardId, question.id, {
        text: clean,
        mentions: resolveMentions(clean, people).filter((id) => id !== user.uid),
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: user.photoURL || "",
        replyTo: replyTo
          ? { id: replyTo.id, displayName: replyTo.displayName || "Member", text: String(replyTo.text || "").slice(0, 140) }
          : null,
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
    try {
      await toggleQuestionLike(communityId, boardId, question.id, user.uid, liked);
    } catch {
      toast.error("Could not update like");
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
          <Avatar photo={question.photoURL} name={question.displayName} />
          <div>
            <strong>{question.displayName || "Member"}</strong>
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
        <p className="qb-meta">{replies.length} replies · {question.likeCount || 0} likes</p>
                <div className="qb-actions">
          <button
            type="button"
            className={`qb-icon-btn ${liked ? "on" : ""}`}
            onClick={onLike}
            aria-label={liked ? "Unlike" : "Like"}
            title={liked ? "Unlike" : "Like"}
          >
            <IconLike />
            {(question.likeCount || 0) > 0 && (
              <span className="qb-icon-count">{question.likeCount}</span>
            )}
          </button>

          {mine && (
            <button type="button" className="qb-text-btn" onClick={onSolve}>
              <IconCheck />
              {question.solved ? "Mark unsolved" : "Mark solved"}
            </button>
          )}

          {mine && !editingPost && (
            <button type="button" className="qb-text-btn" onClick={() => setEditingPost(true)}>
              Edit
            </button>
          )}

          {mine && (
            <button
              type="button"
              className="qb-icon-btn danger"
              onClick={onDelete}
              aria-label="Delete question"
              title="Delete"
            >
              <IconTrash />
            </button>
          )}
       
        </div>
      </article>

      <div className="qb-replies">
        {replies.length === 0 && <p className="cc-muted">No replies yet.</p>}
        {replies.map((r) => (
          <article key={r.id} className="qb-reply">
            <Avatar photo={r.photoURL} name={r.displayName} />
            <div>
              <strong>{r.displayName || "Member"}</strong>
              <time>{timeLabel(r.createdAt)}{r.edited ? " · edited" : ""}</time>
              {r.replyTo && (
                <div className="qb-quote">
                  <strong>{r.replyTo.displayName}</strong>
                  <span>{r.replyTo.text}</span>
                </div>
              )}
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
                <button type="button" onClick={() => setReplyTo(r)}>Reply</button>
                {user?.uid === r.uid && (
                  <>
                    <button type="button" onClick={() => { setEditingReplyId(r.id); setEditReplyText(r.text || ""); }}>Edit</button>
                    <button type="button" onClick={() => removeReply(r.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="qb-compose">
        {typingNames.length > 0 && (
          <p className="qb-typing">
            {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </p>
        )}
        {replyTo && (
          <div className="qb-replying">
            <span>Replying to {replyTo.displayName || "Member"}: {String(replyTo.text || "").slice(0, 80)}</span>
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
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
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
} from "../lib/communities";




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




function timeLabel(createdAt) {
  const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}


function Avatar({ photo, name }) {
  const letter = (name || "?").slice(0, 1).toUpperCase();
  return photo ? (
    <img className="qb-avatar" src={photo} alt="" />
  ) : (
    <span className="qb-avatar qb-avatar-fallback">{letter}</span>
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

  useEffect(() => {
    if (!communityId || !boardId) return;
    return subscribeToQuestions(communityId, boardId, setQuestions);
  }, [communityId, boardId]);

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
            <p>Ask anything. School work or not.</p>
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
                placeholder="What do you need?"
                maxLength={140}
                autoFocus
              />
              <textarea
                className="qb-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add the details, or leave this blank and attach a photo."
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
            <p className="cc-muted">No questions yet. Be the first to ask.</p>
          )}

          <div className="qb-list">
            {questions.map((q) => (
              <button key={q.id} type="button" className="qb-card" onClick={() => setOpenId(q.id)}>
  {q.imageUrl && <img className="qb-thumb" src={q.imageUrl} alt="" />}
  <div className="qb-card-copy">
    <div className="qb-card-top">
      <strong>{q.title}</strong>
      {q.solved && <span className="qb-solved">Solved</span>}
    </div>
    {q.body && <p>{q.body}</p>}
    <span className="qb-meta">
      {q.displayName || "Member"} · {q.replyCount || 0} replies · {q.likeCount || 0} likes
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
const [replyTo, setReplyTo] = useState(null);
const [editingReplyId, setEditingReplyId] = useState(null);
const [editReplyText, setEditReplyText] = useState("");

  useEffect(() => {
    return subscribeToReplies(communityId, boardId, question.id, setReplies);
  }, [communityId, boardId, question.id]);

 const onReply = async (e) => {
  e.preventDefault();
  const clean = text.trim();
  if (!clean || !user || !isMember || sending) return;
  setSending(true);
  try {
    await addQuestionReply(communityId, boardId, question.id, {
      text: clean,
      uid: user.uid,
      displayName: user.displayName || "Member",
      photoURL: user.photoURL || "",
      replyTo: replyTo
        ? { id: replyTo.id, displayName: replyTo.displayName || "Member", text: String(replyTo.text || "").slice(0, 140) }
        : null,
    });
    setText("");
    setReplyTo(null);
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
    {question.body && <p className="qb-copy">{question.body}</p>}
  </>
)}
{question.imageUrl && (
  <img className="qb-photo" src={question.imageUrl} alt="" />
)}
<div className="qb-actions">
  <button type="button" className={liked ? "on" : ""} onClick={onLike}>
    <IconLike />
    {liked ? "Liked" : "Like"} · {question.likeCount || 0}
  </button>
  {mine && (
    <button type="button" onClick={onSolve}>
      <IconCheck />
      {question.solved ? "Unsolve" : "Solved"}
    </button>
  )}
  {mine && (
    <button type="button" className="danger" onClick={onDelete}>
      <IconTrash />
      Delete
    </button>
  )}

{mine && !editingPost && (
  <button type="button" onClick={() => setEditingPost(true)}>Edit</button>
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
      <p className="qb-quote">Replying to {r.replyTo.displayName}: {r.replyTo.text}</p>
    )}
    {editingReplyId === r.id ? (
      <div className="qb-edit">
        <textarea value={editReplyText} onChange={(e) => setEditReplyText(e.target.value)} rows={2} />
        <button type="button" onClick={() => saveReply(r.id)}>Save</button>
        <button type="button" className="qb-ghost" onClick={() => setEditingReplyId(null)}>Cancel</button>
      </div>
    ) : (
      <p>{r.text}</p>
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

      {replyTo && (
  <div className="qb-replying">
    <span>Replying to {replyTo.displayName || "Member"}</span>
    <button type="button" onClick={() => setReplyTo(null)}>×</button>
  </div>
)}

      <form className="qb-reply-form" onSubmit={onReply}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply…"
          rows={2}
        />
        <button type="submit" disabled={sending || !text.trim()}>Reply</button>
      </form>
    </div>
  );
}
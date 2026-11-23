// src/components/feed/FeedContext.jsx
// One place that holds everything a feed screen needs about "me": who I follow, what I saved, hidden posts, topics,
// blocked people, which posts I Sparked. Every post card reads it, so Spark / Follow / Save / Report behave the same
// on the feed, the post page and an author's page.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import SignInGate from "./SignInGate";
import { publicName } from "../../lib/publicName";
import { useBlocked } from "../../lib/moderation";
import { ReportDialog, BlockDialog } from "../ModerationDialogs";
import { notifyPost } from "../../lib/notifications";
import { fetchMySparks, rememberInteraction, setSpark, useFeedPrefs, useFollowing, useSaved } from "../../lib/feed";

const Ctx = createContext(null);
export const useFeed = () => useContext(Ctx);

export function FeedProvider({ user, children }) {
  const me = user?.uid || "";
  const { following, ready: followReady, follow, unfollow } = useFollowing(me);
  const prefs = useFeedPrefs(me);
  const saved = useSaved(me);
  const { blocked, block } = useBlocked(me);

  const [sparked, setSparked] = useState(() => new Set());
  const [delta, setDelta] = useState({});
  const asked = useRef(new Set());
  const busy = useRef(new Set());
  const [reportInfo, setReportInfo] = useState(null);
  const [blockPerson, setBlockPerson] = useState(null);
  const [gate, setGate] = useState(""); // signed-out visitor tried something: which action
  const guest = !me;
  // Signed out: show the "Join Snaprium" dialog and return true (so the caller stops).
  const requireAuth = useCallback((action) => {
    if (me) return false;
    setGate(action || "default");
    return true;
  }, [me]);

  const meInfo = useMemo(
    () => ({ uid: me, displayName: publicName(user), photoURL: user?.photoURL || "" }),
    [me, user?.displayName, user?.photoURL]
  );

  // Look up my Sparks for posts that are about to be shown (each id only once).
  const loadSparks = useCallback(
    async (ids) => {
      if (!me) return;
      const todo = ids.filter((id) => !asked.current.has(id));
      if (!todo.length) return;
      todo.forEach((id) => asked.current.add(id));
      const mine = await fetchMySparks(me, todo);
      if (mine.size) setSparked((prev) => new Set([...prev, ...mine]));
    },
    [me]
  );

  const toggleSpark = useCallback(
    async (post) => {
      if (requireAuth("spark")) return;
      if (busy.current.has(post.id)) return;
      busy.current.add(post.id);
      const on = !sparked.has(post.id);
      setSparked((prev) => {
        const n = new Set(prev);
        on ? n.add(post.id) : n.delete(post.id);
        return n;
      });
      const others = post.uid !== me;
      setDelta((d) => ({ ...d, [post.id]: (d[post.id] || 0) + (on ? 1 : -1) }));
      try {
        await setSpark({ post, me, on });
        asked.current.add(post.id);
        if (on && others) {
          rememberInteraction(post.uid);
          notifyPost({ to: post.uid, type: "post_spark", from: meInfo, post, key: me });
        }
      } catch (err) {
        console.warn("[spark]", err?.message || err);
        setSparked((prev) => {
          const n = new Set(prev);
          on ? n.delete(post.id) : n.add(post.id);
          return n;
        });
        setDelta((d) => ({ ...d, [post.id]: (d[post.id] || 0) + (on ? -1 : 1) }));
        toast.error("Could not update. Please try again.");
      } finally {
        busy.current.delete(post.id);
      }
    },
    [me, sparked, meInfo, requireAuth]
  );

  const toggleFollow = useCallback(
    async (uid) => {
      if (requireAuth("follow")) return;
      if (!uid || uid === me) return;
      try {
        if (following.has(uid)) {
          await unfollow(uid);
        } else {
          await follow(uid);
          notifyPost({ to: uid, type: "follow", from: meInfo });
        }
      } catch (err) {
        console.warn("[follow]", err?.message || err);
        toast.error("Could not update. Please try again.");
      }
    },
    [me, following, follow, unfollow, meInfo, requireAuth]
  );

  const toggleSave = useCallback(
    async (postId) => {
      if (requireAuth("save")) return;
      try {
        const was = saved.ids.has(postId);
        await saved.toggle(postId);
        toast.info(was ? "Removed from Saved" : "Saved");
      } catch {
        toast.error("Could not save. Please try again.");
      }
    },
    [saved, requireAuth]
  );

  const value = useMemo(
    () => ({
      me,
      guest,
      requireAuth,
      user,
      meInfo,
      following,
      followReady,
      toggleFollow,
      prefs,
      saved,
      blocked,
      sparked,
      delta,
      loadSparks,
      toggleSpark,
      toggleSave,
      openReport: (info) => { if (!requireAuth("default")) setReportInfo(info); },
      openBlock: setBlockPerson,
    }),
    [me, guest, requireAuth, user, meInfo, following, followReady, toggleFollow, prefs, saved, blocked, sparked, delta, loadSparks, toggleSpark, toggleSave]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {gate && <SignInGate action={gate} onClose={() => setGate("")} />}
      <ReportDialog info={reportInfo} user={user} onClose={() => setReportInfo(null)} onAlsoBlock={(info) => block({ uid: info.contentUid, name: info.contentName, photo: "" })} />
      <BlockDialog person={blockPerson} onConfirm={(p) => block(p)} onClose={() => setBlockPerson(null)} />
    </Ctx.Provider>
  );
}
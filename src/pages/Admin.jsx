// src/pages/Admin.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  query,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const ADMIN_UIDS = ["PASTE_YOUR_FIREBASE_UID_HERE"];

export default function Admin() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);

  const allowed = user && ADMIN_UIDS.includes(user.uid);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const userSnap = await getDocs(query(collection(db, "users"), limit(100)));
      setUsers(userSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const communitySnap = await getDocs(query(collection(db, "communities"), limit(100)));
      setCommunities(communitySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })().catch((err) => {
      console.error(err);
      toast.error("Admin list failed. Check Firestore rules.");
    });
  }, [allowed]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const banUser = async (id, banned) => {
    await updateDoc(doc(db, "users", id), { banned });
    setUsers((rows) => rows.map((u) => (u.id === id ? { ...u, banned } : u)));
    toast.success(banned ? "User banned" : "User unbanned");
  };

  const deleteCommunity = async (id) => {
    await updateDoc(doc(db, "communities", id), { deleted: true });
    setCommunities((rows) => rows.filter((c) => c.id !== id));
    toast.success("Community unlisted");
  };

  return (
    <div className="hub-page">
      <p className="hub-kicker">Owner</p>
      <h1 className="hub-title">Control</h1>
      <p className="hub-sub">Private. Not in the bottom nav. Emails stay here, never in public lists.</p>

      <h2 className="hub-title" style={{ fontSize: "1.2rem", marginTop: 28 }}>Users</h2>
      <div className="community-list">
        {users.map((u) => (
          <div key={u.id} className="community-row">
            <strong>{u.email || u.id}</strong>
            <p>
              {u.plan || "free"} · {u.banned ? "BANNED" : "active"}
            </p>
            <button type="button" onClick={() => banUser(u.id, !u.banned)}>
              {u.banned ? "Unban" : "Ban"}
            </button>
          </div>
        ))}
      </div>

      <h2 className="hub-title" style={{ fontSize: "1.2rem", marginTop: 28 }}>Communities</h2>
      <div className="community-list">
        {communities.filter((c) => !c.deleted).map((c) => (
          <div key={c.id} className="community-row">
            <strong>{c.name}</strong>
            <p>
              {c.tag} · {c.visibility} · {c.memberCount || 0} members · {c.createdByName}
            </p>
            <button type="button" onClick={() => deleteCommunity(c.id)}>
              Unlist
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
// src/pages/Community.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community.css";
import {
  COMMUNITY_TAGS,
  createCommunity,
  listPublicCommunities,
  listMyCommunities,
  joinCommunityByCode,
} from "../lib/communities";

const isUnlimitedPlan = (plan) => plan === "unlimited" || plan === "premium";

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [list, setList] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [name, setName] = useState("");
  const [newTag, setNewTag] = useState("Math");
  const [visibility, setVisibility] = useState("public");
  const [role, setRole] = useState("student");
  const [saving, setSaving] = useState(false);

  const load = async (selectedTag = tag) => {
    setLoading(true);
    try {
      const [rows, own] = await Promise.all([
        listPublicCommunities(selectedTag),
        user?.uid ? listMyCommunities(user.uid) : Promise.resolve([]),
      ]);
      setList(rows);
      setMine(own);
    } catch (err) {
      console.error(err);
      toast.error("Could not load communities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, [user?.uid]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [list, search]);

  const hostedCount = mine.filter((c) => c.createdBy === user?.uid).length;

  const handleJoinCode = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to join a community");
      navigate("/login");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.warning("Enter the community code");
      return;
    }
    setJoining(true);
    try {
      const community = await joinCommunityByCode(code, user.uid);
      toast.success("Joined community");
      setJoinCode("");
      navigate(`/community/${community.id}`);
    } catch (err) {
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to create a community");
      navigate("/login");
      return;
    }
    if (!isUnlimitedPlan(user.plan) && hostedCount >= 1) {
      toast.info("Free accounts can create 1 community. Upgrade to create more.");
      setShowUpgradeModal(true);
      return;
    }
    setSaving(true);
    try {
      const created = await createCommunity({
        name,
        tag: newTag,
        visibility,
        role,
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split("@")[0] || "Member",
      });
      toast.success("Community created");
      setShowCreate(false);
      setName("");
      navigate(`/community/${created.id}`);
    } catch (err) {
      toast.error(err.message || "Could not create community");
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (c) => (
    <button
      key={c.id}
      type="button"
      className="community-row"
      onClick={() => navigate(`/community/${c.id}`)}
    >
      <div className="community-row-main">
        <span
          className="community-row-avatar"
          style={c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : undefined}
        />
        <div>
          <strong>{c.name}</strong>
          <p>
            {c.tag} · {c.memberCount || 1} members
            {c.visibility === "private" ? " · Private" : ""}
            {c.role === "tutor" ? " · Tutor" : ""}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="hub-page">
      <header className="hub-top">
        <p className="hub-kicker">Communities</p>
        <h1 className="hub-title">Find a class or start one</h1>
        <p className="hub-sub">Your private groups stay under Your communities. Public groups are listed below.</p>
      </header>

      <form className="community-toolbar" onSubmit={handleJoinCode}>
        <input
          className="community-search"
          placeholder="Enter invite code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={8}
        />
        <button type="submit" className="community-create-btn" disabled={joining}>
          {joining ? "Joining..." : "Join with code"}
        </button>
      </form>

      <div className="community-toolbar">
        <input
          className="community-search"
          placeholder="Search public communities"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="community-create-btn" onClick={() => setShowCreate(true)}>
          Create community
        </button>
      </div>

      {mine.length > 0 && (
        <>
          <h2 className="community-section-title">Your communities</h2>
          <div className="community-list">{mine.map(renderRow)}</div>
        </>
      )}

      <div className="community-tags">
        <button type="button" className={!tag ? "tag on" : "tag"} onClick={() => { setTag(""); load(""); }}>
          All
        </button>
        {COMMUNITY_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={tag === item ? "tag on" : "tag"}
            onClick={() => {
              setTag(item);
              load(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="hub-sub">Loading communities…</p>
      ) : visible.length === 0 ? (
        <p className="hub-sub">No public communities yet.</p>
      ) : (
        <div className="community-list">{visible.map(renderRow)}</div>
      )}

      {showCreate && (
        <form className="study-card" onSubmit={handleCreate}>
          <h2>Create community</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Calculus study group)"
            maxLength={60}
            required
          />
          <select value={newTag} onChange={(e) => setNewTag(e.target.value)} required>
            {COMMUNITY_TAGS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public — listed and searchable</option>
            <option value="private">Private — invite only</option>
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">I am a student</option>
            <option value="tutor">I am a tutor / teacher</option>
          </select>
          <button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={() => setShowCreate(false)}>
            Cancel
          </button>
        </form>
      )}

      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
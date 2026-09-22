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
      const rows = await listPublicCommunities(selectedTag);
      setList(rows);
    } catch (err) {
      console.error(err);
      toast.error("Could not load communities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [list, search]);

  const hostedCount = list.filter((c) => c.createdBy === user?.uid).length;

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
      console.error(err);
      toast.error(err.message || "Could not create community");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hub-page">
      <header className="hub-top">
        <p className="hub-kicker">Communities</p>
        <h1 className="hub-title">Find a class or start one</h1>
        <p className="hub-sub">Public groups are listed here. Private groups join with a code.</p>
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
        <p className="hub-sub">No public communities yet. Create the first one.</p>
      ) : (
        <div className="community-list">
          {visible.map((c) => (
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
                    {c.role === "tutor" ? " · Tutor" : ""}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
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
// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../lib/firebase";
import "../styles/profile.css";

function compressImage(file, max = 240, quality = 0.55) {
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

export default function Profile() {
  const { user, loading, refreshUser, signOutUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    setName(user.displayName || "");
    if (user.photoURL) setPreview(user.photoURL);
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="profile-page">
        <p className="profile-hint">Loading profile…</p>
      </div>
    );
  }

  if (!user) return null;

    const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 40);
    if (!clean) {
      toast.warning("Enter a display name");
      return;
    }
    setSaving(true);
    try {
      // Firestore is source of truth for the app
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: clean,
          email: user.email || auth.currentUser?.email || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // Keep Auth in sync (optional but good)
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: clean });
      }
      await refreshUser?.();
      toast.success("Profile updated");
    } catch (err) {
      console.error("[profile] save", err);
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving(true);
    try {
      const photoURL = await compressImage(file);
      setPreview(photoURL);
            await setDoc(
        doc(db, "users", user.uid),
        {
          photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // Don't push huge data: URLs into Auth updateProfile — Firestore only
      await refreshUser?.();
      toast.success("Photo updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not update photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-top">
        <h1>Profile</h1>
        <p>This name and photo show in circles and rooms.</p>
      </header>

      <button
        type="button"
        className="profile-avatar"
        onClick={() => fileRef.current?.click()}
        disabled={saving}
        aria-label="Change photo"
      >
        {preview ? (
          <img src={preview} alt="" />
        ) : (
          (user.displayName || "U").slice(0, 1).toUpperCase()
        )}
      </button>
      <p className="profile-hint">Tap to change photo</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />

      <form className="profile-card" onSubmit={save}>
        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <p className="profile-email">{user.email}</p>
        <button type="submit" className="profile-save" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="profile-out"
          onClick={async () => {
            await signOutUser();
            navigate("/");
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
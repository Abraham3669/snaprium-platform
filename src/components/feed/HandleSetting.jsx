// src/components/feed/HandleSetting.jsx  -  "Username" line on your own profile
import { useState } from "react";
import { useMyHandle } from "../../lib/handles";
import HandleDialog from "./HandleDialog";
import "../../styles/feed.css";

export default function HandleSetting({ user }) {
  const mine = useMyHandle(user?.uid);
  const [open, setOpen] = useState(false);
  if (!user?.uid || !mine.ready) return null;
  return (
    <div className="fd-handle-row">
      <span className="fd-handle">{mine.handle ? `@${mine.handle}` : "No username yet"}</span>
      <button type="button" className="fd-link" onClick={() => setOpen(true)}>{mine.handle ? "Change" : "Choose a username"}</button>
      {open && <HandleDialog user={user} current={mine.handle} card={mine.card} onClose={() => setOpen(false)} onDone={() => mine.refresh()} />}
    </div>
  );
}
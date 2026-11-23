// src/components/feed/SearchBox.jsx  -  the search field on Home. Submitting opens the search page.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon } from "./Icons";

export default function SearchBox({ className = "", initial = "", autoFocus = false, live = false, onChange }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  const go = (e) => {
    e.preventDefault();
    const t = q.trim();
    if (t) navigate(`/search?q=${encodeURIComponent(t)}`);
  };
  return (
    <form className={`fd-search ${className}`} role="search" onSubmit={go}>
      <SearchIcon />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          if (live) onChange?.(e.target.value);
        }}
        placeholder="Search people and posts"
        aria-label="Search people and posts"
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        maxLength={60}
      />
    </form>
  );
}
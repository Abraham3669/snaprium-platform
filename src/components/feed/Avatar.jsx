export default function Avatar({ name = "", photo = "", size = 40, onClick, label }) {
  const letter = (name || "?").trim().slice(0, 1).toUpperCase() || "?";
  const inner = photo ? <img src={photo} alt="" loading="lazy" /> : <span>{letter}</span>;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (onClick)
    return (
      <button type="button" className="fd-avatar" style={style} onClick={onClick} aria-label={label || `Open ${name || "profile"}`}>
        {inner}
      </button>
    );
  return (
    <span className="fd-avatar" style={style} aria-hidden="true">
      {inner}
    </span>
  );
}
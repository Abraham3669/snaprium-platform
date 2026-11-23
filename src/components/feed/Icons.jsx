// Small inline icons for the feed (same stroke style as the rest of the app).
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
export const SparkIcon = ({ filled }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2z" /></svg>
);
export const ReplyIcon = () => (
  <svg {...base}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
);
export const SaveIcon = ({ filled }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);
export const ShareIcon = () => (
  <svg {...base}><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
);
export const MoreIcon = () => (
  <svg {...base}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></svg>
);
export const PlusIcon = () => (
  <svg {...base}><path d="M12 4v16M4 12h16" /></svg>
);
export const ImageIcon = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 9" /></svg>
);
export const HomeIcon = () => (
  <svg {...base}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>
);
export const CirclesIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
);
export const ChatIcon = ReplyIcon;
export const BellIcon = () => (
  <svg {...base}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
export const UserIcon = () => (
  <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
);
export const CameraIcon = () => (
  <svg {...base}><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const CheckIcon = () => (
  <svg {...base}><path d="M20 6L9 17l-5-5" /></svg>
);
export const CloseIcon = () => (
  <svg {...base}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
export const BackIcon = () => (
  <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
);
export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
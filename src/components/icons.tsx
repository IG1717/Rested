// SF Symbols–style line icons drawn as inline SVG.
type P = { className?: string };

export const ChevronLeft = (p: P) => (
  <svg viewBox="0 0 13 21" fill="none" aria-hidden {...p}>
    <path d="M11 2 2.5 10.5 11 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronRight = ({ className = "chevron" }: P) => (
  <svg viewBox="0 0 8 14" fill="none" aria-hidden className={className}>
    <path d="m1.5 1.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StepLeft = (p: P) => (
  <svg viewBox="0 0 10 16" fill="none" aria-hidden {...p}>
    <path d="M8 2 2 8l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StepRight = (p: P) => (
  <svg viewBox="0 0 10 16" fill="none" aria-hidden {...p}>
    <path d="m2 2 6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShareIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
    <path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const PeopleIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 28 28" aria-hidden {...p}>
    <circle cx="10.5" cy="9" r="4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 22c0-4 3.4-6.5 7.5-6.5S18 18 18 22v.5H3z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="19.5" cy="10" r="3.2" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
    <path d="M20 16c3 .2 5 2.3 5 5.5v1h-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PersonAddIcon = (p: P) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden {...p}>
    <circle cx="11" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.9" />
    <path d="M3.5 22.5c0-4 3.3-6.7 7.5-6.7 1.6 0 3 .4 4.2 1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M21 15v8M17 19h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const TrophyIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 28 28" aria-hidden {...p}>
    <path d="M8.5 4.5h11v6.5a5.5 5.5 0 0 1-11 0z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M8.5 7H5.5v1.5A3.5 3.5 0 0 0 9 12M19.5 7h3v1.5A3.5 3.5 0 0 1 19 12M14 16.5v4M9.5 23.5h9M11 20.5h6v3h-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PersonIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 28 28" aria-hidden {...p}>
    <circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="14" cy="11" r="4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
    <path d="M6.5 22c1.5-3 4.2-4.5 7.5-4.5s6 1.5 7.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const MoonIcon = (p: P) => (
  <svg viewBox="0 0 30 30" fill="none" aria-hidden {...p}>
    <path d="M24.5 18.6A10.5 10.5 0 0 1 11.4 5.5a10.5 10.5 0 1 0 13.1 13.1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const WalkIcon = (p: P) => (
  <svg viewBox="0 0 30 30" fill="none" aria-hidden {...p}>
    <circle cx="16.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="2" />
    <path d="m11 27 3.5-8 3 3V27M14.5 19l1.5-8.5-4 2-2 4M16 10.5l3 4.5 3.5 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChartIcon = (p: P) => (
  <svg viewBox="0 0 30 30" fill="none" aria-hidden {...p}>
    <path d="M4 25h22M7 21v-6M13 21V9M19 21v-9M25 21V5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const GoogleG = (p: P) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p} width="20" height="20">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

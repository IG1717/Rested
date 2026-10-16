/* eslint-disable @next/next/no-img-element */

export function memberColor(slot: number) {
  return `var(--m${slot % 8})`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({
  name,
  url,
  slot = 0,
  size,
  ring,
}: {
  name: string;
  url?: string | null;
  slot?: number;
  size?: "lg";
  ring?: boolean;
}) {
  return (
    <span
      className={`avatar${size ? ` ${size}` : ""}${ring ? " ring" : ""}`}
      style={{ "--c": memberColor(slot) } as React.CSSProperties}
      aria-hidden
    >
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}

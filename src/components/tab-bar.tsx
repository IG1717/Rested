"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeopleIcon, PersonIcon, TrophyIcon } from "./icons";

const TABS = [
  { href: "/", label: "Leaderboard", Icon: TrophyIcon },
  { href: "/friends", label: "Friends", Icon: PeopleIcon },
  { href: "/me", label: "You", Icon: PersonIcon },
] as const;

export function TabBar({ unseen = 0 }: { unseen?: number }) {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Tabs">
      <div className="tabbar-inner">
        {TABS.map(({ href, label, Icon }) => {
          // Profiles and recaps open from the leaderboard, so they live under its tab.
          const active =
            href === "/" ? path === "/" || path.startsWith("/week") || path.startsWith("/f/") : path.startsWith(href);
          const badge = href === "/friends" && unseen > 0 ? unseen : 0;
          return (
            <Link
              key={href}
              href={href}
              transitionTypes={["tab"]}
              className="tab"
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${badge} new reaction${badge === 1 ? "" : "s"}` : undefined}
            >
              <span className="tab-icon">
                <Icon filled={active} />
                {badge > 0 && <span className="tab-badge">{badge > 9 ? "9+" : badge}</span>}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

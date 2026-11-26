"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeopleIcon, PersonIcon, TrophyIcon } from "./icons";

const TABS = [
  { href: "/", label: "Leaderboard", Icon: TrophyIcon },
  { href: "/friends", label: "Friends", Icon: PeopleIcon },
  { href: "/me", label: "You", Icon: PersonIcon },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Tabs">
      <div className="tabbar-inner">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className="tab" aria-current={active ? "page" : undefined}>
              <Icon filled={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

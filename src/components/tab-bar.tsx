"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeopleIcon, PersonIcon } from "./icons";

export function TabBar() {
  const path = usePathname();
  const onMe = path.startsWith("/me");
  return (
    <nav className="tabbar" aria-label="Tabs">
      <div className="tabbar-inner">
        <Link href="/" className="tab" aria-current={!onMe ? "page" : undefined}>
          <PeopleIcon filled={!onMe} />
          Groups
        </Link>
        <Link href="/me" className="tab" aria-current={onMe ? "page" : undefined}>
          <PersonIcon filled={onMe} />
          You
        </Link>
      </div>
    </nav>
  );
}

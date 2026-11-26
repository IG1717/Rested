"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "./icons";

/**
 * iOS-style navigation bar: a large title in the content that, once scrolled under the bar,
 * hands off to a compact centered title on a translucent material.
 */
export function NavBar({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  right?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), {
      rootMargin: "-52px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <header className="navbar" data-scrolled={scrolled}>
        <div className="navbar-bg" />
        <div className="navbar-inner">
          <div className="navbar-left">
            {back && (
              <Link href={back.href} transitionTypes={["nav-back"]} className="nav-btn back">
                <ChevronLeft />
                {back.label}
              </Link>
            )}
          </div>
          <div className="navbar-title" aria-hidden={!scrolled}>
            {title}
          </div>
          <div className="navbar-right">{right}</div>
        </div>
      </header>
      <h1 className="large-title">
        {title}
        {subtitle && <span className="sub">{subtitle}</span>}
      </h1>
      <div ref={sentinel} style={{ height: 1, marginTop: -1 }} />
    </>
  );
}

import { ViewTransition, type ReactNode } from "react";

// iOS-style navigation: deeper screens slide in from the right ("nav-forward"), going back
// slides them out ("nav-back"), tab switches crossfade ("tab"). Untyped transitions (refresh,
// browser back) don't animate. Wrap each page's content; layouts persist so they never animate.
const map = { "nav-forward": "nav-forward", "nav-back": "nav-back", tab: "tab-fade", default: "none" };

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={map} exit={map} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}

/** Shared element (e.g. an avatar) that morphs between screens. Names must be unique per page. */
export function Morph({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

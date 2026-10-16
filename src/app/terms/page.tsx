import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Use · Rested" };

export default function TermsPage() {
  return (
    <main className="doc">
      <Link href="/" className="doc-back">
        ‹ Rested
      </Link>
      <h1>Terms of Use</h1>
      <p className="doc-meta">Last updated October 16, 2026</p>

      <p>
        Rested is a free hobby project for friends to compare sleep and activity stats. By using it you agree to
        these terms.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Rested&apos;s rankings are for fun and friendly competition. They are not medical
        advice and are not meant to diagnose, treat or prevent any condition. Talk to a doctor about health
        concerns.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with your own Google account and are responsible for which groups you join and who you share
        invite links with. Be kind. Don&apos;t use Rested to harass anyone.
      </p>

      <h2>No warranty</h2>
      <p>
        Rested is provided as is, with no guarantees of accuracy or availability. Stats depend on Google Health
        and your tracker, and may be delayed or missing. The service may change or shut down at any time.
      </p>

      <h2>Privacy</h2>
      <p>
        See the <Link href="/privacy">Privacy Policy</Link> for what data Rested uses and how to delete it.
      </p>
    </main>
  );
}

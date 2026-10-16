import { requireUser } from "@/lib/session";
import { createGroup } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { SubmitButton } from "@/components/client-buttons";

const EMOJI = ["🏆", "🛌", "🌙", "🔥", "🏃", "💪", "⚡️", "🦉", "🐻", "🌊", "🏔️", "🎯"];

export default async function NewGroupPage() {
  await requireUser("/groups/new");
  return (
    <>
      <NavBar title="New Group" back={{ href: "/", label: "Groups" }} />
      <form action={createGroup} className="content">
        <section className="section">
          <h2 className="section-header">Name</h2>
          <div className="list">
            <label className="visually-hidden" htmlFor="name">
              Group name
            </label>
            <input
              id="name"
              name="name"
              className="field"
              placeholder="e.g. College Crew"
              maxLength={40}
              required
              autoFocus
              autoComplete="off"
            />
          </div>
        </section>
        <section className="section">
          <h2 className="section-header">Icon</h2>
          <fieldset className="list emoji-grid" style={{ border: 0 }}>
            <legend className="visually-hidden">Group icon</legend>
            {EMOJI.map((e, i) => (
              <label key={e}>
                <input type="radio" name="emoji" value={e} defaultChecked={i === 0} />
                {e}
              </label>
            ))}
          </fieldset>
        </section>
        <section className="section">
          <SubmitButton>Create Group</SubmitButton>
          <p className="section-footer">You&apos;ll get an invite link to share next.</p>
        </section>
      </form>
    </>
  );
}

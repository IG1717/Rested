// Short display names for leaderboards: nickname or first name, with a last initial added
// when two people in the same circle would otherwise look identical ("Sam K." / "Sam R.").

export function shortNames(people: { id: string; name: string; nickname?: string | null }[]) {
  const base = (p: (typeof people)[number]) => (p.nickname?.trim() || p.name.trim().split(/\s+/)[0] || "Friend");
  const counts = new Map<string, number>();
  for (const p of people) {
    const b = base(p).toLowerCase();
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return new Map(
    people.map((p) => {
      const b = base(p);
      if ((counts.get(b.toLowerCase()) ?? 0) < 2 || p.nickname?.trim()) return [p.id, b];
      const parts = p.name.trim().split(/\s+/);
      const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : "";
      return [p.id, `${b}${initial}`];
    }),
  );
}

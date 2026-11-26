import { describe, expect, it } from "vitest";
import { shortNames } from "@/lib/names";

describe("shortNames", () => {
  it("uses first names, adding a last initial only when two collide", () => {
    const m = shortNames([
      { id: "1", name: "Sam Kim" },
      { id: "2", name: "Sam Ruiz" },
      { id: "3", name: "Alex Moore" },
      { id: "4", name: "Jo", nickname: "  " },
    ]);
    expect([...m.values()]).toEqual(["Sam K.", "Sam R.", "Alex", "Jo"]);
  });

  it("prefers nicknames", () => {
    expect(shortNames([{ id: "1", name: "Samuel Kim", nickname: "Sammy" }]).get("1")).toBe("Sammy");
  });
});

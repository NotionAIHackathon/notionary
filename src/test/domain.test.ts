import { describe, it, expect } from "vitest";
import { dublinInstant, validateAnswer } from "../../supabase/functions/notionary/domain";
describe("Dublin deadline conversion", () => {
  it("uses Irish summer time before the clock change", () => {
    expect(dublinInstant("2026-10-19T17:00")).toBe("2026-10-19T16:00:00.000Z");
  });
  it("uses UTC in winter", () => {
    expect(dublinInstant("2026-10-26T17:00")).toBe("2026-10-26T17:00:00.000Z");
  });
  it("rejects impossible dates and ambiguous/nonexistent clock-change times", () => {
    for (const date of ["2026-02-30T17:00", "2026-03-29T01:30", "2026-10-25T01:30", "invalid"])
      expect(() => dublinInstant(date)).toThrow();
  });
});
describe("AI response boundary", () => {
  it("rejects invented citations and malformed blocks", () => {
    expect(() =>
      validateAnswer({ blocks: [{ text: "Claim", citations: ["invented"] }] }, ["lecture"]),
    ).toThrow();
    expect(() =>
      validateAnswer({ blocks: [{ text: "Claim", citations: [], teachingExample: "yes" }] }, [
        "lecture",
      ]),
    ).toThrow();
    expect(() => validateAnswer({ blocks: [] }, ["lecture"])).toThrow();
  });
  it("accepts cited facts, labelled teaching examples and unsupported answers", () => {
    const blocks = [
      { text: "Fact", citations: ["lecture"] },
      { text: "Analogy", citations: [], teachingExample: true },
      { text: "The sources do not support this.", citations: [] },
    ];
    expect(validateAnswer({ blocks }, ["lecture"]).blocks).toHaveLength(3);
  });
});

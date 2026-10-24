import { expect, it } from "vitest";
import { partyStyle, changeLabel, leadLabel } from "../src/lib/polling-display";
import { historySeries } from "../src/lib/agent/evidence";

it("uses declared parties, retaining neutral color for unknown or conflicting labels", () => {
  expect(partyStyle("Democratic")).toEqual(partyStyle("D"));
  expect(partyStyle("Republican")).toEqual(partyStyle("R"));
  expect(partyStyle(null).color).not.toBe(partyStyle("R").color);
  const result = historySeries({
    columns: ["date", "results", "spread"],
    rows: [
      ["2026-10-01", [["A", "D", 48]], null],
      ["2026-10-02", [["A", "R", 49]], null],
    ],
  });
  expect(result?.[0].party).toBeNull();
});
it("distinguishes change from lead and never treats missing observations as zero", () => {
  expect(changeLabel(48.8, 48.5)).toBe("+0.3 pp");
  expect(changeLabel(48, 49)).toBe("-1 pp");
  expect(changeLabel(48, null)).toBe("Change unavailable");
  expect(
    leadLabel([
      { name: "A", value: 48.8 },
      { name: "B", value: 47.4 },
    ]),
  ).toBe("A +1.4 pp vs B");
  expect(
    leadLabel([
      { name: "A", value: 48 },
      { name: "B", value: 48 },
    ]),
  ).toBe("Tied");
  expect(
    leadLabel([
      { name: "A", value: 48 },
      { name: "B", value: null },
    ]),
  ).toContain("incomplete data");
});

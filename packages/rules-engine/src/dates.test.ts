import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, isoDate, startOfUtcDay } from "./dates";

const d = (s: string) => new Date(s);

describe("dates", () => {
  it.each([
    ["2026-09-30T23:59:00Z", "2026-10-01T00:01:00Z", 1], // crosses midnight: 1 calendar day
    ["2026-09-30T00:00:00Z", "2026-11-14T00:00:00Z", 45],
    ["2026-09-30T10:00:00Z", "2026-09-30T22:00:00Z", 0],
    ["2026-10-09T00:00:00Z", "2026-09-30T00:00:00Z", -9],
    ["2028-02-28T00:00:00Z", "2028-03-01T00:00:00Z", 2], // leap year
  ])("daysBetween(%s, %s) = %i", (a, b, expected) => {
    expect(daysBetween(d(a), d(b))).toBe(expected);
  });

  it.each([
    ["2026-01-31T00:00:00Z", 1, "2026-02-28"],
    ["2028-01-31T00:00:00Z", 1, "2028-02-29"],
    ["2026-09-30T00:00:00Z", -6, "2026-03-30"],
    ["2026-11-15T00:00:00Z", 2, "2027-01-15"],
    ["2026-03-31T00:00:00Z", -1, "2026-02-28"],
  ])("addMonths(%s, %i) = %s", (start, months, expected) => {
    expect(isoDate(addMonths(d(start), months))).toBe(expected);
  });

  it("addDays and startOfUtcDay", () => {
    expect(isoDate(addDays(d("2026-09-30T12:00:00Z"), 45))).toBe("2026-11-14");
    expect(startOfUtcDay(d("2026-09-30T12:34:56Z")).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});

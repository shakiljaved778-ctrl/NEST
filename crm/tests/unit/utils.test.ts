import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizePhone, toCsv, csvEscape, fmtMoney } from "@/lib/utils";
import { toTsQuery } from "@/lib/fts";

describe("normalization (duplicate detection)", () => {
  it("normalizes emails to lowercase", () => {
    expect(normalizeEmail("  John.Doe@Example.QA ")).toBe("john.doe@example.qa");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("normalizes phones to comparable digits", () => {
    expect(normalizePhone("+974 5555 1234")).toBe("97455551234");
    expect(normalizePhone("0097455551234")).toBe("97455551234");
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('has "quote"')).toBe('"has ""quote"""');
    expect(csvEscape(null)).toBe("");
  });

  it("builds a CSV with header and rows", () => {
    const csv = toCsv(["Name", "Score"], [["Ahmed", 90], ["Fatima, Ali", 85]]);
    expect(csv).toBe('Name,Score\r\nAhmed,90\r\n"Fatima, Ali",85');
  });
});

describe("money formatting", () => {
  it("formats QAR by default", () => {
    const s = fmtMoney(4500);
    expect(s).toContain("4,500");
    expect(s).toMatch(/QAR|ر\.ق/);
  });
  it("returns em-dash for null", () => {
    expect(fmtMoney(null)).toBe("—");
  });
});

describe("full-text query builder", () => {
  it("builds a prefix AND query", () => {
    expect(toTsQuery("fin tech")).toBe("fin:* & tech:*");
  });
  it("strips punctuation and empties", () => {
    expect(toTsQuery("  hello!!  ")).toBe("hello:*");
    expect(toTsQuery("")).toBe("");
  });
});

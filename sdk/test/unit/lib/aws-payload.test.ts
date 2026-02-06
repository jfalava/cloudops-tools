import { describe, expect, test } from "bun:test";

import {
  asBoolean,
  asDate,
  asNumber,
  asString,
  getNameTag,
  isObjectRecord,
  normalizeArray,
  tagListToRecord,
} from "../../../src/lib/aws-payload";

describe("isObjectRecord", () => {
  test("returns false for null", () => {
    expect(isObjectRecord(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isObjectRecord(undefined)).toBe(false);
  });

  test("returns false for arrays", () => {
    expect(isObjectRecord([])).toBe(false);
    expect(isObjectRecord([1, 2, 3])).toBe(false);
  });

  test("returns true for Dates (they are objects)", () => {
    // Note: Dates are technically objects, not arrays
    expect(isObjectRecord(new Date())).toBe(true);
  });

  test("returns false for functions", () => {
    expect(isObjectRecord(() => "test")).toBe(false);
    expect(
      isObjectRecord(function () {
        return "test";
      }),
    ).toBe(false);
  });

  test("returns true for plain objects", () => {
    expect(isObjectRecord({})).toBe(true);
    expect(isObjectRecord({ a: 1 })).toBe(true);
    expect(isObjectRecord({ nested: { a: 1 } })).toBe(true);
  });

  test("returns true for class instances", () => {
    class MyClass {
      value = 42;
    }
    expect(isObjectRecord(new MyClass())).toBe(true);
  });

  test("returns false for primitives", () => {
    expect(isObjectRecord("string")).toBe(false);
    expect(isObjectRecord(123)).toBe(false);
    expect(isObjectRecord(true)).toBe(false);
    expect(isObjectRecord(0)).toBe(false);
    expect(isObjectRecord("")).toBe(false);
  });
});

describe("normalizeArray", () => {
  test("returns empty array for null", () => {
    expect(normalizeArray(null)).toEqual([]);
  });

  test("returns empty array for undefined", () => {
    expect(normalizeArray(undefined)).toEqual([]);
  });

  test("wraps scalar values in array", () => {
    expect(normalizeArray("string")).toEqual(["string"]);
    expect(normalizeArray(123)).toEqual([123]);
    expect(normalizeArray(true)).toEqual([true]);
    expect(normalizeArray({ a: 1 })).toEqual([{ a: 1 }]);
  });

  test("returns array as-is", () => {
    expect(normalizeArray([])).toEqual([]);
    expect(normalizeArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(normalizeArray([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("handles nested arrays", () => {
    const nested = [
      [1, 2],
      [3, 4],
    ];
    expect(normalizeArray(nested)).toEqual(nested);
  });
});

describe("asString", () => {
  test("returns string for string input", () => {
    expect(asString("hello")).toBe("hello");
    expect(asString("")).toBe("");
    expect(asString("with spaces")).toBe("with spaces");
  });

  test("returns undefined for numbers", () => {
    expect(asString(123)).toBeUndefined();
    expect(asString(0)).toBeUndefined();
    expect(asString(-1.5)).toBeUndefined();
    expect(asString(NaN)).toBeUndefined();
    expect(asString(Infinity)).toBeUndefined();
  });

  test("returns undefined for booleans", () => {
    expect(asString(true)).toBeUndefined();
    expect(asString(false)).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(asString(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(asString(undefined)).toBeUndefined();
  });

  test("returns undefined for objects", () => {
    expect(asString({})).toBeUndefined();
    expect(asString({ toString: () => "hello" })).toBeUndefined();
  });

  test("returns undefined for arrays", () => {
    expect(asString([])).toBeUndefined();
    expect(asString(["hello"])).toBeUndefined();
  });
});

describe("asNumber", () => {
  test("returns number for finite numbers", () => {
    expect(asNumber(123)).toBe(123);
    expect(asNumber(0)).toBe(0);
    expect(asNumber(-1.5)).toBe(-1.5);
    expect(asNumber(1e10)).toBe(1e10);
  });

  test("returns undefined for NaN", () => {
    expect(asNumber(NaN)).toBeUndefined();
  });

  test("returns undefined for Infinity", () => {
    expect(asNumber(Infinity)).toBeUndefined();
    expect(asNumber(-Infinity)).toBeUndefined();
  });

  test("parses numeric strings", () => {
    expect(asNumber("123")).toBe(123);
    expect(asNumber("-1.5")).toBe(-1.5);
    expect(asNumber("0")).toBe(0);
    expect(asNumber("  42  ")).toBe(42);
  });

  test("returns undefined for whitespace-only strings", () => {
    expect(asNumber("   ")).toBeUndefined();
    expect(asNumber("")).toBeUndefined();
  });

  test("returns undefined for non-numeric strings", () => {
    expect(asNumber("hello")).toBeUndefined();
    expect(asNumber("12a")).toBeUndefined();
    expect(asNumber("abc123")).toBeUndefined();
  });

  test("returns undefined for booleans", () => {
    expect(asNumber(true)).toBeUndefined();
    expect(asNumber(false)).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(asNumber(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(asNumber(undefined)).toBeUndefined();
  });

  test("returns undefined for objects", () => {
    expect(asNumber({})).toBeUndefined();
    expect(asNumber({ valueOf: () => 42 })).toBeUndefined();
  });

  test("returns undefined for arrays", () => {
    expect(asNumber([])).toBeUndefined();
    expect(asNumber([1, 2, 3])).toBeUndefined();
  });
});

describe("asBoolean", () => {
  test("returns boolean for boolean input", () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
  });

  test("converts 1 to true", () => {
    expect(asBoolean(1)).toBe(true);
  });

  test("converts 0 to false", () => {
    expect(asBoolean(0)).toBe(false);
  });

  test("returns undefined for other numbers", () => {
    expect(asBoolean(2)).toBeUndefined();
    expect(asBoolean(-1)).toBeUndefined();
    expect(asBoolean(1.5)).toBeUndefined();
  });

  test("converts string 'true' to true", () => {
    expect(asBoolean("true")).toBe(true);
    expect(asBoolean("TRUE")).toBe(true);
    expect(asBoolean("True")).toBe(true);
    expect(asBoolean("  true  ")).toBe(true);
  });

  test("converts string '1' to true", () => {
    expect(asBoolean("1")).toBe(true);
  });

  test("converts string 'false' to false", () => {
    expect(asBoolean("false")).toBe(false);
    expect(asBoolean("FALSE")).toBe(false);
    expect(asBoolean("False")).toBe(false);
  });

  test("converts string '0' to false", () => {
    expect(asBoolean("0")).toBe(false);
  });

  test("returns undefined for other strings", () => {
    expect(asBoolean("yes")).toBeUndefined();
    expect(asBoolean("no")).toBeUndefined();
    expect(asBoolean("")).toBeUndefined();
    expect(asBoolean("hello")).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(asBoolean(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(asBoolean(undefined)).toBeUndefined();
  });

  test("returns undefined for objects", () => {
    expect(asBoolean({})).toBeUndefined();
  });

  test("returns undefined for arrays", () => {
    expect(asBoolean([])).toBeUndefined();
  });
});

describe("asDate", () => {
  test("returns Date object for valid Date", () => {
    const date = new Date("2024-01-15");
    expect(asDate(date)).toBe(date);
  });

  test("returns undefined for invalid Date", () => {
    expect(asDate(new Date("invalid"))).toBeUndefined();
  });

  test("parses ISO date strings", () => {
    const result = asDate("2024-01-15T10:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1705314600000);
  });

  test("parses date-only strings", () => {
    const result = asDate("2024-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getUTCFullYear()).toBe(2024);
  });

  test("parses timestamps", () => {
    const timestamp = 1705314600000;
    const result = asDate(timestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(timestamp);
  });

  test("returns undefined for invalid date strings", () => {
    expect(asDate("not-a-date")).toBeUndefined();
    expect(asDate("")).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(asDate(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(asDate(undefined)).toBeUndefined();
  });

  test("returns undefined for objects", () => {
    expect(asDate({})).toBeUndefined();
  });

  test("returns undefined for arrays", () => {
    expect(asDate([])).toBeUndefined();
  });

  test("returns undefined for booleans", () => {
    expect(asDate(true)).toBeUndefined();
  });
});

describe("tagListToRecord", () => {
  test("converts Key/Value tags", () => {
    const tags = [
      { Key: "Name", Value: "my-instance" },
      { Key: "Environment", Value: "production" },
    ];
    expect(tagListToRecord(tags)).toEqual({
      Name: "my-instance",
      Environment: "production",
    });
  });

  test("converts key/value tags", () => {
    const tags = [
      { key: "Name", value: "my-instance" },
      { key: "Environment", value: "production" },
    ];
    expect(tagListToRecord(tags)).toEqual({
      Name: "my-instance",
      Environment: "production",
    });
  });

  test("handles mixed Key/key and Value/value", () => {
    const tags = [
      { Key: "Name", value: "my-instance" },
      { key: "Environment", Value: "production" },
    ];
    expect(tagListToRecord(tags)).toEqual({
      Name: "my-instance",
      Environment: "production",
    });
  });

  test("skips entries with missing keys", () => {
    const tags = [
      { Key: "Name", Value: "my-instance" },
      { Value: "no-key" },
      { Key: "Environment" },
    ];
    expect(tagListToRecord(tags)).toEqual({
      Name: "my-instance",
    });
  });

  test("skips non-object entries", () => {
    const tags = [{ Key: "Name", Value: "my-instance" }, null, undefined, "string", 123, []];
    expect(tagListToRecord(tags)).toEqual({
      Name: "my-instance",
    });
  });

  test("returns empty object for null", () => {
    expect(tagListToRecord(null)).toEqual({});
  });

  test("returns empty object for undefined", () => {
    expect(tagListToRecord(undefined)).toEqual({});
  });

  test("returns empty object for empty array", () => {
    expect(tagListToRecord([])).toEqual({});
  });

  test("handles empty string values", () => {
    const tags = [{ Key: "Name", Value: "" }];
    expect(tagListToRecord(tags)).toEqual({
      Name: "",
    });
  });

  test("handles tags with non-string values", () => {
    const tags = [
      { Key: "Name", Value: "valid" },
      { Key: "Number", Value: 123 },
      { Key: "Boolean", Value: true },
    ];
    expect(tagListToRecord(tags)).toEqual({
      Name: "valid",
    });
  });
});

describe("getNameTag", () => {
  test("returns Name tag value when present", () => {
    const tags = [{ Key: "Name", Value: "my-instance" }];
    expect(getNameTag(tags)).toBe("my-instance");
  });

  test("returns Name tag with lowercase key", () => {
    const tags = [{ key: "Name", value: "my-instance" }];
    expect(getNameTag(tags)).toBe("my-instance");
  });

  test("returns undefined when Name tag is missing", () => {
    const tags = [{ Key: "Environment", Value: "production" }];
    expect(getNameTag(tags)).toBeUndefined();
  });

  test("returns undefined for empty tags", () => {
    expect(getNameTag([])).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(getNameTag(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(getNameTag(undefined)).toBeUndefined();
  });
});

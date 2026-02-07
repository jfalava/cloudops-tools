import { describe, expect, test } from "bun:test";

import { __internal } from "../../../src/progress";

describe("progress", () => {
  describe("formatDuration", () => {
    test("formats zero milliseconds", () => {
      expect(__internal.formatDuration(0)).toBe("0:00");
    });

    test("formats seconds only", () => {
      expect(__internal.formatDuration(30000)).toBe("0:30");
      expect(__internal.formatDuration(59000)).toBe("0:59");
    });

    test("formats minutes only", () => {
      expect(__internal.formatDuration(60000)).toBe("1:00");
      expect(__internal.formatDuration(120000)).toBe("2:00");
    });

    test("formats minutes and seconds", () => {
      expect(__internal.formatDuration(90000)).toBe("1:30");
      expect(__internal.formatDuration(125000)).toBe("2:05");
    });

    test("handles large durations", () => {
      expect(__internal.formatDuration(3600000)).toBe("60:00");
      expect(__internal.formatDuration(3661000)).toBe("61:01");
    });

    test("handles negative values", () => {
      expect(__internal.formatDuration(-1000)).toBe("0:00");
    });

    test("handles milliseconds correctly", () => {
      expect(__internal.formatDuration(500)).toBe("0:00");
      expect(__internal.formatDuration(1500)).toBe("0:01");
    });
  });

  describe("makeBar", () => {
    test("creates empty bar at 0%", () => {
      expect(__internal.makeBar(0)).toBe("[------------------]");
    });

    test("creates full bar at 100%", () => {
      expect(__internal.makeBar(100)).toBe("[##################]");
    });

    test("creates half bar at 50%", () => {
      expect(__internal.makeBar(50)).toBe("[#########---------]");
    });

    test("handles 25% correctly", () => {
      expect(__internal.makeBar(25)).toBe("[#####-------------]");
    });

    test("handles 75% correctly", () => {
      expect(__internal.makeBar(75)).toBe("[##############----]");
    });

    test("clamps negative values to 0", () => {
      expect(__internal.makeBar(-10)).toBe("[------------------]");
    });

    test("clamps values over 100", () => {
      expect(__internal.makeBar(150)).toBe("[##################]");
    });

    test("uses custom width", () => {
      expect(__internal.makeBar(50, 10)).toBe("[#####-----]");
    });

    test("handles very small width", () => {
      expect(__internal.makeBar(50, 4)).toBe("[##--]");
    });

    test("handles odd width correctly", () => {
      expect(__internal.makeBar(50, 5)).toBe("[###--]");
    });
  });

  describe("parseErrorPayload", () => {
    test("parses valid JSON object", () => {
      const json = '{"errorTag":"AccessDenied","message":"Access denied"}';
      const result = __internal.parseErrorPayload(json);
      expect(result).toEqual({ errorTag: "AccessDenied", message: "Access denied" });
    });

    test("parses error with data", () => {
      const json =
        '{"errorTag":"Error","errorData":{"Message":"Something failed","RequestId":"abc123","Type":"User"}}';
      const result = __internal.parseErrorPayload(json);
      expect(result?.errorData?.Message).toBe("Something failed");
      expect(result?.errorData?.RequestId).toBe("abc123");
      expect(result?.errorData?.Type).toBe("User");
    });

    test("returns null for non-JSON strings", () => {
      expect(__internal.parseErrorPayload("plain error")).toBeNull();
      expect(__internal.parseErrorPayload("error:")).toBeNull();
    });

    test("returns null for non-object JSON", () => {
      expect(__internal.parseErrorPayload("123")).toBeNull();
      expect(__internal.parseErrorPayload('"string"')).toBeNull();
      expect(__internal.parseErrorPayload("[1,2,3]")).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      expect(__internal.parseErrorPayload("{invalid}")).toBeNull();
      expect(__internal.parseErrorPayload('{"unclosed":')).toBeNull();
    });

    test("handles whitespace", () => {
      const json = '  {"errorTag":"Error"}  ';
      const result = __internal.parseErrorPayload(json);
      expect(result?.errorTag).toBe("Error");
    });

    test("returns null for empty string", () => {
      expect(__internal.parseErrorPayload("")).toBeNull();
    });
  });

  describe("formatParsedError", () => {
    test("formats error with tag and message", () => {
      const parsed = { errorTag: "AccessDenied", message: "Not allowed" };
      expect(__internal.formatParsedError(parsed, "")).toBe("AccessDenied: Not allowed");
    });

    test("formats error with data Message", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Something failed" } };
      expect(__internal.formatParsedError(parsed, "")).toBe("Error: Something failed");
    });

    test("prefers errorData.Message over message", () => {
      const parsed = {
        errorTag: "Error",
        message: "Old message",
        errorData: { Message: "New message" },
      };
      expect(__internal.formatParsedError(parsed, "")).toBe("Error: New message");
    });

    test("includes Type in suffix", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Failed", Type: "User" } };
      expect(__internal.formatParsedError(parsed, "")).toBe("Error: Failed (Type=User)");
    });

    test("includes RequestId in suffix", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Failed", RequestId: "abc123" } };
      expect(__internal.formatParsedError(parsed, "")).toBe("Error: Failed (RequestId=abc123)");
    });

    test("includes both Type and RequestId in suffix", () => {
      const parsed = {
        errorTag: "Error",
        errorData: { Message: "Failed", Type: "User", RequestId: "abc123" },
      };
      expect(__internal.formatParsedError(parsed, "")).toBe(
        "Error: Failed (Type=User RequestId=abc123)",
      );
    });

    test("returns null when no error tag or message", () => {
      const parsed = { errorData: { RequestId: "abc123" } };
      expect(__internal.formatParsedError(parsed, "fallback")).toBeNull();
    });

    test("returns null when errorTag is empty string", () => {
      const parsed = { errorTag: "" };
      expect(__internal.formatParsedError(parsed, "fallback")).toBeNull();
    });

    test("handles only errorData.Message without tag", () => {
      const parsed = { errorData: { Message: "Failed" } };
      expect(__internal.formatParsedError(parsed, "")).toBe("Failed");
    });

    test("returns null when only message field is present", () => {
      const parsed = { message: "Something happened" };
      expect(__internal.formatParsedError(parsed, "")).toBeNull();
    });
  });

  describe("prettifyError", () => {
    test("prettifies valid error JSON", () => {
      const json =
        '{"errorTag":"AccessDenied","errorData":{"Message":"Permission denied","Type":"User"}}';
      expect(__internal.prettifyError(json)).toBe("AccessDenied: Permission denied (Type=User)");
    });

    test("returns raw string for non-JSON", () => {
      expect(__internal.prettifyError("plain error")).toBe("plain error");
    });

    test("returns raw string for invalid JSON", () => {
      expect(__internal.prettifyError("{invalid}")).toBe("{invalid}");
    });

    test("handles error with RequestId", () => {
      const json = '{"errorTag":"Error","errorData":{"Message":"Failed","RequestId":"abc-123"}}';
      expect(__internal.prettifyError(json)).toBe("Error: Failed (RequestId=abc-123)");
    });
  });
});

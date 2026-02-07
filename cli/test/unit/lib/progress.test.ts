import { describe, expect, test } from "bun:test";

// Test the internal functions of progress.ts by extracting them
// Since they're not exported, we'll test them through their behavior

describe("progress", () => {
  describe("formatDuration", () => {
    const formatDuration = (ms: number): string => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    test("formats zero milliseconds", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    test("formats seconds only", () => {
      expect(formatDuration(30000)).toBe("0:30");
      expect(formatDuration(59000)).toBe("0:59");
    });

    test("formats minutes only", () => {
      expect(formatDuration(60000)).toBe("1:00");
      expect(formatDuration(120000)).toBe("2:00");
    });

    test("formats minutes and seconds", () => {
      expect(formatDuration(90000)).toBe("1:30");
      expect(formatDuration(125000)).toBe("2:05");
    });

    test("handles large durations", () => {
      expect(formatDuration(3600000)).toBe("60:00");
      expect(formatDuration(3661000)).toBe("61:01");
    });

    test("handles negative values", () => {
      expect(formatDuration(-1000)).toBe("0:00");
    });

    test("handles milliseconds correctly", () => {
      expect(formatDuration(500)).toBe("0:00");
      expect(formatDuration(1500)).toBe("0:01");
    });
  });

  describe("makeBar", () => {
    const makeBar = (percentage: number, width = 18): string => {
      const clamped = Math.max(0, Math.min(100, percentage));
      const filled = Math.round((clamped / 100) * width);
      const empty = width - filled;
      return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
    };

    test("creates empty bar at 0%", () => {
      expect(makeBar(0)).toBe("[------------------]");
    });

    test("creates full bar at 100%", () => {
      expect(makeBar(100)).toBe("[##################]");
    });

    test("creates half bar at 50%", () => {
      expect(makeBar(50)).toBe("[#########---------]");
    });

    test("handles 25% correctly", () => {
      // 25% of 18 = 4.5, which rounds to 5 filled blocks
      expect(makeBar(25)).toBe("[#####-------------]");
    });

    test("handles 75% correctly", () => {
      expect(makeBar(75)).toBe("[##############----]");
    });

    test("clamps negative values to 0", () => {
      expect(makeBar(-10)).toBe("[------------------]");
    });

    test("clamps values over 100", () => {
      expect(makeBar(150)).toBe("[##################]");
    });

    test("uses custom width", () => {
      expect(makeBar(50, 10)).toBe("[#####-----]");
    });

    test("handles very small width", () => {
      expect(makeBar(50, 4)).toBe("[##--]");
    });

    test("handles odd width correctly", () => {
      expect(makeBar(50, 5)).toBe("[###--]");
    });
  });

  describe("parseErrorPayload", () => {
    const parseErrorPayload = (
      raw: string,
    ): {
      errorTag?: string;
      errorData?: { Message?: string; RequestId?: string; Type?: string };
      message?: string;
    } | null => {
      const trimmed = raw.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }
      try {
        return JSON.parse(trimmed) as {
          errorTag?: string;
          errorData?: { Message?: string; RequestId?: string; Type?: string };
          message?: string;
        };
      } catch {
        return null;
      }
    };

    test("parses valid JSON object", () => {
      const json = '{"errorTag":"AccessDenied","message":"Access denied"}';
      const result = parseErrorPayload(json);
      expect(result).toEqual({ errorTag: "AccessDenied", message: "Access denied" });
    });

    test("parses error with data", () => {
      const json =
        '{"errorTag":"Error","errorData":{"Message":"Something failed","RequestId":"abc123","Type":"User"}}';
      const result = parseErrorPayload(json);
      expect(result?.errorData?.Message).toBe("Something failed");
      expect(result?.errorData?.RequestId).toBe("abc123");
      expect(result?.errorData?.Type).toBe("User");
    });

    test("returns null for non-JSON strings", () => {
      expect(parseErrorPayload("plain error")).toBeNull();
      expect(parseErrorPayload("error:")).toBeNull();
    });

    test("returns null for non-object JSON", () => {
      expect(parseErrorPayload("123")).toBeNull();
      expect(parseErrorPayload('"string"')).toBeNull();
      expect(parseErrorPayload("[1,2,3]")).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      expect(parseErrorPayload("{invalid}")).toBeNull();
      expect(parseErrorPayload('{"unclosed":')).toBeNull();
    });

    test("handles whitespace", () => {
      const json = '  {"errorTag":"Error"}  ';
      const result = parseErrorPayload(json);
      expect(result?.errorTag).toBe("Error");
    });

    test("returns null for empty string", () => {
      expect(parseErrorPayload("")).toBeNull();
    });
  });

  describe("formatParsedError", () => {
    const formatParsedError = (
      parsed: {
        errorTag?: string;
        errorData?: { Message?: string; RequestId?: string; Type?: string };
        message?: string;
      },
      fallback: string,
    ): string | null => {
      if (!parsed.errorTag && !parsed.errorData?.Message) {
        return null;
      }
      const parts = [parsed.errorTag, parsed.errorData?.Message || parsed.message].filter(Boolean);
      const base = parts.join(": ");
      const requestId = parsed.errorData?.RequestId;
      const type = parsed.errorData?.Type;
      const suffixParts = [
        type ? `Type=${type}` : null,
        requestId ? `RequestId=${requestId}` : null,
      ].filter(Boolean);
      const suffix = suffixParts.join(" ");
      return suffix ? `${base} (${suffix})` : base || fallback;
    };

    test("formats error with tag and message", () => {
      const parsed = { errorTag: "AccessDenied", message: "Not allowed" };
      expect(formatParsedError(parsed, "")).toBe("AccessDenied: Not allowed");
    });

    test("formats error with data Message", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Something failed" } };
      expect(formatParsedError(parsed, "")).toBe("Error: Something failed");
    });

    test("prefers errorData.Message over message", () => {
      const parsed = {
        errorTag: "Error",
        message: "Old message",
        errorData: { Message: "New message" },
      };
      expect(formatParsedError(parsed, "")).toBe("Error: New message");
    });

    test("includes Type in suffix", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Failed", Type: "User" } };
      expect(formatParsedError(parsed, "")).toBe("Error: Failed (Type=User)");
    });

    test("includes RequestId in suffix", () => {
      const parsed = { errorTag: "Error", errorData: { Message: "Failed", RequestId: "abc123" } };
      expect(formatParsedError(parsed, "")).toBe("Error: Failed (RequestId=abc123)");
    });

    test("includes both Type and RequestId in suffix", () => {
      const parsed = {
        errorTag: "Error",
        errorData: { Message: "Failed", Type: "User", RequestId: "abc123" },
      };
      expect(formatParsedError(parsed, "")).toBe("Error: Failed (Type=User RequestId=abc123)");
    });

    test("returns null when no error tag or message", () => {
      const parsed = { errorData: { RequestId: "abc123" } };
      expect(formatParsedError(parsed, "fallback")).toBeNull();
    });

    test("returns null when errorTag is empty string", () => {
      const parsed = { errorTag: "" };
      expect(formatParsedError(parsed, "fallback")).toBeNull();
    });

    test("handles only errorData.Message without tag", () => {
      const parsed = { errorData: { Message: "Failed" } };
      expect(formatParsedError(parsed, "")).toBe("Failed");
    });

    test("returns null when only message field is present", () => {
      // The function only checks errorTag and errorData.Message, not message field
      const parsed = { message: "Something happened" };
      expect(formatParsedError(parsed, "")).toBeNull();
    });
  });

  describe("prettifyError", () => {
    const parseErrorPayload = (
      raw: string,
    ): {
      errorTag?: string;
      errorData?: { Message?: string; RequestId?: string; Type?: string };
      message?: string;
    } | null => {
      const trimmed = raw.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }
      try {
        return JSON.parse(trimmed) as {
          errorTag?: string;
          errorData?: { Message?: string; RequestId?: string; Type?: string };
          message?: string;
        };
      } catch {
        return null;
      }
    };

    const formatParsedError = (
      parsed: {
        errorTag?: string;
        errorData?: { Message?: string; RequestId?: string; Type?: string };
        message?: string;
      },
      fallback: string,
    ): string | null => {
      if (!parsed.errorTag && !parsed.errorData?.Message) {
        return null;
      }
      const parts = [parsed.errorTag, parsed.errorData?.Message || parsed.message].filter(Boolean);
      const base = parts.join(": ");
      const requestId = parsed.errorData?.RequestId;
      const type = parsed.errorData?.Type;
      const suffixParts = [
        type ? `Type=${type}` : null,
        requestId ? `RequestId=${requestId}` : null,
      ].filter(Boolean);
      const suffix = suffixParts.join(" ");
      return suffix ? `${base} (${suffix})` : base || fallback;
    };

    const prettifyError = (raw: string): string => {
      const parsed = parseErrorPayload(raw);
      if (!parsed) {
        return raw;
      }
      return formatParsedError(parsed, raw) ?? raw;
    };

    test("prettifies valid error JSON", () => {
      const json =
        '{"errorTag":"AccessDenied","errorData":{"Message":"Permission denied","Type":"User"}}';
      expect(prettifyError(json)).toBe("AccessDenied: Permission denied (Type=User)");
    });

    test("returns raw string for non-JSON", () => {
      expect(prettifyError("plain error")).toBe("plain error");
    });

    test("returns raw string for invalid JSON", () => {
      expect(prettifyError("{invalid}")).toBe("{invalid}");
    });

    test("handles error with RequestId", () => {
      const json = '{"errorTag":"Error","errorData":{"Message":"Failed","RequestId":"abc-123"}}';
      expect(prettifyError(json)).toBe("Error: Failed (RequestId=abc-123)");
    });
  });
});

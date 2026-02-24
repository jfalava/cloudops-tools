import { describe, expect, test } from "bun:test";

import {
  CliUserInputError,
  formatCliUserInputError,
  invalidUserInput,
  isCliUserInputError,
} from "../../../src/lib/user-input-error";

describe("user-input-error", () => {
  test("creates typed user input errors", () => {
    const error = invalidUserInput("Bad input", {
      hint: "Use a valid value",
      example: "cloudops-tools query --days 7",
    });

    expect(error).toBeInstanceOf(CliUserInputError);
    expect(isCliUserInputError(error)).toBe(true);
    expect(error._tag).toBe("CliUserInputError");
  });

  test("formats message with hint and example", () => {
    const error = invalidUserInput("Bad input", {
      hint: "Use a valid value",
      example: "cloudops-tools query --days 7",
    });

    expect(formatCliUserInputError(error)).toBe(
      ["Bad input", "Hint: Use a valid value", "Example: cloudops-tools query --days 7"].join("\n"),
    );
  });

  test("formats message only when no hint/example", () => {
    const error = invalidUserInput("Bad input");
    expect(formatCliUserInputError(error)).toBe("Bad input");
  });

  test("detects structurally compatible errors", () => {
    const errorLike = {
      _tag: "CliUserInputError",
      message: "Bad input",
    };

    expect(isCliUserInputError(errorLike)).toBe(true);
    expect(isCliUserInputError(new Error("Bad input"))).toBe(false);
    expect(isCliUserInputError(null)).toBe(false);
  });
});

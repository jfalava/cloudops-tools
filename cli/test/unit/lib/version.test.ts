import { describe, expect, test } from "bun:test";

import { resolveCliVersion } from "../../../src/lib/version";

describe("resolveCliVersion", () => {
  const packageVersion = "0.2.0";

  test("uses package version when build version is undefined", () => {
    expect(resolveCliVersion(undefined, packageVersion)).toBe(packageVersion);
  });

  test("uses package version when build version is only a quote", () => {
    expect(resolveCliVersion('"', packageVersion)).toBe(packageVersion);
  });

  test("uses package version when build version is only whitespace and quotes", () => {
    expect(resolveCliVersion("  ''  ", packageVersion)).toBe(packageVersion);
  });

  test("uses package version when build version is an escaped quote", () => {
    expect(resolveCliVersion('\\"', packageVersion)).toBe(packageVersion);
  });

  test("strips wrapping quotes from build version", () => {
    expect(resolveCliVersion('"0.5.1"', packageVersion)).toBe("0.5.1");
    expect(resolveCliVersion("'0.5.1'", packageVersion)).toBe("0.5.1");
  });

  test("strips escaped wrapping quotes from build version", () => {
    expect(resolveCliVersion('\\"0.5.1\\"', packageVersion)).toBe("0.5.1");
  });

  test("handles shell-quoted injected build version shapes", () => {
    expect(resolveCliVersion(`'"'0.5.1'"'`, packageVersion)).toBe("0.5.1");
  });
});

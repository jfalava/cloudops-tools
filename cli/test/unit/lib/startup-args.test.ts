import { describe, expect, test } from "bun:test";

import { planCliInvocation } from "../../../src/lib/startup-args";

describe("planCliInvocation", () => {
  test("prints help when no arguments are passed", () => {
    const plan = planCliInvocation(["/bin/cloudops-tools", "/app/path"]);

    expect(plan.action).toBe("print-help");
    expect(plan.selectedCli).toBe("main");
    expect(plan.argsForSelectedCli).toEqual(["/bin/cloudops-tools", "/app/path"]);
  });

  test("prints version without running init when --version is passed", () => {
    const plan = planCliInvocation(["/bin/cloudops-tools", "/app/path", "--version"]);

    expect(plan.action).toBe("print-version");
    expect(plan.selectedCli).toBe("main");
  });

  test("treats forced init as execution, not help", () => {
    const plan = planCliInvocation(["/bin/cloudops-tools", "/app/path", "--init"]);

    expect(plan.action).toBe("run");
    expect(plan.selectedCli).toBe("main");
    expect(plan.normalizedArgv).toEqual(["/bin/cloudops-tools", "/app/path", "init"]);
  });

  test("does not route to query when 'query' appears in a later argument", () => {
    const plan = planCliInvocation([
      "/bin/cloudops-tools",
      "/app/path",
      "init",
      "--describe",
      "query",
    ]);

    expect(plan.selectedCli).toBe("main");
    expect(plan.action).toBe("run");
  });
});

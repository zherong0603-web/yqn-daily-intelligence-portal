import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchSellerProblemBrief, resolveExecutorId } from "./dispatchSellerProblemBrief.mjs";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), "yqn-dispatch-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("guarded seller brief dispatcher", () => {
  it("fails locally when the executor id is missing or explicitly blank", () => {
    const missingFile = path.join(temporaryDirectory(), "missing-executor-id");

    expect(() => resolveExecutorId({}, missingFile)).toThrow(/Primary executor ID is missing/);
    expect(() => resolveExecutorId({ YQN_EXECUTOR_ID: "   " }, missingFile)).toThrow(/blank/);
  });

  it("passes the executor id without writing it to logs", () => {
    const directory = temporaryDirectory();
    const briefFile = path.join(directory, "brief.json");
    writeFileSync(briefFile, JSON.stringify({ date: "2026-08-05", title: "test" }));
    const execute = vi.fn();
    const log = vi.fn();

    dispatchSellerProblemBrief({
      argv: ["node", "dispatch", "--date", "2026-08-05", "--dry-run", "true", "--file", briefFile],
      env: { YQN_EXECUTOR_ID: "mini-local-test-id" },
      now: new Date("2026-08-05T01:00:00.000Z"),
      cwd: directory,
      execute,
      createDispatchId: () => "dispatch-test",
      log,
    });

    expect(execute).toHaveBeenCalledOnce();
    const [command, args, options] = execute.mock.calls[0];
    expect(command).toBe("gh");
    expect(args.some((value) => value.endsWith("dingtalk-seller-problem-send.yml/dispatches"))).toBe(true);
    const payload = JSON.parse(options.input);
    expect(payload.inputs.executor_id).toBe("mini-local-test-id");
    expect(payload.inputs.dispatch_id).toBe("dispatch-test");
    expect(payload.inputs.dry_run).toBe("true");
    expect(log.mock.calls.flat().join("\n")).not.toContain("mini-local-test-id");
    expect(log).toHaveBeenCalledWith("[seller-brief:executor] authorization input loaded");
  });
});

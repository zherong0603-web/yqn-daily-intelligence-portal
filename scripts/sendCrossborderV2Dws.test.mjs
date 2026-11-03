import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertUniqueDwsGroup,
  parseCrossborderV2DwsArgs,
  readDwsDeliveryStatus,
  sendCrossborderV2Dws,
} from "./sendCrossborderV2Dws.mjs";

const temporaryDirectories = [];

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "yqn-dws-test-"));
  temporaryDirectories.push(directory);
  const date = "2026-11-02";
  const dataDir = path.join(directory, "data", "codex-shadow");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, `${date}.crossborder-v2.json`), JSON.stringify({ format_version: "v2", date }));
  writeFileSync(path.join(dataDir, `${date}.crossborder-v2.md`), "# 跨境早知道 V4｜11月2日\n\n正文");
  writeFileSync(path.join(dataDir, `${date}.crossborder-v2.review.json`), JSON.stringify({ date, content_valid: true, automated_blockers: [] }));
  writeFileSync(path.join(dataDir, `${date}.source-checks.json`), JSON.stringify({ date, all_ok: true, failed_count: 0 }));
  return { directory, date };
}

const groupLookupOutput = JSON.stringify({
  success: true,
  result: { groups: [{ title: "跨境咨询每日内容" }] },
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Crossborder V2 DWS delivery", () => {
  it("accepts only the fixed date and live arguments", () => {
    expect(parseCrossborderV2DwsArgs(["node", "send", "--date", "2026-11-02"])).toEqual({ date: "2026-11-02", live: false });
    expect(parseCrossborderV2DwsArgs(["node", "send", "--date", "2026-11-02", "--live"])).toEqual({ date: "2026-11-02", live: true });
    expect(() => parseCrossborderV2DwsArgs(["node", "send", "--date", "2026-11-02", "--to", "someone"])).toThrow(/Unsupported/);
    expect(() => parseCrossborderV2DwsArgs(["node", "send", "--date", "2026-11-02", "--send"])).toThrow(/Unsupported/);
  });

  it("accepts only confirmed delivery statuses", () => {
    expect(readDwsDeliveryStatus(JSON.stringify({ deliveryStatus: "DELIVERED" }))).toEqual({ ok: true, status: "DELIVERED" });
    expect(readDwsDeliveryStatus(JSON.stringify({ readStatus: "READ" }))).toEqual({ ok: true, status: "READ" });
    expect(readDwsDeliveryStatus(JSON.stringify({ status: "UNKNOWN" }))).toEqual({ ok: false, status: "UNKNOWN" });
    expect(() => readDwsDeliveryStatus("sent")).toThrow(/non-JSON/);
  });

  it("requires one exact group match", () => {
    expect(assertUniqueDwsGroup(groupLookupOutput)).toBe(true);
    expect(() => assertUniqueDwsGroup(JSON.stringify({ success: true, result: { groups: [] } }))).toThrow(/exactly one group/);
    expect(() => assertUniqueDwsGroup(JSON.stringify({
      success: true,
      result: { groups: [{ title: "跨境咨询每日内容" }, { title: "跨境咨询每日内容" }] },
    }))).toThrow(/exactly one group/);
  });

  it("validates without sending in dry-run mode", () => {
    const { directory, date } = fixture();
    const execute = vi.fn((command, args) => {
      if (command === "dws" && args[0] === "auth") return JSON.stringify({ authenticated: true, token_valid: true });
      if (command === "dws" && args[0] === "chat" && args[1] === "search") return groupLookupOutput;
      return "";
    });
    const log = vi.fn();
    sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log,
    });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(execute.mock.calls[0][0]).toBe("npm");
    expect(execute.mock.calls[1][0]).toBe("npm");
    expect(execute.mock.calls[2][1]).toEqual(["auth", "status", "-f", "json"]);
    expect(execute.mock.calls[3][1]).toEqual(["chat", "search", "--query", "跨境咨询每日内容", "-f", "json"]);
    expect(log).toHaveBeenCalledWith("[crossborder-v4:dws-group] date=2026-11-02 dry run validated; message not sent");
  });

  it("records attempt before sending and records delivered only after confirmation", () => {
    const { directory, date } = fixture();
    const execute = vi.fn((command, args) => {
      if (command === "dws" && args[0] === "auth") return JSON.stringify({ authenticated: true, token_valid: true });
      if (command === "dws" && args[0] === "chat" && args[1] === "search") return groupLookupOutput;
      if (command === "dws" && args.includes("+messages-send")) return JSON.stringify({ deliveryStatus: "DELIVERED" });
      return "";
    });
    const result = sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    });
    expect(result).toEqual({ status: "DELIVERED", duplicate: false });
    expect(execute).toHaveBeenCalledTimes(5);
    const sendCall = execute.mock.calls[4];
    expect(sendCall[0]).toBe("dws");
    expect(sendCall[1]).toEqual(expect.arrayContaining([
      "+messages-send",
      "--identity", "user",
      "--chat-query", "跨境咨询每日内容",
      "--wait-delivery",
      "--ai-tag=false",
      "-y",
    ]));
    expect(sendCall[1]).not.toContain("--user-query");
    expect(JSON.stringify(sendCall)).not.toMatch(/\b\d{10,}\b/);
  });

  it("skips a date already marked DELIVERED", () => {
    const { directory, date } = fixture();
    const stateFile = path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json");
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({ dates: { [date]: { status: "DELIVERED" } } }));
    const execute = vi.fn((command) => {
      if (command === "dws") return JSON.stringify({ authenticated: true, token_valid: true });
      return "";
    });
    const result = sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    });
    expect(result).toEqual({ status: "DELIVERED", duplicate: true });
    expect(execute.mock.calls.some(([, args]) => args.includes("+messages-send"))).toBe(false);
  });

  it("blocks before authentication when source checks are not green", () => {
    const { directory, date } = fixture();
    const sourceFile = path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`);
    writeFileSync(sourceFile, JSON.stringify({ date, all_ok: false, failed_count: 1 }));
    const execute = vi.fn(() => "");
    expect(() => sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    })).toThrow(/source checks are not all green/);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("stops before sending when the target group is ambiguous", () => {
    const { directory, date } = fixture();
    const execute = vi.fn((command, args) => {
      if (command === "dws" && args[0] === "auth") return JSON.stringify({ authenticated: true, token_valid: true });
      if (command === "dws" && args[0] === "chat" && args[1] === "search") return JSON.stringify({
        success: true,
        result: { groups: [{ title: "跨境咨询每日内容" }, { title: "跨境咨询每日内容" }] },
      });
      return "";
    });
    expect(() => sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    })).toThrow(/exactly one group/);
    expect(execute.mock.calls.some(([, args]) => args.includes("+messages-send"))).toBe(false);
  });

  it("blocks automatic retry after an unverified attempt", () => {
    const { directory, date } = fixture();
    const stateFile = path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json");
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({ dates: { [date]: { status: "ATTEMPTED" } } }));
    const execute = vi.fn((command) => {
      if (command === "dws") return JSON.stringify({ authenticated: true, token_valid: true });
      return "";
    });
    expect(() => sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    })).toThrow(/prior group attempt has no verified delivery/);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

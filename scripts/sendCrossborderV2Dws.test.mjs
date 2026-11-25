import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertUniqueDwsGroup,
  runDispatchCommand,
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
  writeFileSync(path.join(dataDir, `${date}.crossborder-v2.json`), JSON.stringify({
    format_version: "v2",
    date,
    editorial: { candidates: [{ title: "候选一" }] },
    hooks: { a: "钩子A", b: "钩子B" },
    voiceover_body: "口播正文",
  }));
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

  it("accepts the CLI wait-delivery receipt and standard result envelope", () => {
    // Actual CLI receipt shape; identity fields are deliberately omitted.
    expect(readDwsDeliveryStatus(JSON.stringify({ deliveryStatus: "delivered" }))).toEqual({ ok: true, status: "DELIVERED" });
    expect(readDwsDeliveryStatus(JSON.stringify({ success: true, result: { deliveryStatus: "delivered" } }))).toEqual({ ok: true, status: "DELIVERED" });
    expect(readDwsDeliveryStatus(JSON.stringify({ success: true, result: { readStatus: "UNREAD" } }))).toEqual({ ok: true, status: "UNREAD" });
  });

  it.each([
    { success: false, example: "UNREAD", status: "FAILED" },
    { success: true, result: { note: "READ", deliveryStatus: "UNKNOWN" } },
    { deliveryStatus: "DELIVERED", success: false },
    { deliveryStatus: "DELIVERED", result: { status: "FAILED" } },
    { success: true, result: { deliveryStatus: "delivered", ok: false } },
    { success: true, result: { deliveryStatus: "delivered", error: "receipt failed" } },
    { result: { sendStatus: "SUCCESS" } },
    { result: { status: "READ" } },
    { result: { body: { deliveryStatus: "DELIVERED" } } },
    { message: "DELIVERED", hint: "READ", example: "UNREAD" },
    { deliveryStatus: "UNKNOWN", readStatus: "READ" },
    { deliveryStatus: "DELIVERED", readStatus: "FAILED" },
    [{ deliveryStatus: "DELIVERED" }],
    "READ",
    null,
  ])("fails closed without an unambiguous structured receipt: %j", (payload) => {
    expect(readDwsDeliveryStatus(JSON.stringify(payload)).ok).toBe(false);
  });

  it("requires one exact group match", () => {
    expect(assertUniqueDwsGroup(groupLookupOutput)).toBe(true);
    expect(() => assertUniqueDwsGroup(JSON.stringify({ success: true, result: { groups: [] } }))).toThrow(/exactly one group/);
    expect(() => assertUniqueDwsGroup(JSON.stringify({
      success: true,
      result: { groups: [{ title: "跨境咨询每日内容" }, { title: "跨境咨询每日内容" }] },
    }))).toThrow(/exactly one group/);
  });

  it("blocks early live delivery before any external call", () => {
    const { directory, date } = fixture();
    const execute = vi.fn();
    expect(() => sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      now: new Date("2026-11-02T07:59:59Z"),
      execute,
    })).toThrow(/opens at 16:00 Asia\/Shanghai/);
    expect(execute).not.toHaveBeenCalled();
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
      now: new Date("2026-11-02T06:30:00Z"),
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

  it("uses the approved same-issue final markdown as the delivery payload", () => {
    const { directory, date } = fixture();
    const dataDir = path.join(directory, "data", "codex-shadow");
    const archiveDir = path.join(dataDir, `${date}.crossborder-v4`);
    mkdirSync(archiveDir, { recursive: true });
    const finalMarkdown = "# 跨境早知道 V4｜11月2日\n\n## 5 条重点候选\n\n| 候选一 | 入选 |\n\n## A/B 黄金 3 秒\n\nA：钩子A\n\nB：钩子B\n\n## 口播正文\n\n口播正文\n";
    const deliveryMarkdown = "# 跨境早知道 V4｜11月2日\n\n## 5 条重点候选\n\n1. 候选一｜入选\n\n## A/B 黄金 3 秒\n\nA：钩子A\n\nB：钩子B\n\n## 口播正文\n\n口播正文\n";
    writeFileSync(path.join(archiveDir, "06-final.md"), finalMarkdown);
    writeFileSync(path.join(archiveDir, "06-delivery.md"), deliveryMarkdown);
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
    const sendCall = execute.mock.calls.find(([, args]) => args.includes("+messages-send"));
    expect(sendCall[1][sendCall[1].indexOf("--markdown") + 1]).toBe(deliveryMarkdown);
    expect(readFileSync(path.join(dataDir, `${date}.crossborder-v2.md`), "utf8")).toBe(deliveryMarkdown);
  });

  it("blocks an incomplete archive before a table-based final can be sent", () => {
    const { directory, date } = fixture();
    const dataDir = path.join(directory, "data", "codex-shadow");
    const archiveDir = path.join(dataDir, `${date}.crossborder-v4`);
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(path.join(archiveDir, "06-final.md"), "# final");
    const execute = vi.fn(() => "");
    expect(() => sendCrossborderV2Dws({
      argv: ["node", "send", "--date", date, "--live"],
      cwd: directory,
      env: { DWS_LANG: "zh" },
      now: new Date("2026-11-02T08:00:00Z"),
      execute,
      log: vi.fn(),
    })).toThrow(/06-final\.md and 06-delivery\.md/);
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


describe("dispatch failure evidence and safe pre-send recovery", () => {
  function options(directory, date, execute) {
    return { argv: ["node", "send", "--date", date, "--live"], cwd: directory,
      now: new Date("2026-11-02T08:00:00Z"), execute, log: vi.fn(), wait: vi.fn() };
  }
  function normal(command, args) {
    if (command === "dws" && args[0] === "auth") return JSON.stringify({ authenticated: true, token_valid: true });
    if (args.includes("search")) return groupLookupOutput;
    if (args.includes("+messages-send")) return JSON.stringify({ deliveryStatus: "DELIVERED" });
    return "";
  }
  function events(directory, date) {
    return readFileSync(path.join(directory, "logs", "automation", `.crossborder-v4-dispatch-${date}.jsonl`), "utf8")
      .trim().split("\n").map(JSON.parse);
  }
  it("keeps the failing source stage without persisting raw process output", () => {
    const { directory, date } = fixture();
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check")) throw new Error("private output must never be stored");
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    const journal = events(directory, date);
    expect(journal.at(-1)).toMatchObject({ stage: "source_check", status: "FAILED", attempt: 1, code: "CHECK_FAILED" });
    expect(JSON.stringify(journal)).not.toContain("private output");
    expect(() => readFileSync(path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json"))).toThrow();
  });
  it("preserves the failed source index before a later check can overwrite it", () => {
    const { directory, date } = fixture();
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check")) {
        writeFileSync(path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`), JSON.stringify({
          date, checked_at: new Date().toISOString(), all_ok: false, failed_count: 1, checks: [{ ok: true }, { ok: false,
            url: "https://example.com/private?hidden=value", error: "visible source date does not match published_at" }] }));
        throw new Error("process failed");
      }
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    const failed = events(directory, date).at(-1);
    expect(failed.source_failures).toEqual([{ index: 1, code: "VISIBLE_DATE_MISMATCH" }]);
    expect(JSON.stringify(failed)).not.toContain("hidden");
  });
  it("recovers a transient source failure before sending once", () => {
    const { directory, date } = fixture(); let checks = 0; let sends = 0;
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check") && ++checks < 3) throw Object.assign(new Error("network"), { code: "ECONNRESET" });
      if (args.includes("+messages-send")) sends++;
      return normal(command, args);
    };
    expect(sendCrossborderV2Dws(options(directory, date, execute)).status).toBe("DELIVERED");
    expect(checks).toBe(3); expect(sends).toBe(1);
    expect(events(directory, date).filter(e => e.status === "RETRYING")).toHaveLength(2);
  });
  it("stops bounded transient recovery without writing ATTEMPTED", () => {
    const { directory, date } = fixture(); let checks = 0;
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check")) { checks++; throw Object.assign(new Error("network"), { code: "ETIMEDOUT" }); }
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    expect(checks).toBe(3);
    expect(events(directory, date).at(-1)).toMatchObject({ stage: "source_check", status: "FAILED", attempt: 3 });
  });
  it.each(["ATTEMPTED", "DELIVERED"])("does not send if %s appears during preflight recovery", (status) => {
    const { directory, date } = fixture(); let attempts = 0; let sends = 0;
    const execute = (command, args) => {
      if (args[0] === "auth" && attempts++ === 0) throw Object.assign(new Error("network"), { code: "ECONNRESET" });
      if (args.includes("+messages-send")) sends++;
      return normal(command, args);
    };
    const opts = options(directory, date, execute);
    opts.wait = () => {
      writeFileSync(path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json"),
        JSON.stringify({ dates: { [date]: { status } } }));
    };
    if (status === "DELIVERED") expect(sendCrossborderV2Dws(opts).duplicate).toBe(true);
    else expect(() => sendCrossborderV2Dws(opts)).toThrow(/prior group attempt/);
    expect(sends).toBe(0);
  });
  it("does not retry mixed source failures containing a changed evidence marker", () => {
    const { directory, date } = fixture(); let checks = 0;
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check")) {
        checks++;
        writeFileSync(path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`), JSON.stringify({
          date, checked_at: new Date().toISOString(), checks: [
            { ok: false, error: "fetch failed" }, { ok: false, error: "source page is missing 1 required evidence marker(s)" }] }));
        throw Object.assign(new Error("mixed failure"), { code: "NETWORK_TRANSIENT" });
      }
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    expect(checks).toBe(1);
  });
  it("does not write ATTEMPTED after the shared preflight budget is exhausted", () => {
    const { directory, date } = fixture(); let time = 0; let sends = 0;
    const execute = (command, args) => {
      if (args.includes("search")) time = 300001;
      if (args.includes("+messages-send")) sends++;
      return normal(command, args);
    };
    const opts = { ...options(directory, date, execute), monotonic: () => time };
    expect(() => sendCrossborderV2Dws(opts)).toThrow(/budget/);
    expect(sends).toBe(0);
    expect(() => readFileSync(path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json"))).toThrow();
  });
  it("does not treat a generic fetch failure as proven transient", () => {
    const { directory, date } = fixture(); let checks = 0;
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check")) {
        checks++;
        writeFileSync(path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`), JSON.stringify({
          date, checked_at: new Date().toISOString(), checks: [{ ok: false, error: "fetch failed" }] }));
        throw Object.assign(new Error("fetch failed"), { code: "NETWORK_TRANSIENT" });
      }
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    expect(checks).toBe(1);
  });
  it.each([429, 502, 503, 504])("recovers a real child HTTP %s failure before one send", (http) => {
    const { directory, date } = fixture(); let checks = 0; let sends = 0;
    const execute = (command, args) => {
      if (args.includes("crossborder:v2:source-check") && ++checks < 3) {
        writeFileSync(path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`), JSON.stringify({
          date, checked_at: new Date().toISOString(), checks: [{ ok: false, error: `HTTP ${http}` }] }));
        return runDispatchCommand(process.execPath, ["-e", `console.error("HTTP ${http}");process.exit(1)`]);
      }
      if (args.includes("crossborder:v2:source-check")) writeFileSync(path.join(directory, "data", "codex-shadow", `${date}.source-checks.json`), JSON.stringify({ date, all_ok: true, failed_count: 0 }));
      if (args.includes("+messages-send")) sends++;
      return normal(command, args);
    };
    expect(sendCrossborderV2Dws(options(directory, date, execute)).status).toBe("DELIVERED");
    expect(checks).toBe(3); expect(sends).toBe(1);
  });
  it("does not leak a malformed successful authentication response", () => {
    const { directory, date } = fixture(); let failure;
    const execute = (command, args) => args[0] === "auth" ? "FAKE_AUTH_PRIVATE_VALUE" : normal(command, args);
    try { sendCrossborderV2Dws(options(directory, date, execute)); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).not.toContain("FAKE_AUTH");
    expect(events(directory, date).at(-1)).toMatchObject({ stage: "authentication", status: "FAILED" });
  });
  it("never retries a send with an ambiguous result", () => {
    const { directory, date } = fixture(); let sends = 0;
    const execute = (command, args) => {
      if (args.includes("+messages-send")) { sends++; throw Object.assign(new Error("network"), { code: "ECONNRESET" }); }
      return normal(command, args);
    };
    expect(() => sendCrossborderV2Dws(options(directory, date, execute))).toThrow();
    const state = JSON.parse(readFileSync(path.join(directory, "logs", "automation", ".crossborder-v4-dws-group-state.json")));
    expect(state.dates[date].status).toBe("ATTEMPTED"); expect(sends).toBe(1);
    expect(events(directory, date).at(-1)).toMatchObject({ stage: "send", status: "FAILED", attempt: 1 });
  });
});


it("keeps real failed child output out of the thrown error", () => {
  expect(typeof runDispatchCommand).toBe("function");
  let failure;
  try {
    runDispatchCommand(process.execPath, ["-e", 'process.stdout.write(JSON.stringify({error:{category:"PRIVATE_CATEGORY",message:"FAKE_SENSITIVE_VALUE"}}));process.exit(1)']);
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect(failure.message).not.toMatch(/FAKE_SENSITIVE_VALUE|PRIVATE_CATEGORY/);
});

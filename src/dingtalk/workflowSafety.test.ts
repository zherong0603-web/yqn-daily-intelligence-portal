import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function workflow(name: string): string {
  return readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");
}

function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("workflow retirement and executor safety gates", () => {
  it("requires and authorizes the primary executor before every seller brief job", () => {
    const seller = workflow("dingtalk-seller-problem-send.yml");
    const executorInput = section(seller, "      executor_id:", "\n\npermissions:");
    const authorize = section(seller, "  authorize-executor:", "\n  validate-brief:");
    const validate = section(seller, "  validate-brief:", "\n  send-livestream-brief:");
    const livestream = section(seller, "  send-livestream-brief:", "\n  send-ryan-internal-brief:");
    const internal = seller.slice(seller.indexOf("  send-ryan-internal-brief:"));

    expect(executorInput).toContain("required: true");
    expect(executorInput).not.toContain("default:");
    expect(authorize).toContain("PRIMARY_EXECUTOR_ID: ${{ vars.YQN_PRIMARY_EXECUTOR_ID }}");
    expect(authorize).toContain('[[ -z "$DISPATCH_EXECUTOR_ID" || -z "$PRIMARY_EXECUTOR_ID" ]]');
    expect(authorize).toContain('[[ "$DISPATCH_EXECUTOR_ID" != "$PRIMARY_EXECUTOR_ID" ]]');
    expect(validate).toContain("needs: authorize-executor");
    for (const sendJob of [livestream, internal]) {
      expect(sendJob).toContain("- authorize-executor");
      expect(sendJob).toContain("- validate-brief");
    }
  });

  it("keeps both legacy V1.4 workflows retired unless their gates are explicitly true", () => {
    expect(workflow("dingtalk-morning-brief.yml")).toContain(
      "if: ${{ vars.YQN_LEGACY_V14_ENABLED == 'true' }}",
    );
    expect(workflow("dingtalk-morning-brief-watchdog.yml")).toContain(
      "if: ${{ vars.YQN_LEGACY_V14_ENABLED == 'true' && vars.YQN_LEGACY_V14_WATCHDOG_ENABLED == 'true' }}",
    );
  });

  it("keeps Daily Briefing Portal Feishu notifications default-off", () => {
    const daily = workflow("daily-briefing.yml");
    expect(daily).toContain(
      "PORTAL_FEISHU_NOTIFICATIONS_ENABLED: ${{ vars.YQN_PORTAL_FEISHU_NOTIFICATIONS_ENABLED || 'false' }}",
    );
    expect(daily).toContain(
      "if: ${{ success() && env.PORTAL_FEISHU_NOTIFICATIONS_ENABLED == 'true' }}",
    );
    expect(daily).toContain(
      "if: ${{ failure() && env.PORTAL_FEISHU_NOTIFICATIONS_ENABLED == 'true' }}",
    );
  });

  it("routes both automation templates through the guarded dispatcher", () => {
    for (const template of ["automation/yqn-2.template.toml", "automation/yqn-09-20.template.toml"]) {
      const content = repoFile(template);
      expect(content).toContain("正式调度只能运行 npm run codex:seller-brief:dispatch");
      expect(content).toContain("缺失或空白时必须停止");
    }
    const rules = repoFile("docs/automation/工作日晨报执行规则.md");
    expect(rules).toContain(".yqn-primary-executor-id");
    expect(rules).toContain("YQN_PRIMARY_EXECUTOR_ID");
    expect(rules).toContain("禁止改用 `gh workflow run`");
    expect(repoFile(".gitignore")).toContain(".yqn-primary-executor-id");
  });
});

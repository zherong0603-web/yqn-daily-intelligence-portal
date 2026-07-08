import { z } from "zod";

export const productName = "YQN 跨境增长情报晨报";
export const robotDisplayName = "YQN 跨境增长情报官";
export const productSubtitle = "市场｜平台｜竞品｜头仓配｜获客动作";

export const signalCategorySchema = z.enum([
  "market_policy",
  "platform_seller",
  "competitor_fulfillment",
  "growth_lead",
  "yqn_action",
]);
export const sourceCategorySchema = z.enum([
  "domestic_crossborder",
  "overseas_policy",
  "platform_seller",
  "competitor_fulfillment",
  "yqn_public",
]);
export const infoRegionSchema = z.enum(["domestic", "overseas", "global"]);
export const infoTypeSchema = z.enum(["policy", "platform", "competitor", "fulfillment", "growth", "yqn_action"]);
export const confidenceLabelSchema = z.enum(["high", "medium", "low"]);
export const sourceTypeSchema = z.enum(["official", "media", "public_yqn", "manual_approved"]);
export const briefModeSchema = z.enum(["demo", "live"]);

export const signalSchema = z.object({
  category: signalCategorySchema,
  title: z.string().min(2).max(80),
  what_happened: z.string().min(8).max(220),
  why_it_matters: z.string().min(8).max(180),
  yqn_use: z.string().min(8).max(180),
  today_action: z.string().min(6).max(140),
  source_name: z.string().min(2).max(120),
  source_url: z.string().url(),
  source_published_at: z.string().min(4).max(40),
  collected_at: z.string().datetime(),
  info_region: infoRegionSchema,
  info_type: infoTypeSchema,
  confidence_label: confidenceLabelSchema,
  is_test_data: z.boolean(),
  source_summary: z.string().min(4).max(220),
  is_sensitive: z.boolean(),
});

export const sourceSchema = z.object({
  title: z.string().min(2).max(140),
  url: z.string().url(),
  category: sourceCategorySchema,
  source_type: sourceTypeSchema,
  auto_fetch: z.boolean(),
});

export const riskFlagSchema = z.enum([
  "forbidden_content",
  "sensitive_signal",
  "missing_source_url",
  "missing_source_name",
  "missing_source_published_at",
  "schema_validation_failed",
  "low_confidence",
  "message_too_long",
  "archive_link_unavailable",
  "test_label_missing",
  "send_blocked",
]);

export const dingtalkBriefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(8).max(90),
  one_liner: z.string().min(4).max(36),
  signals: z.array(signalSchema).min(5).max(5),
  action_list: z.array(z.string().min(4).max(120)).length(3),
  sources: z.array(sourceSchema).min(5),
  mode: briefModeSchema,
  generated_at: z.string().datetime(),
  risk_flags: z.array(riskFlagSchema),
});

export const dingtalkSourceConfigSchema = z.object({
  category: sourceCategorySchema,
  title: z.string().min(2).max(140),
  url: z.string().url(),
  source_type: sourceTypeSchema,
  auto_fetch: z.boolean(),
  enabled: z.boolean().default(true),
  sample_summary: z.string().max(500).optional(),
});

export const dingtalkSourcesFileSchema = z.object({
  dingtalk_sources: z.array(dingtalkSourceConfigSchema).min(1),
});

export type SignalCategory = z.infer<typeof signalCategorySchema>;
export type SourceCategory = z.infer<typeof sourceCategorySchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type BriefMode = z.infer<typeof briefModeSchema>;
export type DingtalkSignal = z.infer<typeof signalSchema>;
export type DingtalkSource = z.infer<typeof sourceSchema>;
export type DingtalkBrief = z.infer<typeof dingtalkBriefSchema>;
export type DingtalkSourceConfig = z.infer<typeof dingtalkSourceConfigSchema>;
export type RiskFlag = z.infer<typeof riskFlagSchema>;

export const categoryLabels: Record<SignalCategory, string> = {
  market_policy: "市场与政策",
  platform_seller: "平台与卖家",
  competitor_fulfillment: "竞品与履约",
  growth_lead: "增长与线索",
  yqn_action: "YQN 今日可用动作",
};

export const confidenceLabels: Record<z.infer<typeof confidenceLabelSchema>, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const dingtalkBriefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "date",
    "title",
    "one_liner",
    "signals",
    "action_list",
    "sources",
    "mode",
    "generated_at",
    "risk_flags",
  ],
  properties: {
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    title: { type: "string", minLength: 8, maxLength: 90 },
    one_liner: { type: "string", minLength: 4, maxLength: 36 },
    signals: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "category",
          "title",
          "what_happened",
          "why_it_matters",
          "yqn_use",
          "today_action",
          "source_name",
          "source_url",
          "source_published_at",
          "collected_at",
          "info_region",
          "info_type",
          "confidence_label",
          "is_test_data",
          "source_summary",
          "is_sensitive",
        ],
        properties: {
          category: {
            type: "string",
            enum: ["market_policy", "platform_seller", "competitor_fulfillment", "growth_lead", "yqn_action"],
          },
          title: { type: "string", minLength: 2, maxLength: 80 },
          what_happened: { type: "string", minLength: 8, maxLength: 220 },
          why_it_matters: { type: "string", minLength: 8, maxLength: 180 },
          yqn_use: { type: "string", minLength: 8, maxLength: 180 },
          today_action: { type: "string", minLength: 6, maxLength: 140 },
          source_name: { type: "string", minLength: 2, maxLength: 120 },
          source_url: { type: "string", format: "uri" },
          source_published_at: { type: "string", minLength: 4, maxLength: 40 },
          collected_at: { type: "string", format: "date-time" },
          info_region: { type: "string", enum: ["domestic", "overseas", "global"] },
          info_type: { type: "string", enum: ["policy", "platform", "competitor", "fulfillment", "growth", "yqn_action"] },
          confidence_label: { type: "string", enum: ["high", "medium", "low"] },
          is_test_data: { type: "boolean" },
          source_summary: { type: "string", minLength: 4, maxLength: 220 },
          is_sensitive: { type: "boolean" },
        },
      },
    },
    action_list: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 4, maxLength: 120 },
    },
    sources: {
      type: "array",
      minItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "category", "source_type", "auto_fetch"],
        properties: {
          title: { type: "string", minLength: 2, maxLength: 140 },
          url: { type: "string", format: "uri" },
          category: {
            type: "string",
            enum: ["domestic_crossborder", "overseas_policy", "platform_seller", "competitor_fulfillment", "yqn_public"],
          },
          source_type: {
            type: "string",
            enum: ["official", "media", "public_yqn", "manual_approved"],
          },
          auto_fetch: { type: "boolean" },
        },
      },
    },
    mode: { type: "string", enum: ["demo", "live"] },
    generated_at: { type: "string", format: "date-time" },
    risk_flags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "forbidden_content",
          "sensitive_signal",
          "missing_source_url",
          "missing_source_name",
          "missing_source_published_at",
          "schema_validation_failed",
          "low_confidence",
          "message_too_long",
          "archive_link_unavailable",
          "test_label_missing",
          "send_blocked",
        ],
      },
    },
  },
} as const;

export function validateDingtalkBrief(input: unknown): DingtalkBrief {
  return dingtalkBriefSchema.parse(input);
}

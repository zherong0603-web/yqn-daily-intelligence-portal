import { z } from "zod";

export const signalCategorySchema = z.enum(["policy", "platform", "fulfillment", "growth"]);
export const sourceCategorySchema = z.enum(["policy", "platform", "fulfillment", "growth", "yqn_public"]);
export const sourceTypeSchema = z.enum(["official", "media", "public_yqn", "manual_approved"]);
export const briefModeSchema = z.enum(["demo", "live"]);

export const signalSchema = z.object({
  category: signalCategorySchema,
  title: z.string().min(2).max(80),
  what_happened: z.string().min(4).max(260),
  why_it_matters: z.string().min(4).max(260),
  yqn_use: z.string().min(4).max(260),
  today_action: z.string().min(4).max(180),
  source_url: z.string().url(),
  confidence: z.number().min(0).max(1),
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
  "schema_validation_failed",
  "low_confidence",
  "send_blocked",
]);

export const dingtalkBriefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(8).max(90),
  one_liner: z.string().min(4).max(30),
  signals: z.array(signalSchema).min(4).max(4),
  action_list: z.array(z.string().min(4).max(140)).length(3),
  sources: z.array(sourceSchema).min(4),
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
  policy: "政策信号",
  platform: "平台信号",
  fulfillment: "履约信号",
  growth: "增长信号",
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
    one_liner: { type: "string", minLength: 4, maxLength: 30 },
    signals: {
      type: "array",
      minItems: 4,
      maxItems: 4,
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
          "source_url",
          "confidence",
          "is_sensitive",
        ],
        properties: {
          category: { type: "string", enum: ["policy", "platform", "fulfillment", "growth"] },
          title: { type: "string", minLength: 2, maxLength: 80 },
          what_happened: { type: "string", minLength: 4, maxLength: 260 },
          why_it_matters: { type: "string", minLength: 4, maxLength: 260 },
          yqn_use: { type: "string", minLength: 4, maxLength: 260 },
          today_action: { type: "string", minLength: 4, maxLength: 180 },
          source_url: { type: "string", format: "uri" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          is_sensitive: { type: "boolean" },
        },
      },
    },
    action_list: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 4, maxLength: 140 },
    },
    sources: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "category", "source_type", "auto_fetch"],
        properties: {
          title: { type: "string", minLength: 2, maxLength: 140 },
          url: { type: "string", format: "uri" },
          category: {
            type: "string",
            enum: ["policy", "platform", "fulfillment", "growth", "yqn_public"],
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
          "schema_validation_failed",
          "low_confidence",
          "send_blocked",
        ],
      },
    },
  },
} as const;

export function validateDingtalkBrief(input: unknown): DingtalkBrief {
  return dingtalkBriefSchema.parse(input);
}

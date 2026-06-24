import { z } from "zod";

export const topicSchema = z.enum([
  "ai",
  "ecommerce_us_warehouse",
  "xiaohongshu_b2b",
  "personal_business",
]);

export const signalStrengthSchema = z.enum(["weak", "medium", "strong"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);

export const briefItemSchema = z.object({
  id: z.string().min(3),
  topic: topicSchema,
  title: z.string().min(4).max(120),
  what_happened: z.string().min(8).max(700),
  why_it_matters: z.string().min(8).max(700),
  yqn_insight: z.string().min(8).max(700),
  today_action: z.string().min(8).max(500),
  signal_strength: signalStrengthSchema,
  confidence: confidenceSchema,
  source_title: z.string().min(2).max(180),
  source_url: z.string().url(),
  source_published_at: z.string().datetime(),
  source_domain: z.string().min(3).max(120),
});

export const briefSourceSchema = z.object({
  topic: topicSchema,
  name: z.string().min(2),
  title: z.string().min(2),
  url: z.string().url(),
  domain: z.string().min(3),
  published_at: z.string().datetime(),
});

export const briefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generated_at: z.string().datetime(),
  one_liner: z.string().min(6).max(180),
  executive_summary: z.string().min(8).max(1200),
  items: z.array(briefItemSchema).max(5),
  action_checklist: z.array(z.string().min(4).max(220)).max(8),
  sources: z.array(briefSourceSchema),
  model: z.string().min(2),
  run_id: z.string().min(3),
  source_window_hours: z.union([z.literal(72), z.literal(168)]),
  is_low_signal_day: z.boolean(),
  encryption_enabled: z.boolean(),
});

export const sourceConfigSchema = z.object({
  topic: topicSchema,
  name: z.string().min(2),
  url: z.string().url(),
  type: z.enum(["rss", "atom", "webpage"]),
  enabled: z.boolean(),
  weight: z.number().min(0).max(10),
});

export const sourcesFileSchema = z.object({
  sources: z.array(sourceConfigSchema).min(1),
});

export const collectedSourceSchema = z.object({
  topic: topicSchema,
  source_name: z.string().min(2),
  source_type: z.enum(["rss", "atom", "webpage"]),
  source_weight: z.number(),
  title: z.string().min(2),
  url: z.string().url(),
  domain: z.string().min(3),
  published_at: z.string().datetime(),
  summary: z.string().max(1200),
});

export const briefDraftSchema = z.object({
  one_liner: z.string().min(6).max(180),
  executive_summary: z.string().min(8).max(1200),
  items: z.array(briefItemSchema.omit({ id: true }).extend({
    id: z.string().min(3).optional(),
  })).max(5),
  action_checklist: z.array(z.string().min(4).max(220)).max(8),
});

export type Topic = z.infer<typeof topicSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type BriefItem = z.infer<typeof briefItemSchema>;
export type BriefSource = z.infer<typeof briefSourceSchema>;
export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export type CollectedSource = z.infer<typeof collectedSourceSchema>;
export type BriefDraft = z.infer<typeof briefDraftSchema>;

export const topicLabels: Record<Topic, string> = {
  ai: "AI / 自动化",
  ecommerce_us_warehouse: "跨境 / 美国仓",
  xiaohongshu_b2b: "小红书 / B2B",
  personal_business: "赚钱 / 创业",
};

export const briefDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["one_liner", "executive_summary", "items", "action_checklist"],
  properties: {
    one_liner: { type: "string", minLength: 6, maxLength: 180 },
    executive_summary: { type: "string", minLength: 8, maxLength: 1200 },
    action_checklist: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 4, maxLength: 220 },
    },
    items: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "topic",
          "title",
          "what_happened",
          "why_it_matters",
          "yqn_insight",
          "today_action",
          "signal_strength",
          "confidence",
          "source_title",
          "source_url",
          "source_published_at",
          "source_domain"
        ],
        properties: {
          id: { type: "string", minLength: 3 },
          topic: {
            type: "string",
            enum: ["ai", "ecommerce_us_warehouse", "xiaohongshu_b2b", "personal_business"],
          },
          title: { type: "string", minLength: 4, maxLength: 120 },
          what_happened: { type: "string", minLength: 8, maxLength: 700 },
          why_it_matters: { type: "string", minLength: 8, maxLength: 700 },
          yqn_insight: { type: "string", minLength: 8, maxLength: 700 },
          today_action: { type: "string", minLength: 8, maxLength: 500 },
          signal_strength: { type: "string", enum: ["weak", "medium", "strong"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          source_title: { type: "string", minLength: 2, maxLength: 180 },
          source_url: { type: "string", format: "uri" },
          source_published_at: { type: "string", format: "date-time" },
          source_domain: { type: "string", minLength: 3, maxLength: 120 },
        },
      },
    },
  },
} as const;

export function validateBrief(input: unknown): Brief {
  return briefSchema.parse(input);
}

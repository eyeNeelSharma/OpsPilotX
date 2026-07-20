import { pgTable, text, integer, real, jsonb } from "drizzle-orm/pg-core";

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  applicationName: text("application_name").notNull(),
  applicationUrl: text("application_url").notNull(),
  timestamp: text("timestamp").notNull(),
  overallHealthScore: integer("overall_health_score").notNull(),
  overallStatus: text("overall_status").notNull(), // 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  latencyAvg: real("latency_avg").notNull(),
  endpointsCheckedCount: integer("endpoints_checked_count").notNull(),
  endpointsPassedCount: integer("endpoints_passed_count").notNull(),
  logs: jsonb("logs").notNull(),
  results: jsonb("results").notNull(),
  issues: jsonb("issues").notNull(),
  remediations: jsonb("remediations").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  
  // Custom OpsPilot X additions
  geneosAlertId: text("geneos_alert_id"),
  currentStep: text("current_step").notNull(),
  agentDialogues: jsonb("agent_dialogues").notNull(),
  pullRequest: jsonb("pull_request"),
  triggeredBy: text("triggered_by")
});

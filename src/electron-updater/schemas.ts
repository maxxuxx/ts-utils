import { z } from "zod";

export { z } from "zod";

/** Runtime schema for app update status */
export const appUpdateStatusSchema = z.enum([
  "idle",
  "disabled",
  "checking",
  "available",
  "not-available",
  "downloading",
  "downloaded",
  "installing",
  "cancelled",
  "error"
]);

/** Runtime schema for app update reason */
export const appUpdateReasonSchema = z.enum([
  "not-configured",
  "not-packaged",
  "error"
]);

/** Runtime schema for app update state */
export const appUpdateStateSchema = z.object({
  availableVersion: z.string().min(1).optional(),
  currentVersion  : z.string().min(1),
  enabled         : z.boolean(),
  error           : z.string().optional(),
  message         : z.string().min(1).optional(),
  progressPercent : z.number().int().min(0).max(100).nullable().default(null),
  reason          : appUpdateReasonSchema.optional(),
  status          : appUpdateStatusSchema
});

/** Allowed status value for app update */
export type AppUpdateStatus = z.infer<typeof appUpdateStatusSchema>;

/** Allowed reason value for app update */
export type AppUpdateReason = z.infer<typeof appUpdateReasonSchema>;

/** State shape for app update */
export type AppUpdateState  = z.infer<typeof appUpdateStateSchema>;

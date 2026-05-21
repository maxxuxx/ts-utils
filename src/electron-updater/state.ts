import { appUpdateStateSchema, type AppUpdateState } from "./schemas.js";
import type { AppLike, SetUpdateStateInput } from "./types.js";

export const createInitialUpdateState = (app: AppLike): AppUpdateState => appUpdateStateSchema.parse({
  currentVersion : app.getVersion(),
  enabled        : false,
  progressPercent: null,
  status         : "disabled"
});

export const createUpdateStateResolver = (app: AppLike) => (
  _currentState: AppUpdateState,
  input: SetUpdateStateInput
): AppUpdateState => appUpdateStateSchema.parse({
  availableVersion: input.availableVersion,
  currentVersion : app.getVersion(),
  enabled        : input.enabled ?? false,
  error          : input.error,
  message        : input.message,
  progressPercent: input.progressPercent ?? null,
  reason         : input.reason,
  status         : input.status
});

export const clampProgressPercent = (percent: number): number => {
  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(percent)));
};

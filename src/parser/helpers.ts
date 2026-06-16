/** Provides the empty string to undefined helper */
// Query value helpers
export const emptyStringToUndefined = (value: unknown): unknown => (
  value === "" ? undefined : value
);

/** Provides the boolean like to boolean helper */
export const booleanLikeToBoolean = (value: unknown): unknown => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "t", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "f", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return value;
};

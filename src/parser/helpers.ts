// Query value helpers
export const emptyStringToUndefined = (value: unknown): unknown => (
  value === "" ? undefined : value
);

export const booleanLikeToBoolean = (value: unknown): unknown => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
};

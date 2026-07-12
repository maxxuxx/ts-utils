import { z } from "zod";

import { createParser } from "./create-parser.js";
import { booleanLikeToBoolean, emptyStringToUndefined } from "./helpers.js";
import type { ParserUtils } from "./types.js";

const stringOrNumberToNumber = (value: unknown): unknown => {
  const normalized = emptyStringToUndefined(value);

  return typeof normalized === "string" ? Number(normalized) : normalized;
};

// Parser collection
/** Grouped helpers for the parser module */
export const parser: ParserUtils = Object.freeze({
  string : createParser(z.string()),
  number : createParser(z.number()),
  integer: createParser(z.number().int()),
  boolean: createParser(z.boolean()),
  date   : createParser(z.date()),
  email  : createParser(z.string().trim().toLowerCase().pipe(z.email())),
  id     : createParser(z.preprocess(
    stringOrNumberToNumber,
    z.number().int().positive()
  )),
  limit  : createParser(z.preprocess(
    stringOrNumberToNumber,
    z.number().int().min(1).max(100).default(20)
  )),
  nonEmptyString: createParser(z.string().trim().min(1)),
  page:           createParser(z.preprocess(
    stringOrNumberToNumber,
    z.number().int().min(1).default(1)
  )),
  uuid:           createParser(z.uuid()),
  coerce: Object.freeze({
    string : createParser(z.coerce.string()),
    number : createParser(z.preprocess(stringOrNumberToNumber, z.number())),
    integer: createParser(z.preprocess(stringOrNumberToNumber, z.number().int())),
    boolean: createParser(z.preprocess(booleanLikeToBoolean, z.boolean())),
    date   : createParser(z.coerce.date())
  })
});

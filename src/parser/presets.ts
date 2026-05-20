import { z } from "zod";

import { createParser } from "./create-parser.js";
import { booleanLikeToBoolean, emptyStringToUndefined } from "./helpers.js";
import type { ParserUtils } from "./types.js";

// Parser collection
export const parser: ParserUtils = Object.freeze({
  string : createParser(z.string()),
  number : createParser(z.number()),
  integer: createParser(z.number().int()),
  boolean: createParser(z.boolean()),
  date   : createParser(z.date()),
  email  : createParser(z.string().trim().toLowerCase().email()),
  id     : createParser(z.coerce.number().int().positive()),
  limit  : createParser(z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(100).default(20)
  )),
  nonEmptyString: createParser(z.string().trim().min(1)),
  page:           createParser(z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).default(1)
  )),
  uuid:           createParser(z.string().uuid()),
  coerce: Object.freeze({
    string : createParser(z.coerce.string()),
    number : createParser(z.preprocess(emptyStringToUndefined, z.coerce.number())),
    integer: createParser(z.preprocess(emptyStringToUndefined, z.coerce.number().int())),
    boolean: createParser(z.preprocess(booleanLikeToBoolean, z.boolean())),
    date   : createParser(z.coerce.date())
  })
});

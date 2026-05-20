import { z } from "zod";

import type { Parser } from "./types.js";

// Parser factory
export const createParser = <TSchema extends z.ZodTypeAny>(
  schema: TSchema
): Parser<TSchema> => {
  const parser: Parser<TSchema> = {
    schema,
    parse    : (value) => schema.parse(value),
    safeParse: (value) => schema.safeParse(value),
    is       : (value) : value is z.output<TSchema> => schema.safeParse(value).success,
    optional : () => createParser(schema.optional()),
    nullable : () => createParser(schema.nullable()),
    array    : () => createParser(z.array(schema))
  };

  return Object.freeze(parser);
};

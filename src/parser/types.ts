import type { z } from "zod";

export type Parser<TSchema extends z.ZodTypeAny> = Readonly<{
  schema   : TSchema;
  parse    : (value: unknown) => z.output<TSchema>;
  safeParse: (value: unknown) => z.ZodSafeParseResult<z.output<TSchema>>;
  is       : (value: unknown) => value is z.output<TSchema>;
  optional : () => Parser<z.ZodOptional<TSchema>>;
  nullable : () => Parser<z.ZodNullable<TSchema>>;
  array    : () => Parser<z.ZodArray<TSchema>>;
}>;

export type StrictStringParser  = Parser<z.ZodType<string, string>>;
export type StrictNumberParser  = Parser<z.ZodType<number, number>>;
export type StrictBooleanParser = Parser<z.ZodType<boolean, boolean>>;
export type StrictDateParser    = Parser<z.ZodType<Date, Date>>;
export type CoerceStringParser  = Parser<z.ZodType<string, unknown>>;
export type CoerceNumberParser  = Parser<z.ZodType<number, unknown>>;
export type CoerceBooleanParser = Parser<z.ZodType<boolean, unknown>>;
export type CoerceDateParser    = Parser<z.ZodType<Date, unknown>>;

export type ParserUtils = Readonly<{
  string        : StrictStringParser;
  number        : StrictNumberParser;
  integer       : StrictNumberParser;
  boolean       : StrictBooleanParser;
  date          : StrictDateParser;
  email         : StrictStringParser;
  id            : CoerceNumberParser;
  limit         : CoerceNumberParser;
  nonEmptyString: StrictStringParser;
  page          : CoerceNumberParser;
  uuid          : StrictStringParser;
  coerce        : Readonly<{
    string : CoerceStringParser;
    number : CoerceNumberParser;
    integer: CoerceNumberParser;
    boolean: CoerceBooleanParser;
    date   : CoerceDateParser;
  }>;
}>;

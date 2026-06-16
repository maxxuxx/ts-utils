import type { z } from "zod";

/** Represents parser */
export type Parser<TSchema extends z.ZodTypeAny> = Readonly<{
  schema   : TSchema;
  parse    : (value: unknown) => z.output<TSchema>;
  safeParse: (value: unknown) => z.ZodSafeParseResult<z.output<TSchema>>;
  is       : (value: unknown) => value is z.output<TSchema>;
  optional : () => Parser<z.ZodOptional<TSchema>>;
  nullable : () => Parser<z.ZodNullable<TSchema>>;
  array    : () => Parser<z.ZodArray<TSchema>>;
}>;

/** Represents strict string parser */
export type StrictStringParser  = Parser<z.ZodType<string, string>>;

/** Represents strict number parser */
export type StrictNumberParser  = Parser<z.ZodType<number, number>>;

/** Represents strict boolean parser */
export type StrictBooleanParser = Parser<z.ZodType<boolean, boolean>>;

/** Represents strict date parser */
export type StrictDateParser    = Parser<z.ZodType<Date, Date>>;

/** Represents coerce string parser */
export type CoerceStringParser  = Parser<z.ZodType<string, unknown>>;

/** Represents coerce number parser */
export type CoerceNumberParser  = Parser<z.ZodType<number, unknown>>;

/** Represents coerce boolean parser */
export type CoerceBooleanParser = Parser<z.ZodType<boolean, unknown>>;

/** Represents coerce date parser */
export type CoerceDateParser    = Parser<z.ZodType<Date, unknown>>;

/** Represents parser utils */
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

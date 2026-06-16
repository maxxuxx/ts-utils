import { z } from "zod";

// Response envelope
/** Represents response envelope */
export type ResponseEnvelope<TData> = Readonly<{
  code    : number;
  message?: string;
  isOk   ?: boolean;
  data   ?: TData | null;
}>;

/** Creates a Zod schema for common API response envelopes */
export const responseEnvelopeSchema = <TDataSchema extends z.ZodType>(
  dataSchema: TDataSchema
) => z.object({
  code   : z.number(),
  message: z.string().optional(),
  isOk   : z.boolean().optional(),
  data   : dataSchema.nullish()
});

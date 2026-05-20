import { z } from "zod";

// Response envelope
export type ResponseEnvelope<TData> = Readonly<{
  code    : number;
  message?: string;
  isOk   ?: boolean;
  data   ?: TData | null;
}>;

export const responseEnvelopeSchema = <TDataSchema extends z.ZodType>(
  dataSchema: TDataSchema
) => z.object({
  code   : z.number(),
  message: z.string().optional(),
  isOk   : z.boolean().optional(),
  data   : dataSchema.nullish()
});

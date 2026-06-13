import { z } from "zod";

export const reflectionOverrideSchema = z.object({
  bioguideId: z.string().min(1),
  billId: z.string().min(1),
  aligned: z.boolean(),
});

export const reflectionOverrideDeleteSchema = z.object({
  bioguideId: z.string().min(1),
  billId: z.string().min(1),
});

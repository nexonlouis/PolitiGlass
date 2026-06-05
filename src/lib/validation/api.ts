import { z } from "zod";

export const addressSchema = z.object({
  address: z.string().min(5, "Enter a full street address or ZIP+4"),
});

export const demographicsSchema = z.object({
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional().nullable(),
  educationLevel: z.string().optional().nullable(),
  incomeBracket: z.string().optional().nullable(),
  hasChildren: z.boolean().optional().nullable(),
});

export const issueTagsSchema = z.object({
  tags: z.array(z.string().min(1)).min(3).max(8),
  weights: z.record(z.string(), z.number().min(1).max(5)).optional(),
});

export const reflectionQuerySchema = z.object({
  bioguideId: z.string().min(1),
});

export const votingRecordsQuerySchema = reflectionQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tags: z.string().optional(),
  includeProcedural: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

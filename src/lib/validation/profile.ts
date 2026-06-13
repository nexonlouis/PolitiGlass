import { z } from "zod";
import {
  demographicsSchema,
  issueTagPreferenceSchema,
} from "@/lib/validation/api";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only");

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  demographics: demographicsSchema,
  tagPreferences: z.array(issueTagPreferenceSchema).min(3).max(8),
});

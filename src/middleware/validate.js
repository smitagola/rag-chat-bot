import { z } from "zod";

export const chatSchema = z.object({
  query: z
    .string({ required_error: "query is required" })
    .min(2, "query must be at least 2 characters")
    .max(2000, "query must be under 2000 characters")
    .trim(),
  topK: z.number().int().min(1).max(20).optional().default(5),
  sessionId: z.string().max(100).optional().default("default"),
});

export const ingestUrlSchema = z.object({
  url: z
    .string({ required_error: "url is required" })
    .url("Must be a valid URL")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "URL must start with http:// or https://"
    ),
});

export const sessionSchema = z.object({
  sessionId: z.string().min(1).max(100),
});

/**
 * Express middleware factory — validates req.body against a Zod schema.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }
    req.body = result.data; // attach coerced + defaulted values
    next();
  };
}
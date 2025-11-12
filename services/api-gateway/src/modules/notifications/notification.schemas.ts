import { z } from "zod";

export const notificationTypeSchema = z.enum(["email", "push"]);

export const notificationStatusSchema = z.enum([
  "delivered",
  "pending",
  "failed",
]);

export const userDataSchema = z.object({
  name: z.string().min(1),
  link: z.string().url(),
  meta: z.record(z.unknown()).optional(),
});

export const notificationRequestSchema = z.object({
  notification_type: notificationTypeSchema,
  user_id: z.string().uuid(),
  template_code: z.string().min(1),
  variables: userDataSchema,
  request_id: z.string().min(1),
  priority: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
});

export const notificationStatusUpdateSchema = z.object({
  notification_id: z.string().min(1),
  status: notificationStatusSchema,
  timestamp: z.string().datetime().optional(),
  error: z.string().nullable().optional(),
});

export const paginationMetaSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  page: z.number().int(),
  total_pages: z.number().int(),
  has_next: z.boolean(),
  has_previous: z.boolean(),
});

export const apiResponseBaseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.optional(),
    error: z.string().optional(),
    message: z.string(),
    meta: paginationMetaSchema.nullable().optional(),
  });

// For responses

export const notificationResponseSchema = z.object({
  notification_id: z.string(),
  request_id: z.string(),
  user_id: z.string(),
  notification_type: notificationTypeSchema,
  status: notificationStatusSchema,
  priority: z.number(),
  error: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const notificationApiResponseSchema = apiResponseBaseSchema(
  notificationResponseSchema
);

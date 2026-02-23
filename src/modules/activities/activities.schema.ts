import { z } from "zod";

export const createActivitySchema = z.object({
  body: z.object({
    odooCompanyId: z.number(),
    odooCompanyName: z.string().min(1),
    consultantId: z.number().nullable().optional(),
    consultantName: z.string().nullable().optional(),
    requestedBy: z.string().nullable().optional(),
    product: z.string().nullable().optional(),
    description: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    billable: z.boolean().optional(),
  }),
});

export const updateActivitySchema = z.object({
  body: z.object({
    description: z.string().min(1).optional(),
    requestedBy: z.string().nullable().optional(),
    product: z.string().nullable().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    consultantId: z.number().nullable().optional(),
    consultantName: z.string().nullable().optional(),
    billable: z.boolean().optional(),
    invoiced: z.boolean().optional(),
    odooInvoiceId: z.number().nullable().optional(),
  }),
});

export const bulkCreateSchema = z.object({
  body: z.object({
    activities: z.array(
      z.object({
        id: z.string().optional(),
        odooCompanyId: z.number(),
        odooCompanyName: z.string().min(1),
        consultantId: z.number().nullable().optional(),
        consultantName: z.string().nullable().optional(),
        requestedBy: z.string().nullable().optional(),
        product: z.string().nullable().optional(),
        description: z.string().min(1),
        startTime: z.string().min(1),
        endTime: z.string().min(1),
        durationMinutes: z.number().optional(),
        billable: z.boolean().optional(),
        invoiced: z.boolean().optional(),
        odooInvoiceId: z.number().nullable().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
      })
    ),
  }),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>["body"];
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>["body"];
export type BulkCreateInput = z.infer<typeof bulkCreateSchema>["body"];

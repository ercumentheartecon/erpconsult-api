import { z } from "zod";

export const createSessionSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  consultantId: z.string().uuid("Invalid consultant ID").optional(),
  problemDescription: z.string().min(10, "Problem description must be at least 10 characters"),
  tags: z.array(z.string()).optional().default([]),
});

export const endSessionSchema = z.object({
  solutionSummary: z.string().optional(),
  consultantNotes: z.string().optional(),
});

export const rateSessionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type EndSessionInput = z.infer<typeof endSessionSchema>;
export type RateSessionInput = z.infer<typeof rateSessionSchema>;

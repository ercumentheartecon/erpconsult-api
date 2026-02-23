import { z } from "zod";

export const createConsultantSchema = z.object({
  // User fields (creates a new user with CONSULTANT role)
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  password: z.string().min(6).optional(), // optional — defaults to random if not given

  // Consultant profile fields
  title: z.string().nullable().optional(),
  expertiseAreas: z.array(z.string()).optional().default([]),
  specialization: z.string().nullable().optional(),
  yearsOfExperience: z.number().int().min(0).nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  bio: z.string().nullable().optional(),
  certifications: z.array(z.string()).optional().default([]),
  isAvailable: z.boolean().optional().default(true),
  timezone: z.string().optional().default("UTC"),
});

export const updateConsultantSchema = z.object({
  // User fields
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),

  // Consultant profile fields
  title: z.string().nullable().optional(),
  expertiseAreas: z.array(z.string()).optional(),
  specialization: z.string().nullable().optional(),
  yearsOfExperience: z.number().int().min(0).nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  bio: z.string().nullable().optional(),
  certifications: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),
  timezone: z.string().optional(),
});

export type CreateConsultantInput = z.infer<typeof createConsultantSchema>;
export type UpdateConsultantInput = z.infer<typeof updateConsultantSchema>;

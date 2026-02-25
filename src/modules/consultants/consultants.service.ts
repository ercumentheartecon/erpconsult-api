import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";
import type { CreateConsultantInput, UpdateConsultantInput } from "./consultants.schema";

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  role: true,
};

export class ConsultantsService {
  async list() {
    const consultants = await prisma.consultant.findMany({
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: "desc" },
    });

    return consultants.map((c) => this.format(c));
  }

  async getById(id: string) {
    const consultant = await prisma.consultant.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT } },
    });
    if (!consultant) throw new ApiError("NOT_FOUND", "Consultant not found", 404);
    return this.format(consultant);
  }

  async create(input: CreateConsultantInput) {
    // Find existing user by email — consultant must be linked to an existing user
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (!existingUser) {
      throw new ApiError("USER_NOT_FOUND", "No user found with this email. Create the user first in the Users section.", 404);
    }

    // Check if this user already has a consultant profile
    const existingConsultant = await prisma.consultant.findUnique({ where: { userId: existingUser.id } });
    if (existingConsultant) {
      throw new ApiError("CONSULTANT_EXISTS", "This user already has a consultant profile", 409);
    }

    // Link consultant profile to the existing user
    const result = await prisma.$transaction(async (tx) => {
      // Update user role to CONSULTANT and sync name/phone if provided
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          role: "CONSULTANT",
          ...(input.firstName && { firstName: input.firstName }),
          ...(input.lastName && { lastName: input.lastName }),
          ...(input.phone && { phone: input.phone }),
        },
      });

      const consultant = await tx.consultant.create({
        data: {
          userId: existingUser.id,
          title: input.title || null,
          expertiseAreas: input.expertiseAreas || [],
          specialization: input.specialization || null,
          yearsOfExperience: input.yearsOfExperience ?? null,
          hourlyRate: input.hourlyRate ?? null,
          bio: input.bio || null,
          certifications: input.certifications || [],
          isAvailable: input.isAvailable ?? true,
          timezone: input.timezone || "UTC",
        },
        include: { user: { select: USER_SELECT } },
      });

      return consultant;
    });

    return this.format(result);
  }

  async update(id: string, input: UpdateConsultantInput) {
    const existing = await prisma.consultant.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) throw new ApiError("NOT_FOUND", "Consultant not found", 404);

    // Check email uniqueness if changing
    if (input.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: input.email, id: { not: existing.userId } },
      });
      if (emailTaken) throw new ApiError("EMAIL_EXISTS", "Email already in use", 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update user fields
      const userData: Record<string, unknown> = {};
      if (input.firstName !== undefined) userData.firstName = input.firstName;
      if (input.lastName !== undefined) userData.lastName = input.lastName;
      if (input.email !== undefined) userData.email = input.email;
      if (input.phone !== undefined) userData.phone = input.phone;

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
      }

      // Update consultant fields
      const consultantData: Record<string, unknown> = {};
      if (input.title !== undefined) consultantData.title = input.title;
      if (input.expertiseAreas !== undefined) consultantData.expertiseAreas = input.expertiseAreas;
      if (input.specialization !== undefined) consultantData.specialization = input.specialization;
      if (input.yearsOfExperience !== undefined) consultantData.yearsOfExperience = input.yearsOfExperience;
      if (input.hourlyRate !== undefined) consultantData.hourlyRate = input.hourlyRate;
      if (input.bio !== undefined) consultantData.bio = input.bio;
      if (input.certifications !== undefined) consultantData.certifications = input.certifications;
      if (input.isAvailable !== undefined) consultantData.isAvailable = input.isAvailable;
      if (input.timezone !== undefined) consultantData.timezone = input.timezone;

      const updated = await tx.consultant.update({
        where: { id },
        data: consultantData,
        include: { user: { select: USER_SELECT } },
      });

      return updated;
    });

    return this.format(result);
  }

  async delete(id: string) {
    const existing = await prisma.consultant.findUnique({ where: { id } });
    if (!existing) throw new ApiError("NOT_FOUND", "Consultant not found", 404);

    // Delete consultant record only (user remains)
    await prisma.consultant.delete({ where: { id } });

    return { message: "Consultant deleted" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private format(c: any) {
    return {
      id: c.id,
      userId: c.userId,
      user: c.user || null,
      expertiseAreas: c.expertiseAreas || [],
      bio: c.bio,
      yearsOfExperience: c.yearsOfExperience,
      certifications: c.certifications || [],
      specialization: c.specialization,
      hourlyRate: c.hourlyRate,
      title: c.title,
      isAvailable: c.isAvailable,
      totalSessions: c.totalSessions,
      averageRating: c.averageRating,
      totalHours: c.totalHours,
      timezone: c.timezone,
      createdAt: c.createdAt?.toISOString?.() || c.createdAt,
      updatedAt: c.updatedAt?.toISOString?.() || c.updatedAt,
    };
  }
}

import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        avatarUrl: true,
        isOnline: true,
        isVerified: true,
        createdAt: true,
        consultant: {
          select: {
            id: true,
            isAvailable: true,
            currentRoom: true,
            averageRating: true,
            totalSessions: true,
            totalHours: true,
          },
        },
      },
    });
    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "User not found", 404);
    }
    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string; companyName?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        avatarUrl: true,
      },
    });
    return user;
  }
}

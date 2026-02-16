import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";

export class RoomsService {
  async getAll() {
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    // Get available consultant count per room
    const roomsWithConsultants = await Promise.all(
      rooms.map(async (room) => {
        const availableConsultants = await prisma.consultant.count({
          where: { isAvailable: true, currentRoom: room.code },
        });
        return {
          ...room,
          availableConsultants,
        };
      })
    );

    return roomsWithConsultants;
  }

  async getById(id: string) {
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new ApiError("ROOM_NOT_FOUND", "Room not found", 404);
    }

    const consultants = await prisma.consultant.findMany({
      where: { isAvailable: true, currentRoom: room.code },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      ...room,
      consultants: consultants.map((c) => ({
        id: c.id,
        firstName: c.user.firstName,
        lastName: c.user.lastName,
        avatarUrl: c.user.avatarUrl,
        expertiseAreas: c.expertiseAreas,
        yearsOfExperience: c.yearsOfExperience,
        averageRating: c.averageRating,
        totalSessions: c.totalSessions,
        isAvailable: c.isAvailable,
      })),
    };
  }
}

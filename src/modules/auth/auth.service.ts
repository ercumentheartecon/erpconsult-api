import { prisma } from "../../config/database";
import { getRedis } from "../../config/redis";
import { hashPassword, comparePassword } from "../../utils/password";
import { generateTokenPair, verifyRefreshToken } from "../../utils/jwt";
import { ApiError } from "../../utils/api-error";
import { RegisterInput, LoginInput } from "./auth.schema";

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function sanitizeUser(user: { id: string; email: string; role: string; firstName: string | null; lastName: string | null; companyName: string | null; avatarUrl: string | null; isOnline: boolean }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
  };
}

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ApiError("EMAIL_EXISTS", "Email already registered", 409);
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: "CLIENT",
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName,
        phone: data.phone,
      },
    });

    const tokens = generateTokenPair(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser(user), tokens };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    if (!user.isActive) {
      throw new ApiError("ACCOUNT_DISABLED", "Your account has been disabled", 403);
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    // Update online status
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Auto-create Consultant profile if CONSULTANT role but no profile yet
    if (user.role === "CONSULTANT") {
      await this.ensureConsultantProfile(user.id);
    }

    const tokens = generateTokenPair(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser(user), tokens };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError("INVALID_TOKEN", "Invalid or expired refresh token", 401);
    }

    // Check if token exists in Redis
    const redis = getRedis();
    const storedToken = await redis.get(`refresh:${payload.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new ApiError("INVALID_TOKEN", "Refresh token has been revoked", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new ApiError("USER_NOT_FOUND", "User not found or disabled", 401);
    }

    // Rotate tokens
    const tokens = generateTokenPair(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser(user), tokens };
  }

  async logout(userId: string) {
    const redis = getRedis();
    await redis.del(`refresh:${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeen: new Date() },
    });
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        consultant: true,
        companyUsers: { include: { company: true } },
      },
    });

    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "User not found", 404);
    }

    return {
      ...sanitizeUser(user),
      phone: user.phone,
      isVerified: user.isVerified,
      consultant: user.consultant,
      companies: user.companyUsers.map((cu) => ({
        id: cu.company.id,
        name: cu.company.name,
        role: cu.role,
        subscriptionPlan: cu.company.subscriptionPlan,
      })),
    };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "User not found", 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: "Password reset successfully" };
  }

  async listUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return users;
  }

  async updateUserRole(email: string, role: "CLIENT" | "CONSULTANT" | "ADMIN") {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "User not found", 404);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });

    // Auto-create Consultant profile when role is set to CONSULTANT
    if (role === "CONSULTANT") {
      await this.ensureConsultantProfile(user.id);
    }

    return updated;
  }

  // Ensure a Consultant profile exists for a user — create one if missing
  async ensureConsultantProfile(userId: string) {
    const existing = await prisma.consultant.findUnique({ where: { userId } });
    if (existing) return existing;

    return prisma.consultant.create({
      data: {
        userId,
        expertiseAreas: [],
        certifications: [],
        isAvailable: true,
        maxConcurrentSessions: 3,
        timezone: "UTC",
      },
    });
  }

  private async storeRefreshToken(userId: string, token: string) {
    const redis = getRedis();
    await redis.set(`refresh:${userId}`, token, "EX", REFRESH_TOKEN_TTL);
  }
}

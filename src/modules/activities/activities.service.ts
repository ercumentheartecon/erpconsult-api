import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";
import type { CreateActivityInput, UpdateActivityInput, BulkCreateInput } from "./activities.schema";

interface ListParams {
  userId: string;
  userRole: string;
  userName?: string;
  odooCompanyId?: number;
  product?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  invoiced?: boolean;
  page?: number;
  limit?: number;
}

export class ActivitiesService {
  async list(params: ListParams) {
    const {
      userId,
      userRole,
      userName,
      odooCompanyId,
      product,
      startDate,
      endDate,
      billable,
      invoiced,
      page = 1,
      limit = 500,
    } = params;

    const where: Record<string, unknown> = {};

    // ADMIN sees all, CONSULTANT sees own + activities where their name matches consultantName
    if (userRole === "CONSULTANT") {
      const orConditions: Record<string, unknown>[] = [{ userId }];
      if (userName) {
        // Match by full name or by first name (handles name changes / different last names)
        const nameParts = userName.split(" ").filter(Boolean);
        orConditions.push({ consultantName: { contains: userName, mode: "insensitive" } });
        if (nameParts.length > 0) {
          orConditions.push({ consultantName: { startsWith: nameParts[0], mode: "insensitive" } });
        }
      }
      where.OR = orConditions;
    } else if (userRole !== "ADMIN") {
      where.userId = userId;
    }

    if (odooCompanyId) where.odooCompanyId = odooCompanyId;
    if (product) where.product = product;
    if (billable !== undefined) where.billable = billable;
    if (invoiced !== undefined) where.invoiced = invoiced;

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) (where.startTime as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) {
        // End of day: set to 23:59:59.999 so activities during the day are included
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        (where.startTime as Record<string, unknown>).lte = end;
      }
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    const allForSummary = await prisma.activity.findMany({
      where,
      select: { durationMinutes: true, billable: true, invoiced: true },
    });

    const totalDurationMinutes = allForSummary.reduce((sum, a) => sum + a.durationMinutes, 0);
    const notBillableCount = allForSummary.filter((a) => !a.billable).length;
    const pendingCount = allForSummary.filter((a) => !a.invoiced).length;

    return {
      activities: activities.map((a) => ({
        id: a.id,
        userId: a.userId,
        odooCompanyId: a.odooCompanyId,
        odooCompanyName: a.odooCompanyName,
        consultantId: a.consultantId,
        consultantName: a.consultantName,
        requestedBy: a.requestedBy,
        product: a.product,
        description: a.description,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        durationMinutes: a.durationMinutes,
        billable: a.billable,
        invoiced: a.invoiced,
        odooInvoiceId: a.odooInvoiceId,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      total,
      summary: {
        totalDurationMinutes,
        totalActivities: total,
        notBillableCount,
        pendingCount,
      },
    };
  }

  async create(userId: string, input: CreateActivityInput) {
    const startMs = new Date(input.startTime).getTime();
    const endMs = new Date(input.endTime).getTime();
    const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

    const activity = await prisma.activity.create({
      data: {
        userId,
        odooCompanyId: input.odooCompanyId,
        odooCompanyName: input.odooCompanyName,
        consultantId: input.consultantId ?? null,
        consultantName: input.consultantName ?? null,
        requestedBy: input.requestedBy ?? null,
        product: input.product ?? null,
        description: input.description,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        durationMinutes,
        billable: input.billable !== undefined ? input.billable : true,
      },
    });

    return this.formatActivity(activity);
  }

  async update(activityId: string, userId: string, userRole: string, input: UpdateActivityInput, userName?: string) {
    const existing = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!existing) throw new ApiError("NOT_FOUND", "Activity not found", 404);
    // ADMIN can update any; CONSULTANT can update own + those where consultantName matches
    const isOwner = existing.userId === userId;
    const isNamedConsultant = userRole === "CONSULTANT" && userName && this.nameMatches(userName, existing.consultantName);
    if (userRole !== "ADMIN" && !isOwner && !isNamedConsultant) {
      throw new ApiError("FORBIDDEN", "Not allowed to update this activity", 403);
    }

    const data: Record<string, unknown> = {};
    if (input.odooCompanyId !== undefined) data.odooCompanyId = input.odooCompanyId;
    if (input.odooCompanyName !== undefined) data.odooCompanyName = input.odooCompanyName;
    if (input.description !== undefined) data.description = input.description;
    if (input.requestedBy !== undefined) data.requestedBy = input.requestedBy;
    if (input.product !== undefined) data.product = input.product;
    if (input.consultantId !== undefined) data.consultantId = input.consultantId;
    if (input.consultantName !== undefined) data.consultantName = input.consultantName;
    if (input.billable !== undefined) data.billable = input.billable;
    if (input.invoiced !== undefined) data.invoiced = input.invoiced;
    if (input.odooInvoiceId !== undefined) data.odooInvoiceId = input.odooInvoiceId;

    if (input.startTime !== undefined) data.startTime = new Date(input.startTime);
    if (input.endTime !== undefined) data.endTime = new Date(input.endTime);

    // Recompute duration if times changed
    const startTime = input.startTime ? new Date(input.startTime) : existing.startTime;
    const endTime = input.endTime ? new Date(input.endTime) : existing.endTime;
    if (input.startTime || input.endTime) {
      data.durationMinutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
    }

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data,
    });

    return this.formatActivity(updated);
  }

  async delete(activityId: string, userId: string, userRole: string, userName?: string) {
    const existing = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!existing) throw new ApiError("NOT_FOUND", "Activity not found", 404);
    const isOwner = existing.userId === userId;
    const isNamedConsultant = userRole === "CONSULTANT" && userName && this.nameMatches(userName, existing.consultantName);
    if (userRole !== "ADMIN" && !isOwner && !isNamedConsultant) {
      throw new ApiError("FORBIDDEN", "Not allowed to delete this activity", 403);
    }

    await prisma.activity.delete({ where: { id: activityId } });
    return { message: "Activity deleted" };
  }

  async bulkCreate(userId: string, input: BulkCreateInput) {
    const results = [];
    for (const item of input.activities) {
      const startMs = new Date(item.startTime).getTime();
      const endMs = new Date(item.endTime).getTime();
      const durationMinutes = item.durationMinutes ?? Math.max(0, Math.round((endMs - startMs) / 60000));

      const activity = await prisma.activity.create({
        data: {
          id: item.id || undefined,
          userId,
          odooCompanyId: item.odooCompanyId,
          odooCompanyName: item.odooCompanyName,
          consultantId: item.consultantId ?? null,
          consultantName: item.consultantName ?? null,
          requestedBy: item.requestedBy ?? null,
          product: item.product ?? null,
          description: item.description,
          startTime: new Date(item.startTime),
          endTime: new Date(item.endTime),
          durationMinutes,
          billable: item.billable !== undefined ? item.billable : true,
          invoiced: item.invoiced || false,
          odooInvoiceId: item.odooInvoiceId ?? null,
        },
      });
      results.push(this.formatActivity(activity));
    }
    return { imported: results.length, activities: results };
  }

  // Check if userName matches consultantName (full name or first name)
  private nameMatches(userName: string, consultantName: string | null): boolean {
    if (!consultantName) return false;
    const cn = consultantName.toLowerCase();
    const un = userName.toLowerCase();
    if (cn.includes(un) || un.includes(cn)) return true;
    // Match by first name
    const firstName = un.split(" ")[0];
    return firstName.length >= 2 && cn.startsWith(firstName);
  }

  private formatActivity(a: {
    id: string; userId: string; odooCompanyId: number; odooCompanyName: string;
    consultantId: number | null; consultantName: string | null; requestedBy: string | null;
    product: string | null; description: string; startTime: Date; endTime: Date;
    durationMinutes: number; billable: boolean; invoiced: boolean; odooInvoiceId: number | null;
    createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: a.id,
      userId: a.userId,
      odooCompanyId: a.odooCompanyId,
      odooCompanyName: a.odooCompanyName,
      consultantId: a.consultantId,
      consultantName: a.consultantName,
      requestedBy: a.requestedBy,
      product: a.product,
      description: a.description,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      durationMinutes: a.durationMinutes,
      billable: a.billable,
      invoiced: a.invoiced,
      odooInvoiceId: a.odooInvoiceId,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}

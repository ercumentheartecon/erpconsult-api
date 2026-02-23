import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";

interface ListParams {
  startDate?: string;
  endDate?: string;
  odooCompanyId?: number;
  parentCompanyId?: number;
}

export class LocalInvoicesService {
  async list(params: ListParams) {
    const where: Record<string, unknown> = {};

    if (params.odooCompanyId) where.odooCompanyId = params.odooCompanyId;
    if (params.parentCompanyId) where.parentCompanyId = params.parentCompanyId;

    if (params.startDate) {
      where.createdAt = { ...(where.createdAt as object || {}), gte: new Date(params.startDate) };
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setDate(end.getDate() + 1);
      where.createdAt = { ...(where.createdAt as object || {}), lte: end };
    }

    const invoices = await prisma.localInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const totalActivities = invoices.reduce((sum, inv) => sum + inv.activityIds.length, 0);

    return { invoices, total: invoices.length, totalActivities };
  }

  async getById(id: string) {
    const invoice = await prisma.localInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError("NOT_FOUND", "Invoice not found", 404);
    return invoice;
  }

  async create(data: {
    id?: string;
    odooInvoiceId: number;
    odooCompanyId: number;
    odooCompanyName: string;
    parentCompanyId: number;
    parentCompanyName: string;
    activityIds: string[];
    activityDescriptions: string[];
    lines: unknown;
    status?: string;
    createdAt?: string;
    customerAddress?: string | null;
    customerCity?: string | null;
    customerZip?: string | null;
    customerCountry?: string | null;
    customerVat?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    currency?: string;
    subtotal?: number;
    parentAddress?: string | null;
    parentCity?: string | null;
    parentZip?: string | null;
    parentCountry?: string | null;
    parentVat?: string | null;
    parentEmail?: string | null;
    parentPhone?: string | null;
    parentBankName?: string | null;
    parentBankIBAN?: string | null;
    parentBankBIC?: string | null;
  }) {
    const invoice = await prisma.localInvoice.create({
      data: {
        id: data.id || undefined,
        odooInvoiceId: data.odooInvoiceId,
        odooCompanyId: data.odooCompanyId,
        odooCompanyName: data.odooCompanyName,
        parentCompanyId: data.parentCompanyId,
        parentCompanyName: data.parentCompanyName,
        activityIds: data.activityIds,
        activityDescriptions: data.activityDescriptions,
        lines: data.lines as any,
        status: data.status || "DRAFT",
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        customerAddress: data.customerAddress,
        customerCity: data.customerCity,
        customerZip: data.customerZip,
        customerCountry: data.customerCountry,
        customerVat: data.customerVat,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        currency: data.currency || "EUR",
        subtotal: data.subtotal || 0,
        parentAddress: data.parentAddress,
        parentCity: data.parentCity,
        parentZip: data.parentZip,
        parentCountry: data.parentCountry,
        parentVat: data.parentVat,
        parentEmail: data.parentEmail,
        parentPhone: data.parentPhone,
        parentBankName: data.parentBankName,
        parentBankIBAN: data.parentBankIBAN,
        parentBankBIC: data.parentBankBIC,
      },
    });
    return invoice;
  }

  async update(id: string, data: { status?: string; odooInvoiceId?: number }) {
    const invoice = await prisma.localInvoice.update({
      where: { id },
      data,
    });
    return invoice;
  }

  async delete(id: string) {
    await prisma.localInvoice.delete({ where: { id } });
    return { deleted: true };
  }

  // Bulk create for migration
  async bulkCreate(invoices: Array<Record<string, unknown>>) {
    const results = [];
    for (const inv of invoices) {
      try {
        // Check if invoice already exists by odooInvoiceId
        const existing = await prisma.localInvoice.findFirst({
          where: { odooInvoiceId: inv.odooInvoiceId as number },
        });
        if (existing) {
          results.push({ id: existing.id, skipped: true });
          continue;
        }
        const created = await this.create(inv as any);
        results.push({ id: created.id, skipped: false });
      } catch {
        results.push({ id: null, error: true });
      }
    }
    return results;
  }

  // Update status by odooInvoiceId
  async updateByOdooId(odooInvoiceId: number, data: { status: string }) {
    const invoices = await prisma.localInvoice.findMany({
      where: { odooInvoiceId },
    });
    let changed = false;
    for (const inv of invoices) {
      if (inv.status !== data.status) {
        await prisma.localInvoice.update({
          where: { id: inv.id },
          data: { status: data.status },
        });
        changed = true;
      }
    }
    return { changed };
  }
}

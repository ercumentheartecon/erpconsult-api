import { prisma } from "../../config/database";

export class SettingsService {
  async get(key: string) {
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    return setting ? setting.value : null;
  }

  async set(key: string, value: unknown) {
    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
    return setting.value;
  }

  async delete(key: string) {
    try {
      await prisma.appSetting.delete({ where: { key } });
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }

  async list() {
    const settings = await prisma.appSetting.findMany({ orderBy: { key: "asc" } });
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  // Bulk set multiple keys at once (for migration)
  async bulkSet(entries: { key: string; value: unknown }[]) {
    const results = [];
    for (const entry of entries) {
      const setting = await prisma.appSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value as any },
        create: { key: entry.key, value: entry.value as any },
      });
      results.push({ key: setting.key });
    }
    return results;
  }
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed Rooms
  const rooms = [
    { code: "FINANCE", name: "Finance & Accounting", description: "GL, AP, AR, Cost Accounting, Asset Management", icon: "Banknote" },
    { code: "PRODUCTION", name: "Production Planning", description: "MRP, BOM, Routing, Shop Floor, Quality Control", icon: "Factory" },
    { code: "SALES", name: "Sales & Distribution", description: "Order Management, Pricing, CRM, Delivery", icon: "BarChart3" },
    { code: "INVENTORY", name: "Inventory Management", description: "Stock Control, Warehouse, Material Management", icon: "Package" },
    { code: "HR", name: "HR & Payroll", description: "Personnel, Payroll, Time Management", icon: "Users" },
    { code: "TROIA", name: "TROIA Development", description: "Custom Code, Debugging, Performance Optimization", icon: "Code" },
    { code: "GENERAL", name: "General Support", description: "General questions, System Configuration", icon: "HelpCircle" },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { code: room.code },
      update: {},
      create: room,
    });
  }
  console.log("Rooms seeded.");

  // Seed Admin User
  const adminPassword = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@erpconsult.com" },
    update: {},
    create: {
      email: "admin@erpconsult.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      firstName: "Admin",
      lastName: "User",
      isVerified: true,
    },
  });
  console.log("Admin user seeded:", admin.email);

  // Seed Consultant User
  const consultantPassword = await bcrypt.hash("consultant123", 12);
  const consultantUser = await prisma.user.upsert({
    where: { email: "consultant@erpconsult.com" },
    update: {},
    create: {
      email: "consultant@erpconsult.com",
      passwordHash: consultantPassword,
      role: "CONSULTANT",
      firstName: "Ali",
      lastName: "Yilmaz",
      isVerified: true,
    },
  });

  await prisma.consultant.upsert({
    where: { userId: consultantUser.id },
    update: {},
    create: {
      userId: consultantUser.id,
      expertiseAreas: ["FINANCE", "PRODUCTION"],
      bio: "8+ years of Canias ERP experience specializing in Finance and Production modules.",
      yearsOfExperience: 8,
      certifications: ["Canias Certified Consultant"],
      currentRoom: "FINANCE",
      isAvailable: true,
    },
  });
  console.log("Consultant user seeded:", consultantUser.email);

  // Seed Client User + Company
  const clientPassword = await bcrypt.hash("client123456", 12);
  const clientUser = await prisma.user.upsert({
    where: { email: "client@acmecorp.com" },
    update: {},
    create: {
      email: "client@acmecorp.com",
      passwordHash: clientPassword,
      role: "CLIENT",
      firstName: "John",
      lastName: "Doe",
      companyName: "Acme Corporation",
      isVerified: true,
    },
  });

  const company = await prisma.company.upsert({
    where: { id: "acme-demo-company" },
    update: {},
    create: {
      id: "acme-demo-company",
      name: "Acme Corporation",
      subscriptionPlan: "PROFESSIONAL",
      subscriptionStatus: "ACTIVE",
      monthlyHoursLimit: 30,
      industry: "Manufacturing",
      companySize: "MEDIUM",
      erpSystem: "CANIAS",
      erpVersion: "8.04",
      billingEmail: "billing@acmecorp.com",
    },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: clientUser.id } },
    update: {},
    create: {
      companyId: company.id,
      userId: clientUser.id,
      role: "ADMIN",
    },
  });
  console.log("Client user & company seeded:", clientUser.email);

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

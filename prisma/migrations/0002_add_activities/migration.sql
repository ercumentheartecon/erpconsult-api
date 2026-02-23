-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "odoo_company_id" INTEGER NOT NULL,
    "odoo_company_name" TEXT NOT NULL,
    "consultant_id_odoo" INTEGER,
    "consultant_name" TEXT,
    "requested_by" TEXT,
    "product" TEXT,
    "description" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "odoo_invoice_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");
CREATE INDEX "activities_odoo_company_id_idx" ON "activities"("odoo_company_id");
CREATE INDEX "activities_start_time_idx" ON "activities"("start_time");
CREATE INDEX "activities_billable_idx" ON "activities"("billable");
CREATE INDEX "activities_invoiced_idx" ON "activities"("invoiced");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'INFO';
ALTER TABLE "AuditLog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "AuditLog" ADD COLUMN "message" TEXT;

CREATE INDEX "AuditLog_level_idx" ON "AuditLog"("level");
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

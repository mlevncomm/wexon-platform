import "dotenv/config";
import { PrismaClient } from ".prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL veya DIRECT_URL tanımlı olmalıdır.");
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PRISMA_PG_POOL_MAX ?? 1),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: databaseUrl.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (error) => {
    console.error("[prisma-pool] idle client error", error);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

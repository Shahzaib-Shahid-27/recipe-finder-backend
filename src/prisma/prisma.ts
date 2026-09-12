import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });

import logger from '../utils/logger.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async (maxRetries = 3, retryDelay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[DB] Attempt ${attempt}/${maxRetries} - Connecting...`);

      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;

      logger.info("[DB] Database connected successfully!");
      return true;
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[DB] Connection failed (Attempt ${attempt}):`, errorMessage);

      if (attempt < maxRetries) {
        logger.info(`[DB] Retrying in ${retryDelay / 1000} seconds...`);
        await sleep(retryDelay);
      }
    }
  }

  logger.error("[DB] All attempts failed. Could not connect to the database.");
  return false;
};



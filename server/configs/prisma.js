import "dotenv/config";
import dns from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon pooler hosts may only resolve over IPv6 in some environments.
// Prefer IPv6 first so Prisma can resolve the Neon host correctly.
dns.setDefaultResultOrder("ipv6first");

neonConfig.webSocketConstructor = ws;
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = global.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
export default prisma;

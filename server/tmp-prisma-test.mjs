import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL;
import prisma from "./configs/prisma.js";

async function main() {
  try {
    console.log("DATABASE_URL=", process.env.DATABASE_URL);
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error("no user found");
      return;
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        owner: true,
      },
    });
    console.log("ok", workspaces.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

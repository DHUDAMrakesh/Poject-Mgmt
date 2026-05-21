import "dotenv/config";
import prisma from "../configs/prisma.js";

const run = async () => {
  try {
    const id = `test-${Date.now()}`;
    const user = await prisma.user.create({
      data: {
        id,
        email: `test+${Date.now()}@example.com`,
        name: "Test User",
        image: "",
      },
    });
    console.log("Created user:", user);
  } catch (err) {
    console.error("Error creating test user:", err);
  } finally {
    await prisma.$disconnect();
  }
};

run();

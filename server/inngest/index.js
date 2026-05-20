import { Prisma } from "@prisma/client";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

// inngest function to save your user data to a database

const SyncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk.user.created" },
  async ({ event }) => {
    const { data } = event;
    await Prisma.user.create({
      data: {
        id: data.id,
        email: data?.email_addresses[0].email_address,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  },
);

// inngest function to delete user data
const SyncUserDeletion = inngest.createFunction(
  { id: "sync-user-deletion" },
  { event: "clerk.user.deleted" },
  async ({ event }) => {
    const { data } = event;
    await Prisma.user.delete({
      where: {
        id: data.id,
      },
    });
  },
);

// inngest function to update user data to database
const SyncUserUpdate = inngest.createFunction(
  { id: "sync-user-update" },
  { event: "clerk.user.updated" },
  async ({ event }) => {
    const { data } = event;
    await Prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        id: data.id,
        email: data?.email_addresses[0].email_address,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  },
);

// Create an empty array where we'll export future Inngest functions
export const functions = [SyncUserCreation, SyncUserDeletion, SyncUserUpdate];

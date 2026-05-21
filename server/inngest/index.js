import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

export const inngest = new Inngest({ id: "project-management" });

/* ================= USER SYNC ================= */

export const SyncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event }) => {
    const data = event.data;

    const existingUser = await prisma.user.findUnique({
      where: { id: data.id },
    });

    if (existingUser) return;

    await prisma.user.create({
      data: {
        id: data.id,
        email: data.email_addresses?.[0]?.email_address ?? "",
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        image: data.image_url ?? "",
      },
    });
  },
);

/* UPDATE USER */

export const SyncUserUpdate = inngest.createFunction(
  {
    id: "sync-user-update",
    triggers: [{ event: "clerk/user.updated" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: data.email_addresses?.[0]?.email_address ?? "",
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        image: data.image_url ?? "",
      },
    });
  },
);

/* DELETE USER */

export const SyncUserDeletion = inngest.createFunction(
  {
    id: "sync-user-deletion",
    triggers: [{ event: "clerk/user.deleted" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.user.delete({
      where: { id: data.id },
    });
  },
);

/* WORKSPACE CREATE */

export const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-creation",
    triggers: [{ event: "clerk/organization.created" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "admin",
      },
    });
  },
);

/* WORKSPACE UPDATE */

export const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "update-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.updated" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.workspace.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url,
      },
    });
  },
);

/* WORKSPACE DELETE */

export const syncWorkspaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.deleted" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.workspace.delete({
      where: { id: data.id },
    });
  },
);

/* MEMBER ADD */

export const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationInvitation.accepted" }],
  },
  async ({ event }) => {
    const data = event.data;

    await prisma.workspaceMember.create({
      data: {
        userId: data.user_id,
        workspaceId: data.organization_id,
        role: String(data.role_name),
      },
    });
  },
);

export const functions = [
  SyncUserCreation,
  SyncUserUpdate,
  SyncUserDeletion,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
];

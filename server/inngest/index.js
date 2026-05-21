import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

// Inngest client
export const inngest = new Inngest({ id: "project-management" });

/* =========================
   CREATE USER
========================= */
const SyncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event }) => {
    const data = event.data;

    try {
      console.log("[inngest] clerk/user.created:", data);

      const existingUser = await prisma.user.findUnique({
        where: { id: data.id },
      });

      if (existingUser) {
        console.log("[inngest] user already exists:", data.id);
        return;
      }

      const user = await prisma.user.create({
        data: {
          id: data.id,
          email: data.email_addresses?.[0]?.email_address ?? "",
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          image: data.image_url ?? "",
        },
      });

      console.log("[inngest] user created:", user);
    } catch (error) {
      console.error("[inngest] create user error:", error);
      throw error;
    }
  },
);

/* =========================
   DELETE USER
========================= */
const SyncUserDeletion = inngest.createFunction(
  {
    id: "sync-user-deletion",
    triggers: [{ event: "clerk/user.deleted" }],
  },
  async ({ event }) => {
    const data = event.data;

    try {
      console.log("[inngest] clerk/user.deleted:", data.id);

      await prisma.user.delete({
        where: { id: data.id },
      });

      console.log("[inngest] user deleted:", data.id);
    } catch (error) {
      console.error("[inngest] delete error:", error);
      throw error;
    }
  },
);

/* =========================
   UPDATE USER
========================= */
const SyncUserUpdate = inngest.createFunction(
  {
    id: "sync-user-update",
    triggers: [{ event: "clerk/user.updated" }],
  },
  async ({ event }) => {
    const data = event.data;

    try {
      console.log("[inngest] clerk/user.updated:", data);

      await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data.email_addresses?.[0]?.email_address ?? "",
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          image: data.image_url ?? "",
        },
      });

      console.log("[inngest] user updated:", data.id);
    } catch (error) {
      console.error("[inngest] update error:", error);
      throw error;
    }
  },
);
const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-creation",
  },
  { event: "clerk/workspace.created" },
  async ({ event }) => {
    const data = event;
    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });

    // add creator as admin member
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "admin",
      },
    });

  },
);
const syncWorkspaceUpdation = inngest.createFunction( 
  {
    id:"update-workspace-from-clerk",
  },
  {event:"clerk/organization.updated"},
  async ({event})=>{
    const data = event;
    await prisma.workspace.update({
      where:{
        id:data.id,
      },
      data:{
        name:data.name,
        slug:data.slug,
        image_url:data.image_url,
      },
    });
  },
  //inngest function to delete workspace from database
  const syncWorkspaceDeletion = inngest.createFunction(
    {
      id:"delete-workspace-from-clerk",},
      {event:"clerk/organization.deleted"},
      async ({event})=>{
        const data = event;
        await prisma.workspace.delete({
          where:{
            id:data.id,
          },
        });
      },
);

// inngest function to save workspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction( 
  {
    id:"sync-workspace-member-from-clerk",
  },
  {event:"clerk/organizationInvitations.accepted"},
  async ({event})=>{
    const data = event; 

    await prisma.workspaceMember.create({
      data:{
        userId:data.user_id,    
        workspaceId:data.organization_id,
        role:String(data.role_name),
      },
    });
  }
)
export const functions = [SyncUserCreation, SyncUserDeletion, SyncUserUpdate, syncWorkspaceCreation, syncWorkspaceUpdation, syncWorkspaceDeletion,syncWorkspaceMemberCreation];

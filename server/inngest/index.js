import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

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

    await prisma.$transaction(async (tx) => {
      await tx.workspace.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
        update: {
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });

      await tx.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId: data.created_by,
            workspaceId: data.id,
          },
        },
        create: {
          userId: data.created_by,
          workspaceId: data.id,
          role: "ADMIN",
        },
        update: {
          role: "ADMIN",
        },
      });
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
    const role = String(data.role_name || "MEMBER").toUpperCase();

    // The organization_id from Clerk is the workspace ID (since workspace.id = clerk org ID)
    const workspaceId = data.organization_id;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      console.log(`Workspace not found for workspace ID: ${workspaceId}`);
      return;
    }

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: data.user_id,
          workspaceId: workspaceId,
        },
      },
      create: {
        userId: data.user_id,
        workspaceId: workspaceId,
        role: role === "ADMIN" ? "ADMIN" : "MEMBER",
      },
      update: {
        role: role === "ADMIN" ? "ADMIN" : "MEMBER",
      },
    });
  },
);

// Inngest function to send email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-task-assignment-email",
    triggers: [
      {
        event: "app/task.assigned",
      },
    ],
  },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        project: true,
      },
    });

    await sendEmail({
      to: task.assignee.email,
      subject: `New Task Assigned: ${task.project.name}`,
      body: `
        Hi ${task.assignee.name}, <br/><br/>
        You have been assigned a new task: <b>${task.title}</b><br/>
        Due Date: ${new Date(task.due_date).toLocaleDateString()}<br/><br/>
        <a href="${origin}">View Task</a>
      `,
    });
    if (
      new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()
    ) {
      await step.sleepUntil("wait-for-the-due-date", new Date(task.due_date));
      await step.run("check-if-task-is-complete", async () => {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true },
        });
        if (!task) return;

        if (task.status !== "COMPLETED") {
          await step.run("send-task-reminder-email", async () => {
            await sendEmail({
              to: task.assignee.email,
              subject: `Reminder: Task "${task.project.name}" is due today!`,
              body: `Hi ${task.assignee.name}, <br/><br/>
        You have been assigned a new task: <b>${task.title}</b><br/>
        Due Date: ${new Date(task.due_date).toLocaleDateString()}<br/><br/>
        <a href="${origin}">View Task</a>`,
            });
          });
        }
      });
    }
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
  sendTaskAssignmentEmail,
];

import prisma from "../configs/prisma.js";
// create project

export const createProject = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const {
      workspaceId,
      description,
      name,
      status,
      start_date,
      end_date,
      team_members,
      team_lead,
      progress,
      priority,
    } = req.body;
    // check if user has admin role for workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const isWorkspaceOwner = workspace.ownerId === userId;
    const isWorkspaceAdmin = workspace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN",
    );

    if (!isWorkspaceOwner && !isWorkspaceAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace admins can create projects",
      });
    }

    if (isWorkspaceOwner && !isWorkspaceAdmin) {
      await prisma.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
        create: {
          userId,
          workspaceId,
          role: "ADMIN",
        },
        update: {
          role: "ADMIN",
        },
      });
    }
    // get team lead using email

    const teamLead = await prisma.user.findUnique({
      where: { email: team_lead },
      select: { id: true },
    });

    if (!teamLead) {
      return res.status(404).json({ message: "Project lead not found" });
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        description,
        name,
        status,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        team_lead: teamLead?.id,
        progress,
        priority,
      },
    });
    // add members to  the project if they are in the workspace
    const memberEmails = Array.isArray(team_members) ? team_members : [];
    const membersToAdd = workspace.members
      .filter((member) => memberEmails.includes(member.user.email))
      .map((member) => member.user.id);

    if (membersToAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: membersToAdd.map((memberId) => ({
          projectId: project.id,
          userId: memberId,
        })),
        skipDuplicates: true,
      });
    }

    const projectWithMembers = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        members: { include: { user: true } },
        tasks: {
          include: { assignee: true, comments: { include: { user: true } } },
        },
        owner: true,
      },
    });

    res.json({
      project: projectWithMembers,
      message: "Project created successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

//Update project
export const updateProject = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const {
      id,
      workspaceId,
      description,
      name,
      status,
      start_date,
      end_date,
      team_members,
      progress,
      priority,
    } = req.body;

    // check if user has admin role for workspace

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    const isWorkspaceOwner = workspace.ownerId === userId;
    const isWorkspaceAdmin = workspace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN",
    );

    if (!isWorkspaceOwner && !isWorkspaceAdmin) {
      const project = await prisma.project.findUnique({
        where: { id },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      } else if (project.team_lead !== userId) {
        return res
          .status(403)
          .json({
            message: " you don't have permission to update this project",
          });
      }
    }
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        workspaceId,
        description,
        name,
        status,
        priority,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    });
    res.json({ message: "Project updated successfully", project: updatedProject });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

//add member to project
export const addMemberToProject = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { projectId } = req.params;
    const { email } = req.body;

    // check if user is project lead
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.team_lead !== userId) {
      return res
        .status(403)
        .json({ message: " Only project lead can add members" });
    }
    const existingMember = project.members.find(
      (member) => member.user.email === email,
    );
    if (existingMember) {
      return res
        .status(400)
        .json({ message: "User is already a member of the project" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const member = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId,
      },
    });
    res.json({ message: "Member added to project successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

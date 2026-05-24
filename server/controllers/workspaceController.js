import prisma from "../configs/prisma.js";

// =========================
// Get all workspaces for logged-in user
// =========================
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();

    const ownedWorkspacesWithoutMembership = await prisma.workspace.findMany({
      where: {
        ownerId: userId,
        members: {
          none: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (ownedWorkspacesWithoutMembership.length > 0) {
      await prisma.workspaceMember.createMany({
        data: ownedWorkspacesWithoutMembership.map((workspace) => ({
          userId,
          workspaceId: workspace.id,
          role: "ADMIN",
        })),
        skipDuplicates: true,
      });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId,
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

    res.json({ workspaces });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

// =========================
// Add member to workspace
// =========================
export const addmember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    // Validate required fields
    if (!email || !workspaceId || !role) {
      return res.status(400).json({
        message: "Email, workspace ID, and role are required",
      });
    }

    // Validate role (must match Prisma enum)
    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res.status(400).json({
        message: "Role must be either ADMIN or MEMBER",
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Fetch workspace with members
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        members: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    // Check if requester is admin
    const isAdmin = workspace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN",
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admins can add members",
      });
    }

    // Check if user already exists in workspace
    const existingMember = workspace.members.find(
      (member) => member.userId === user.id,
    );

    if (existingMember) {
      return res.status(400).json({
        message: "User is already a member of this workspace",
      });
    }

    // Create new workspace member
    const member = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
        message,
      },
    });

    res.json({
      message: "Member added successfully",
      member,
    });
  } catch (error) {
    console.error("Error adding member:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

import prisma from "../configs/prisma.js";

// =========================
// Get all workspaces for logged-in user
// =========================
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();

    try {
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
    } catch (membershipRepairError) {
      console.error("Workspace membership repair skipped:", membershipRepairError);
    }

    let workspaces;
    try {
      workspaces = await prisma.workspace.findMany({
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
    } catch (queryError) {
      console.error(
        "Workspace detailed query failed, retrying with lean query:",
        queryError,
      );
      try {
        workspaces = await prisma.workspace.findMany({
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
            owner: true,
          },
        });
      } catch (leanQueryError) {
        console.error("Workspace lean query failed, retrying with raw query:", leanQueryError);
        const rows = await prisma.$queryRaw`
          SELECT w.id, w.name
          FROM "Workspace" w
          INNER JOIN "WorkspaceMember" wm ON wm."workspaceId" = w.id
          WHERE wm."userId" = ${userId}
        `;

        workspaces = rows.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.id,
          image_url: "",
          projects: [],
          members: [],
          owner: {
            id: userId,
            email: "",
            name: "",
            image: "",
          },
        }));
      }
    }

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

// Sync workspaces sent from client (useful for local dev where webhooks can't reach localhost)
export const syncWorkspacesFromClient = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { organizations, user } = req.body;

    if (!Array.isArray(organizations) || organizations.length === 0) {
      return res.status(400).json({ message: "organizations array required" });
    }

    await prisma.$transaction(async (tx) => {
      const userEmail = user?.email || `${userId}@clerk.local`;
      const userName = user?.name || userEmail;
      const userImage = user?.image || "";

      await tx.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: userEmail,
          name: userName,
          image: userImage,
        },
        update: {
          ...(user?.email ? { email: user.email } : {}),
          ...(user?.name ? { name: user.name } : {}),
          ...(user?.image ? { image: user.image } : {}),
        },
      });

      for (const org of organizations) {
        const id = org.id || org.organization_id || org.node_id;
        const name = org.name || org.organization_name || org.title || "";
        const slug =
          org.slug || org.name?.toLowerCase().replace(/\s+/g, "-") || id;
        const ownerId = userId;
        const image_url = org.image_url || org.imageUrl || "";

        if (!id) continue;

        await tx.workspace.upsert({
          where: { id },
          create: {
            id,
            name,
            slug,
            ownerId,
            image_url,
          },
          update: {
            name,
            slug,
            ownerId,
            image_url,
          },
        });

        await tx.workspaceMember.upsert({
          where: {
            userId_workspaceId: {
              userId: ownerId,
              workspaceId: id,
            },
          },
          create: {
            userId: ownerId,
            workspaceId: id,
            role: "ADMIN",
          },
          update: {
            role: "ADMIN",
          },
        });
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error syncing workspaces from client:", error);
    return res.status(500).json({ message: error.message });
  }
};

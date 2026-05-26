import prisma from "../configs/prisma.js";

// Add comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskId, content } = req.body;

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Check if project exists and get members
    const project = await prisma.project.findUnique({
      where: {
        id: task.projectId,
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Check if user is a member of the project
    const member = project.members.find((member) => member.userId === userId);

    if (!member) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        taskId,
        content,
        userId,
      },
      include: {
        user: true,
      },
    });

    return res.json({
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("ADD COMMENT ERROR:", error);

    return res.status(500).json({
      message: error.message || error.code,
    });
  }
};

// Get comments for a task
export const getCommentsForTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const comments = await prisma.comment.findMany({
      where: {
        taskId,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      comments,
    });
  } catch (error) {
    console.error("GET COMMENTS ERROR:", error);

    return res.status(500).json({
      message: error.message || error.code,
    });
  }
};

import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";
// create Task
export const createTask = async (req, res) => {
  try {
    // Clerk auth
    console.log(req.body);
    const { userId } = await req.auth();

    const {
      projectId,
      title,
      description,
      status,
      priority,
      type,
      assigneeId,
      due_date,
    } = req.body;
    const origin = req.get("origin");

    // Find project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    // Project not found
    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Check if user is team lead or project member
    const isTeamLead = project.team_lead === userId;
    const isProjectMember = project.members.some(
      (member) => member.userId === userId,
    );

    if (!isTeamLead && !isProjectMember) {
      return res.status(403).json({
        message: "You don't have privileges for this project",
      });
    }

    // Validate assignee
    if (
      assigneeId &&
      !project.members.some((member) => member.userId === assigneeId)
    ) {
      return res.status(400).json({
        message: "Assignee is not a member of the project/workspace",
      });
    }

    // Create task
    const taskData = {
      projectId,
      title,
      description,
      status,
      priority,
      type,
      assigneeId,
      due_date: new Date(due_date),
    };

    if (assigneeId) {
      taskData.assigneeId = assigneeId;
    }

    if (due_date) {
      taskData.due_date = new Date(due_date);
    }

    const task = await prisma.task.create({
      data: taskData,
    });

    // Get task with assignee
    const taskWithAssignee = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: true,
      },
    });

    // Trigger email/event
    await inngest.send({
      name: "app/task.assigned",
      data: {
        taskId: task.id,
        origin,
      },
    });

    return res.json({
      message: "Task created successfully",
      task: taskWithAssignee,
    });
  } catch (error) {
    console.error("CREATE TASK ERROR:", error);

    return res.status(500).json({
      message: "Error creating task",
      error: error.message,
    });
  }
};

//  update Task
export const updateTask = async (req, res) => {
  try {
    const { userId } = await req.auth();

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({
        message: " you don't have admin privilieges for this project",
      });
    }
    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating task", error });
  }
};

// Delete Task
export const deleteTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskIds } = req.body;
    const task = await prisma.task.findMany({
      where: { id: { in: taskIds } },
    });
    if (task.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: task[0].projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({
        message: " you don't have admin privilieges for this project",
      });
    }
    await prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting task", error });
  }
};

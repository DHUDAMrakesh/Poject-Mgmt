import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";
// create Task
export const createTask = async (req, res) => {
  try {
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

    // check if user  has admin role for project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res
        .status(403)
        .json({ message: " you don't have privilieges for this project" });
    } else if (
      assigneeId &&
      !project.members.find((member) => member.userId === assigneeId)
    ) {
      return res
        .status(400)
        .json({ message: "Assignee is not a member of the project/workspace" });
    }
    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        status,
        priority,
        assigneeId,
        due_date: new Date(due_date),
      },
    });
    const taskWithAssignee = await prisma.task.findUnique({
      where: { id: task.id },
      include: { assignee: true },
    });
    await inngest.send({
      name: "app/task.assigned",
      data: {
        taskId: task.id,
        origin,
      },
    });

    res.json({ message: "Task created successfully", task: taskWithAssignee });
  } catch (error) {
    res.status(500).json({ message: "Error creating task", error });
  }
};

//  update Task
export const updateTask = async (req, res) => {
  try {
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
      task: updatedTask,
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating task", error });
  }
};

// Delete Task
export const deleteTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskId } = req.body;
    const task = await prisma.task.findMany({
      where: { id: { in: taskId } },
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
    res.status(500).json({ message: "Error creating task", error });
  }
};

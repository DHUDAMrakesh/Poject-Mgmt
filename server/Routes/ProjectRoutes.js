import express from "express";
import {
  createProject,
  updateProject,
  addMemberToProject,
} from "../controllers/projectController.js";

const ProjectRouter = express.Router();
ProjectRouter.post("/", createProject);
ProjectRouter.put("/", updateProject);
ProjectRouter.post("/:projectId/members", addMemberToProject);
export default ProjectRouter;

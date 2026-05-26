import express from "express";
import {
  addmember,
  getUserWorkspaces,
  syncWorkspacesFromClient,
} from "../controllers/workspaceController.js";
const workspaceRouter = express.Router();
workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/add-member", addmember);
workspaceRouter.post("/sync", syncWorkspacesFromClient);
export default workspaceRouter;

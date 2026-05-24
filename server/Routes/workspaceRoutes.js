import express from "express";
import {
  addmember,
  getUserWorkspaces,
} from "../controllers/workspaceController.js";
const workspaceRouter = express.Router();
workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/add-member", addmember);
export default workspaceRouter;

import express from "express";
import {
  addComment,
  getCommentsForTask,
} from "../controllers/commentController.js";

const commentRouter = express.Router();
commentRouter.post("/", addComment);
commentRouter.get("/taskId", getCommentsForTask);
export default commentRouter;

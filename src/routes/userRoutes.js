import express from "express"
import { getUsers, createUser, editUser, deleteUser } from "../controllers/userController.js"

const router = express.Router();

router.get("/", getUsers);
router.post("/", createUser)
router.put("/:id", editUser)
router.delete("/:id", deleteUser)

export default router;

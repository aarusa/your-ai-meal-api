import express from "express";
import { getPantry, addPantryItem, updatePantryItem, removePantryItem, clearPantry } from "../controllers/pantryController.js";

const router = express.Router();

router.get("/", getPantry);
router.post("/", addPantryItem);
router.put("/", updatePantryItem);
router.delete("/", removePantryItem);
router.delete("/clear", clearPantry);

export default router;



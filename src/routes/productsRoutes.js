import express from "express";
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from "../controllers/productsController.js";

const router = express.Router();

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;



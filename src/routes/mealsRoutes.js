import express from "express";
import { 
  getUserMeals, 
  getMeal, 
  updateMealStatus, 
  deleteMeal,
  getMealStats,
  getMealCategories,
  searchMeals,
  getRecentMeals
} from "../controllers/mealsController.js";

const router = express.Router();

// Main meal endpoints
router.get("/", getUserMeals);                    // GET /api/meals?userId=xxx&status=xxx&mealType=xxx
router.get("/recent", getRecentMeals);            // GET /api/meals/recent?userId=xxx&limit=5
router.get("/search", searchMeals);               // GET /api/meals/search?userId=xxx&query=chicken&limit=20
router.get("/stats", getMealStats);               // GET /api/meals/stats?userId=xxx
router.get("/categories", getMealCategories);     // GET /api/meals/categories?userId=xxx
router.get("/:mealId", getMeal);                  // GET /api/meals/:mealId

// Meal actions
router.put("/:mealId/status", updateMealStatus);  // PUT /api/meals/:mealId/status
router.delete("/:mealId", deleteMeal);            // DELETE /api/meals/:mealId

export default router;

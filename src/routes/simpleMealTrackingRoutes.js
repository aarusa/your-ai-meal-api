import express from "express";
import { 
  createMealLog, 
  listMealLogs, 
  showMealLog, 
  updateMealLog, 
  deleteMealLog,
  getMealStats,
  // Legacy methods for backward compatibility
  logMeal, 
  getMealLogs 
} from "../controllers/simpleMealTrackingController.js";

const router = express.Router();

// CRUD Routes (RESTful API)
router.post("/", createMealLog);           // CREATE
router.get("/", listMealLogs);             // READ (list all)
router.get("/:id", showMealLog);           // READ (show one)
router.put("/:id", updateMealLog);         // UPDATE
router.delete("/:id", deleteMealLog);      // DELETE

// Additional routes
router.get("/stats/overview", getMealStats); // Statistics

// Legacy routes (for backward compatibility)
router.post("/log", logMeal);
router.get("/logs", getMealLogs);

// Health check
router.get("/health", (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Simple meal tracking service is running',
    endpoints: [
      'POST / - Create meal log',
      'GET / - List meal logs (with filters)',
      'GET /:id - Get specific meal log',
      'PUT /:id - Update meal log',
      'DELETE /:id - Delete meal log',
      'GET /stats/overview - Get meal statistics',
      'POST /log - Legacy create (backward compatibility)',
      'GET /logs - Legacy list (backward compatibility)'
    ]
  });
});

export default router;

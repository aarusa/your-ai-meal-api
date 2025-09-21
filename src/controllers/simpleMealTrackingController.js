import supabase from "../database/supabaseClient.js";

// Helper function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// CREATE - Log a new meal
export async function createMealLog(req, res) {
  try {
    const { mealId, mealName, mealType, calories } = req.body;
    const { userId } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (!mealName || !mealType) {
      return res.status(400).json({ error: "mealName and mealType are required" });
    }

    // Validate meal type
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealType.toLowerCase())) {
      return res.status(400).json({ 
        error: "Invalid meal type. Must be one of: breakfast, lunch, dinner, snack" 
      });
    }

    // Validate mealId if provided
    if (mealId && !isValidUUID(mealId)) {
      console.warn("Invalid mealId provided, treating as null:", mealId);
      mealId = null;
    }

    // Create meal log
    const { data: mealLog, error } = await supabase
      .from("meal_tracking")
      .insert({
        user_id: userId,
        meal_id: mealId || null,
        meal_name: mealName,
        meal_type: mealType.toLowerCase(),
        calories: calories || null
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating meal log:", error);
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.status(500).json({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      });
    }

    res.status(201).json({
      message: "Meal logged successfully",
      data: mealLog
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// READ - Get all meal logs for a user (with pagination and filtering)
export async function listMealLogs(req, res) {
  try {
    const { userId } = req.query;
    const { 
      limit = 50, 
      offset = 0, 
      mealType, 
      startDate, 
      endDate,
      search 
    } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Build query
    let query = supabase
      .from("meal_tracking")
      .select("*", { count: 'exact' })
      .eq("user_id", userId);

    // Apply filters
    if (mealType) {
      query = query.eq("meal_type", mealType.toLowerCase());
    }

    if (startDate) {
      query = query.gte("logged_at", startDate);
    }

    if (endDate) {
      query = query.lte("logged_at", endDate);
    }

    if (search) {
      query = query.ilike("meal_name", `%${search}%`);
    }

    // Apply pagination and ordering
    const { data: mealLogs, error, count } = await query
      .order("logged_at", { ascending: false })
      .range(offset, parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error("Error fetching meal logs:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      data: mealLogs || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (count || 0) > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// READ - Get a specific meal log by ID
export async function showMealLog(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const { data: mealLog, error } = await supabase
      .from("meal_tracking")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: "Meal log not found" });
      }
      console.error("Error fetching meal log:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      data: mealLog
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// UPDATE - Update an existing meal log
export async function updateMealLog(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    const { mealName, mealType, calories, mealId } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (mealName !== undefined) updateData.meal_name = mealName;
    if (mealType !== undefined) {
      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      if (!validMealTypes.includes(mealType.toLowerCase())) {
        return res.status(400).json({ 
          error: "Invalid meal type. Must be one of: breakfast, lunch, dinner, snack" 
        });
      }
      updateData.meal_type = mealType.toLowerCase();
    }
    if (calories !== undefined) updateData.calories = calories;
    if (mealId !== undefined) {
      if (mealId && !isValidUUID(mealId)) {
        console.warn("Invalid mealId provided in update, treating as null:", mealId);
        updateData.meal_id = null;
      } else {
        updateData.meal_id = mealId;
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    const { data: mealLog, error } = await supabase
      .from("meal_tracking")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: "Meal log not found" });
      }
      console.error("Error updating meal log:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: "Meal log updated successfully",
      data: mealLog
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// DELETE - Delete a meal log
export async function deleteMealLog(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const { data: deletedMealLog, error } = await supabase
      .from("meal_tracking")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: "Meal log not found" });
      }
      console.error("Error deleting meal log:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: "Meal log deleted successfully",
      data: deletedMealLog
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// GET - Get meal tracking statistics
export async function getMealStats(req, res) {
  try {
    const { userId } = req.query;
    const { days = 30 } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get total meals logged
    const { count: totalMeals, error: totalError } = await supabase
      .from("meal_tracking")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .gte("logged_at", startDate.toISOString());

    // Get meals by type
    const { data: mealTypes, error: typesError } = await supabase
      .from("meal_tracking")
      .select("meal_type")
      .eq("user_id", userId)
      .gte("logged_at", startDate.toISOString());

    // Get total calories
    const { data: calories, error: caloriesError } = await supabase
      .from("meal_tracking")
      .select("calories")
      .eq("user_id", userId)
      .gte("logged_at", startDate.toISOString())
      .not("calories", "is", null);

    if (totalError || typesError || caloriesError) {
      console.error("Error fetching stats:", { totalError, typesError, caloriesError });
      return res.status(500).json({ error: "Failed to fetch meal statistics" });
    }

    // Process meal types
    const typeCount = {};
    mealTypes?.forEach(meal => {
      typeCount[meal.meal_type] = (typeCount[meal.meal_type] || 0) + 1;
    });

    // Calculate total calories
    const totalCalories = calories?.reduce((sum, meal) => sum + (meal.calories || 0), 0) || 0;

    res.json({
      data: {
        period: {
          days: parseInt(days),
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        totalMeals: totalMeals || 0,
        totalCalories,
        averageCaloriesPerMeal: totalMeals > 0 ? Math.round(totalCalories / totalMeals) : 0,
        mealsByType: typeCount
      }
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
}

// Legacy method for backward compatibility
export async function logMeal(req, res) {
  return createMealLog(req, res);
}

export async function getMealLogs(req, res) {
  return listMealLogs(req, res);
}

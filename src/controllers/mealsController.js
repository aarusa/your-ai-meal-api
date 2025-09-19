import supabase from "../database/supabaseClient.js";

// Get AI generated meals for a user with filtering and pagination
export async function getUserMeals(req, res) {
  try {
    const { userId, status, mealType, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    if (!userId) return res.status(400).json({ error: "userId is required" });

    let query = supabase
      .from("ai_generated_meals")
      .select(`
        *,
        meal_ingredients_ai (
          *,
          product:products (*),
          pantry_item:user_pantry_items (*)
        )
      `)
      .eq("user_id", userId);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (mealType) {
      query = query.eq("meal_type", mealType);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: meals, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("ai_generated_meals")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    if (countError) throw countError;

    res.json({
      meals: meals || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < (count || 0)
    });
  } catch (err) {
    console.error("Error fetching user meals:", err);
    res.status(500).json({ error: err.message });
  }
}

// Get a specific meal by ID
export async function getMeal(req, res) {
  try {
    const { mealId } = req.params;
    if (!mealId) return res.status(400).json({ error: "mealId is required" });

    const { data: meal, error } = await supabase
      .from("ai_generated_meals")
      .select(`
        *,
        meal_ingredients_ai (
          *,
          product:products (*),
          pantry_item:user_pantry_items (*)
        )
      `)
      .eq("id", mealId)
      .single();

    if (error) throw error;
    if (!meal) return res.status(404).json({ error: "Meal not found" });

    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Store AI generated meal in database (Type 1 - Pantry based)
export async function storeGeneratedMeal(mealData, userId) {
  try {
    const isValidUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    // Insert the main meal
    const { data: meal, error: mealError } = await supabase
      .from("ai_generated_meals")
      .insert({
        user_id: userId,
        name: mealData.name,
        description: mealData.description,
        meal_type: mealData.category.toLowerCase(),
        total_calories: mealData.nutrition.calories,
        total_protein: mealData.nutrition.protein,
        total_carbs: mealData.nutrition.carbs,
        total_fats: mealData.nutrition.fat,
        prep_time_minutes: mealData.prepTime,
        cook_time_minutes: mealData.cookTime,
        total_time_minutes: mealData.prepTime + mealData.cookTime,
        difficulty_level: mealData.difficulty.toLowerCase(),
        servings: mealData.servings,
        generation_type: 'pantry_based',
        generation_criteria: {
          // Store AI ingredients directly alongside instructions so frontend can render them
          ingredients: mealData.ingredients,
          instructions: mealData.instructions,
          tags: mealData.tags
        },
        ai_model_version: 'gemini-1.5-flash',
        status: 'generated'
      })
      .select()
      .single();

    if (mealError) throw mealError;

    // Per updated requirement: Do not create separate ingredient rows.
    // Ingredients are stored inside generation_criteria above and displayed directly.

    return meal;
  } catch (err) {
    console.error("Error storing generated meal:", err);
    throw err;
  }
}

// Store AI generated meal in database (Type 2 - Parameter based)
export async function storeType2GeneratedMeal(mealData, userId, generationCriteria) {
  try {
    // Insert the main meal
    const { data: meal, error: mealError } = await supabase
      .from("ai_generated_meals")
      .insert({
        user_id: userId,
        name: mealData.name,
        description: mealData.description,
        meal_type: mealData.category.toLowerCase(),
        total_calories: mealData.nutrition.calories,
        total_protein: mealData.nutrition.protein,
        total_carbs: mealData.nutrition.carbs,
        total_fats: mealData.nutrition.fat,
        prep_time_minutes: mealData.prepTime,
        cook_time_minutes: mealData.cookTime,
        total_time_minutes: mealData.prepTime + mealData.cookTime,
        difficulty_level: mealData.difficulty.toLowerCase(),
        servings: mealData.servings,
        generation_type: 'parameter_based',
        generation_criteria: {
          // Store AI ingredients directly alongside instructions so frontend can render them
          ingredients: mealData.ingredients,
          instructions: mealData.instructions,
          tags: mealData.tags,
          // Store the original generation parameters for Type 2
          parameters: generationCriteria
        },
        ai_model_version: 'deepseek-chat',
        status: 'generated'
      })
      .select()
      .single();

    if (mealError) throw mealError;

    return meal;
  } catch (err) {
    console.error("Error storing Type 2 generated meal:", err);
    throw err;
  }
}

// Update meal status (when user accepts/rejects)
export async function updateMealStatus(req, res) {
  try {
    const { mealId } = req.params;
    const { status, rating, feedback, isFavorited } = req.body;

    if (!mealId) return res.status(400).json({ error: "mealId is required" });
    if (!status) return res.status(400).json({ error: "status is required" });

    const updateData = { status };
    if (rating !== undefined) updateData.user_rating = rating;
    if (feedback !== undefined) updateData.user_feedback = feedback;
    if (isFavorited !== undefined) updateData.is_favorited = isFavorited;
    if (status === 'accepted') updateData.is_rated = true;

    const { data: meal, error } = await supabase
      .from("ai_generated_meals")
      .update(updateData)
      .eq("id", mealId)
      .select()
      .single();

    if (error) throw error;
    if (!meal) return res.status(404).json({ error: "Meal not found" });

    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete a meal
export async function deleteMeal(req, res) {
  try {
    const { mealId } = req.params;
    if (!mealId) return res.status(400).json({ error: "mealId is required" });

    // Delete meal ingredients first (foreign key constraint)
    const { error: ingredientsError } = await supabase
      .from("meal_ingredients_ai")
      .delete()
      .eq("meal_id", mealId);

    if (ingredientsError) throw ingredientsError;

    // Delete the meal
    const { error: mealError } = await supabase
      .from("ai_generated_meals")
      .delete()
      .eq("id", mealId);

    if (mealError) throw mealError;

    res.json({ message: "Meal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get meal statistics for a user
export async function getMealStats(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Get basic counts
    const { count: totalMeals, error: totalError } = await supabase
      .from("ai_generated_meals")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    if (totalError) throw totalError;

    // Get status counts
    const { count: acceptedMeals, error: acceptedError } = await supabase
      .from("ai_generated_meals")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (acceptedError) throw acceptedError;

    // Get favorite meals count
    const { count: favoriteMeals, error: favoriteError } = await supabase
      .from("ai_generated_meals")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("is_favorited", true);

    if (favoriteError) throw favoriteError;

    // Get recent meals (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: recentMeals, error: recentError } = await supabase
      .from("ai_generated_meals")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString());

    if (recentError) throw recentError;

    res.json({
      totalMeals: totalMeals || 0,
      acceptedMeals: acceptedMeals || 0,
      favoriteMeals: favoriteMeals || 0,
      recentMeals: recentMeals || 0,
      acceptanceRate: totalMeals > 0 ? ((acceptedMeals || 0) / totalMeals * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error("Error fetching meal stats:", err);
    res.status(500).json({ error: err.message });
  }
}

// Get meal categories and types
export async function getMealCategories(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Get unique meal types and their counts
    const { data: mealTypes, error } = await supabase
      .from("ai_generated_meals")
      .select("meal_type")
      .eq("user_id", userId);

    if (error) throw error;

    // Count occurrences of each meal type
    const typeCounts = {};
    mealTypes?.forEach(meal => {
      typeCounts[meal.meal_type] = (typeCounts[meal.meal_type] || 0) + 1;
    });

    // Get difficulty distribution
    const { data: difficulties, error: diffError } = await supabase
      .from("ai_generated_meals")
      .select("difficulty_level")
      .eq("user_id", userId);

    if (diffError) throw diffError;

    const difficultyCounts = {};
    difficulties?.forEach(meal => {
      difficultyCounts[meal.difficulty_level] = (difficultyCounts[meal.difficulty_level] || 0) + 1;
    });

    res.json({
      mealTypes: typeCounts,
      difficulties: difficultyCounts,
      totalCategories: Object.keys(typeCounts).length
    });
  } catch (err) {
    console.error("Error fetching meal categories:", err);
    res.status(500).json({ error: err.message });
  }
}

// Search meals
export async function searchMeals(req, res) {
  try {
    const { userId, query: searchQuery, limit = 20, offset = 0 } = req.query;
    
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!searchQuery) return res.status(400).json({ error: "search query is required" });

    const { data: meals, error } = await supabase
      .from("ai_generated_meals")
      .select(`
        *,
        meal_ingredients_ai (
          *,
          product:products (*)
        )
      `)
      .eq("user_id", userId)
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      meals: meals || [],
      query: searchQuery,
      total: meals?.length || 0
    });
  } catch (err) {
    console.error("Error searching meals:", err);
    res.status(500).json({ error: err.message });
  }
}

// Get recent meals (for dashboard)
export async function getRecentMeals(req, res) {
  try {
    const { userId, limit = 5 } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { data: meals, error } = await supabase
      .from("ai_generated_meals")
      .select(`
        id,
        name,
        description,
        meal_type,
        total_calories,
        total_protein,
        prep_time_minutes,
        cook_time_minutes,
        difficulty_level,
        servings,
        status,
        created_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json(meals || []);
  } catch (err) {
    console.error("Error fetching recent meals:", err);
    res.status(500).json({ error: err.message });
  }
}

import express from "express";
// Switched to OpenRouter (DeepSeek) for AI generation
import supabase from "../database/supabaseClient.js";
import { storeGeneratedMeal, storeType2GeneratedMeal } from "../controllers/mealsController.js";

const router = express.Router();

// Helper to fetch user preferences from Supabase
async function fetchUserPreferences(userId) {
  if (!userId) return { dietary: [], allergies: [], cuisines: [] };

  const [dietaryRes, allergyRes, cuisineRes] = await Promise.all([
    supabase.from("user_dietary_preferences").select("preference_id").eq("user_id", userId),
    supabase.from("user_allergies").select("allergy_id").eq("user_id", userId),
    supabase.from("user_cuisine_preferences").select("cuisine_id").eq("user_id", userId),
  ]);

  const dietary = (dietaryRes.data || []).map((r) => r.preference_id);
  const allergies = (allergyRes.data || []).map((r) => r.allergy_id);
  const cuisines = (cuisineRes.data || []).map((r) => r.cuisine_id);

  // Resolve option names for readability in prompt
  const [dietaryNames, allergyNames, cuisineNames] = await Promise.all([
    dietary.length
      ? supabase.from("dietary_preferences").select("id,name").in("id", dietary)
      : Promise.resolve({ data: [] }),
    allergies.length
      ? supabase.from("allergies").select("id,name").in("id", allergies)
      : Promise.resolve({ data: [] }),
    cuisines.length
      ? supabase.from("cuisines").select("id,name").in("id", cuisines)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    dietary: (dietaryNames.data || []).map((d) => d.name),
    allergies: (allergyNames.data || []).map((a) => a.name),
    cuisines: (cuisineNames.data || []).map((c) => c.name),
  };
}

// Helper: generate food image from local folder
function generateLocalFoodImage(recipeName, category) {
  try {
    // Map categories to image folders
    const categoryMap = {
      'breakfast': 'breakfast',
      'lunch': 'lunch', 
      'snack': 'snack',
      'dinner': 'dinner',
      'dessert': 'snack' // fallback to snack for dessert
    };
    
    const imageFolder = categoryMap[category?.toLowerCase()] || 'general';
    
    // Create a seed based on recipe name for consistency
    const seed = recipeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // For now, we'll use a simple approach - you can expand this later
    // with actual image file listing from the folder
    const imageNumber = (seed % 9) + 1; // Only 9 images per category available
    
    const imagePath = `/food-images/${imageFolder}/food-${imageNumber}.jpg`;
    
    return {
      image_url: imagePath,
      thumbnail_url: imagePath,
      alt_text: `Image of ${recipeName}`,
      photographer: null,
      photographer_url: null
    };
  } catch (error) {
    console.warn('Error generating local food image:', error);
    return {
      image_url: "/placeholder.svg",
      thumbnail_url: "/placeholder.svg", 
      alt_text: `Image of ${recipeName}`,
      photographer: null,
      photographer_url: null
    };
  }
}

// Advanced helper: scan image directory and return random image
// This can be used when you have actual image files in the folder
function generateRandomLocalFoodImage(recipeName, category) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Map categories to image folders
    const categoryMap = {
      'breakfast': 'breakfast',
      'lunch': 'lunch', 
      'snack': 'snack',
      'dinner': 'dinner',
      'dessert': 'snack'
    };
    
    const imageFolder = categoryMap[category?.toLowerCase()] || 'general';
    const publicPath = path.join(process.cwd(), 'your-ai-meals', 'public', 'food-images', imageFolder);
    
    console.log(`Looking for images in: ${publicPath}`);
    console.log(`Category: ${category}, Mapped to folder: ${imageFolder}`);
    
    // Check if directory exists
    if (!fs.existsSync(publicPath)) {
      console.warn(`Image directory not found: ${publicPath}`);
      return generateLocalFoodImage(recipeName, category); // fallback to simple method
    }
    
    // Read all image files from the directory
    const files = fs.readdirSync(publicPath)
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .sort();
    
    console.log(`Found ${files.length} image files:`, files);
    
    if (files.length === 0) {
      console.warn(`No image files found in: ${publicPath}`);
      return generateLocalFoodImage(recipeName, category); // fallback to simple method
    }
    
    // Create a seed based on recipe name for consistency
    const seed = recipeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selectedFile = files[seed % files.length];
    
    const imagePath = `/food-images/${imageFolder}/${selectedFile}`;
    console.log(`Selected image: ${selectedFile} for recipe: ${recipeName}`);
    
    return {
      image_url: imagePath,
      thumbnail_url: imagePath,
      alt_text: `Image of ${recipeName}`,
      photographer: null,
      photographer_url: null
    };
  } catch (error) {
    console.warn('Error generating random local food image:', error);
    return generateLocalFoodImage(recipeName, category); // fallback to simple method
  }
}

// Helper: call OpenRouter (DeepSeek) chat completions
async function generateWithOpenRouter(prompt, temperature = 0.5, maxTokens = 1200) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const envModel = process.env.OPENROUTER_MODEL;
  const candidates = [
    envModel,
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-coder:free",
    "meta-llama/llama-3.1-8b-instruct:free",
  ].filter(Boolean);

  let lastErr = null;
  for (const model of candidates) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERRER || "http://localhost:3000/",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "YAM AI",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      lastErr = new Error(`OpenRouter error ${res.status} for model ${model}: ${errText}`);
      // Try next candidate on model errors
      if (res.status === 404 || res.status === 400) continue;
      throw lastErr;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    if (content) return content;
  }
  throw lastErr || new Error("OpenRouter: no content returned from candidates");
}

// POST /api/ai/recipes
// Body: { userId?: string, ingredients: Array<{ id: string, name?: string }>, servings?: number }
router.post("/recipes", async (req, res) => {
  try {
    const { userId, ingredients, servings = 2 } = req.body || {};
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "ingredients array required" });
    }

    const preferences = await fetchUserPreferences(userId);

    const ingredientList = ingredients
      .map((i) => (i.name ? `${i.name} (${i.id})` : i.id))
      .join(", ");

    const preferenceText = `Dietary: ${preferences.dietary.join(", ") || "none"}; Allergies: ${
      preferences.allergies.join(", ") || "none"
    }; Favorite cuisines: ${preferences.cuisines.join(", ") || "none"}`;

    const prompt = `You are an expert recipe generator. Create 3 recipe options that can be made primarily with the provided pantry ingredients. Strictly avoid any allergies and adhere to dietary preferences. Prefer favorite cuisines.

IMPORTANT: Return ONLY valid JSON in this exact format, no markdown, no code blocks, no explanations:

{
  "recipes": [
    {
      "id": "recipe-1",
      "name": "Recipe Name",
      "description": "Brief description",
      "category": "Breakfast/Lunch/Dinner/Snack",
      "prepTime": 10,
      "cookTime": 20,
      "servings": ${servings},
      "difficulty": "Easy",
      "ingredients": [
        {"name": "human ingredient name (e.g. lobster, arborio rice, parmesan)", "amount": 1, "unit": "cup"}
      ],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fat": 10},
      "tags": ["healthy", "quick"]
    }
  ]
}

Requirements:
- Use human-readable ingredient names only. DO NOT include ids, codes, UUIDs, or product SKUs.
- If a minor staple is required (salt, oil), include but keep minimal.
- If a minor staple is required (salt, oil), include but keep minimal.
- Keep servings at ${servings} by default.
- Ensure all ingredients and steps are realistic and consistent.
- Return ONLY the JSON object, nothing else.

Input ingredients: ${ingredientList}
User preferences: ${preferenceText}`; 

    const text = await generateWithOpenRouter(prompt, 0.5, 1200);

    // Try to parse JSON from response - handle markdown code blocks
    let jsonString = text;
    
    // Remove markdown code blocks if present
    if (text.includes('```json')) {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }
    } else if (text.includes('```')) {
      const jsonMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }
    } else {
      // Try to find JSON object in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    let payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw response:", text);
      console.error("Extracted JSON string:", jsonString);
      return res.status(500).json({ 
        error: "Invalid AI JSON response", 
        raw: text,
        extracted: jsonString,
        parseError: parseError.message
      });
    }

    const recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
    
    // Store generated meals in database if userId is provided
    const storedMeals = [];
    if (userId && recipes.length > 0) {
      try {
        for (const recipe of recipes) {
          const storedMeal = await storeGeneratedMeal(recipe, userId);
          storedMeals.push({
            ...recipe,
            id: storedMeal.id, // Use database ID
            storedAt: storedMeal.created_at
          });
        }
      } catch (storeError) {
        console.error("Failed to store meals in database:", storeError);
        // Return recipes even if storage fails
        return res.json({ recipes, warning: "Meals generated but not saved to database" });
      }
    }
    
    // Return stored meals if available, otherwise return original recipes
    const responseRecipes = storedMeals.length > 0 ? storedMeals : recipes;
    return res.json({ 
      recipes: responseRecipes,
      stored: storedMeals.length > 0 
    });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

// GET /api/ai/random-image/:category
// Get a random image for a specific category
router.get("/random-image/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { mealName } = req.query;
    
    const imageData = generateRandomLocalFoodImage(mealName || 'random', category);
    
    res.json({
      success: true,
      image_url: imageData.image_url,
      thumbnail_url: imageData.thumbnail_url,
      alt_text: imageData.alt_text
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get random image"
    });
  }
});

// GET /api/ai/test-images
// Test endpoint to verify local image setup
router.get("/test-images", async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const categories = ['breakfast', 'lunch', 'snack', 'dinner', 'general'];
    const results = {};
    
    for (const category of categories) {
      const publicPath = path.join(process.cwd(), 'your-ai-meals', 'public', 'food-images', category);
      
      if (fs.existsSync(publicPath)) {
        const files = fs.readdirSync(publicPath)
          .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
          .sort();
        results[category] = {
          exists: true,
          path: publicPath,
          files: files,
          count: files.length
        };
      } else {
        results[category] = {
          exists: false,
          path: publicPath,
          files: [],
          count: 0
        };
      }
    }
    
    res.json({
      success: true,
      message: "Image directory scan completed",
      results: results,
      instructions: {
        expectedPath: path.join(process.cwd(), 'your-ai-meals', 'public', 'food-images'),
        note: "Make sure images are in the correct folder structure"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to scan image directories"
    });
  }
});

// POST /api/ai/daily-plan
// Generates a daily meal plan with 4 courses (breakfast, lunch, snack, dinner)
router.post("/daily-plan", async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Get user preferences
    const preferences = await fetchUserPreferences(userId);
    const preferenceText = [
      preferences.dietary.length ? `Dietary: ${preferences.dietary.join(", ")}` : "",
      preferences.allergies.length ? `Avoid: ${preferences.allergies.join(", ")}` : "",
      preferences.cuisines.length ? `Cuisines: ${preferences.cuisines.join(", ")}` : ""
    ].filter(Boolean).join(". ");

    const prompt = `You are an expert nutritionist and chef. Generate a complete daily meal plan with 4 courses: Breakfast, Lunch, Snack, and Dinner. Each meal should be nutritionally balanced and delicious.

IMPORTANT: Return ONLY valid JSON in this exact format, no markdown, no code blocks, no explanations:

{
  "dailyPlan": {
    "date": "${new Date().toISOString().split('T')[0]}",
    "meals": [
      {
        "id": "breakfast-1",
        "name": "Recipe Name",
        "description": "Brief description",
        "category": "Breakfast",
        "prepTime": 10,
        "cookTime": 20,
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
          {"name": "ingredient name", "amount": 1, "unit": "cup"}
        ],
        "instructions": ["Step 1", "Step 2"],
        "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fat": 10},
        "tags": ["healthy", "quick"]
      },
      {
        "id": "lunch-1",
        "name": "Recipe Name",
        "description": "Brief description",
        "category": "Lunch",
        "prepTime": 15,
        "cookTime": 25,
        "servings": 1,
        "difficulty": "Medium",
        "ingredients": [
          {"name": "ingredient name", "amount": 1, "unit": "cup"}
        ],
        "instructions": ["Step 1", "Step 2"],
        "nutrition": {"calories": 450, "protein": 25, "carbs": 40, "fat": 15},
        "tags": ["balanced", "satisfying"]
      },
      {
        "id": "snack-1",
        "name": "Recipe Name",
        "description": "Brief description",
        "category": "Snack",
        "prepTime": 5,
        "cookTime": 0,
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
          {"name": "ingredient name", "amount": 1, "unit": "cup"}
        ],
        "instructions": ["Step 1", "Step 2"],
        "nutrition": {"calories": 150, "protein": 8, "carbs": 20, "fat": 5},
        "tags": ["light", "energizing"]
      },
      {
        "id": "dinner-1",
        "name": "Recipe Name",
        "description": "Brief description",
        "category": "Dinner",
        "prepTime": 20,
        "cookTime": 30,
        "servings": 1,
        "difficulty": "Medium",
        "ingredients": [
          {"name": "ingredient name", "amount": 1, "unit": "cup"}
        ],
        "instructions": ["Step 1", "Step 2"],
        "nutrition": {"calories": 500, "protein": 30, "carbs": 35, "fat": 20},
        "tags": ["hearty", "nutritious"]
      }
    ]
  }
}

Requirements:
- Create 4 distinct meals: Breakfast, Lunch, Snack, Dinner
- Each meal should be nutritionally balanced for the time of day
- Breakfast: Energizing, 300-400 calories
- Lunch: Satisfying, 400-500 calories  
- Snack: Light, 150-250 calories
- Dinner: Hearty, 500-600 calories
- Use only human-readable ingredient names
- Ensure variety in flavors and cooking methods
- Make instructions clear and realistic
- Return ONLY the JSON object, nothing else

User preferences: ${preferenceText}`;

    const text = await generateWithOpenRouter(prompt, 0.7, 2000);

    // Parse JSON from response
    let jsonString = text;
    if (text.includes('```json')) {
      const m = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (m) jsonString = m[1].trim();
    } else if (text.includes('```')) {
      const m = text.match(/```\s*([\s\S]*?)\s*```/);
      if (m) jsonString = m[0].trim();
    } else {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) jsonString = m[0];
    }

    let payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON Parse Error (daily plan):", parseError);
      console.error("Raw response:", text);
      return res.status(500).json({ error: "Invalid AI JSON response", raw: text });
    }

    const meals = Array.isArray(payload.dailyPlan?.meals) ? payload.dailyPlan.meals : [];
    
    // Add local food images using actual files
    const mealsWithImages = meals.map((meal) => {
      const imageData = generateRandomLocalFoodImage(meal.name, meal.category);
      
      return {
        ...meal,
        image_url: imageData.image_url,
        thumbnail_url: imageData.thumbnail_url,
        image_alt: imageData.alt_text,
        photographer: imageData.photographer,
        photographer_url: imageData.photographer_url
      };
    });
    
    return res.json({ 
      dailyPlan: {
        ...payload.dailyPlan,
        meals: mealsWithImages
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

// POST /api/ai/plan
// Generates meals for the Plan page. Does NOT store to DB. Ingredients are optional.
// Body: { userId?: string, ingredients?: string[], dietaryPreferences?: string[], allergies?: string[], favoriteCuisines?: string[], calories?: number, protein?: number, mealType?: string, cookTime?: number, servings?: number }
router.post("/plan", async (req, res) => {
  try {
    const {
      userId,
      ingredients = [],
      dietaryPreferences = [],
      allergies = [],
      favoriteCuisines = [],
      calories,
      protein,
      mealType,
      cookTime,
      servings = 2,
    } = req.body || {};

    // Merge with stored user preferences if userId is provided
    const userPrefs = await fetchUserPreferences(userId);
    const allDietary = Array.from(new Set([...(dietaryPreferences || []), ...(userPrefs.dietary || [])]));
    const allAllergies = Array.from(new Set([...(allergies || []), ...(userPrefs.allergies || [])]));
    const allCuisines = Array.from(new Set([...(favoriteCuisines || []), ...(userPrefs.cuisines || [])]));

    const ingredientList = (ingredients || []).join(", ") || "none provided";
    const preferenceText = `Dietary: ${allDietary.join(", ") || "none"}; Allergies: ${allAllergies.join(", ") || "none"}; Favorite cuisines: ${allCuisines.join(", ") || "none"}`;
    const constraints = [
      mealType ? `Meal type: ${mealType}` : null,
      typeof calories === 'number' ? `Target calories per serving: ${calories}` : null,
      typeof protein === 'number' ? `Target protein per serving: ${protein}g` : null,
      typeof cookTime === 'number' ? `Max cook time: ${cookTime} minutes` : null,
      servings ? `Servings: ${servings}` : null,
    ].filter(Boolean).join("; ");

    const prompt = `You are an expert recipe generator. Create 3 realistic, consistent recipe options that satisfy the user's constraints and preferences. If pantry ingredients are provided, prioritize using them but you may include common staples as needed.

IMPORTANT: Return ONLY valid JSON in this exact format, no markdown, no code blocks, no explanations:

{
  "recipes": [
    {
      "id": "recipe-1",
      "name": "Recipe Name",
      "description": "Brief description",
      "category": "Breakfast/Lunch/Dinner/Snack",
      "prepTime": 10,
      "cookTime": 20,
      "servings": ${servings},
      "difficulty": "Easy",
      "ingredients": [
        {"name": "human ingredient name (e.g. lobster, arborio rice, parmesan)", "amount": 1, "unit": "cup"}
      ],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fat": 10},
      "tags": ["healthy", "quick"]
    }
  ]
}

Requirements:
- Avoid any allergens. Respect dietary preferences. Prefer favorite cuisines.
- Use only human-readable ingredient names. DO NOT output any ids/UUIDs in ingredients or instructions.
- If substituting pantry items, still keep ingredient names human.
- Keep servings at ${servings}. ${constraints}
- Ensure ingredients and steps are realistic and consistent.
- Return ONLY the JSON object, nothing else.

Input pantry ingredients (optional): ${ingredientList}
User preferences: ${preferenceText}`;

    const text = await generateWithOpenRouter(prompt, 0.5, 1200);

    // Parse JSON from response
    let jsonString = text;
    if (text.includes('```json')) {
      const m = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (m) jsonString = m[1].trim();
    } else if (text.includes('```')) {
      const m = text.match(/```\s*([\s\S]*?)\s*```/);
      if (m) jsonString = m[1].trim();
    } else {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) jsonString = m[0];
    }

    let payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON Parse Error (plan):", parseError);
      console.error("Raw response:", text);
      return res.status(500).json({ error: "Invalid AI JSON response", raw: text });
    }

    const recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
    
    // Generate local images for each recipe using actual files
    const recipesWithImages = recipes.map((recipe) => {
      const imageData = generateRandomLocalFoodImage(recipe.name, recipe.category);
      
      return {
        ...recipe,
        image_url: imageData.image_url,
        thumbnail_url: imageData.thumbnail_url,
        image_alt: imageData.alt_text,
        photographer: imageData.photographer,
        photographer_url: imageData.photographer_url
      };
    });
    
    return res.json({ recipes: recipesWithImages });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

// POST /api/ai/requests
// Stores a meal generation parameter set into meal_generation_request table
// Body: { userId?: string, calories?: number, protein?: number, mealType?: string, cookTime?: number, servings?: number, dietaryPreferences?: string[], allergies?: string[], favoriteCuisines?: string[] }
router.post("/requests", async (req, res) => {
  try {
    const {
      userId,
      calories = null,
      protein = null,
      mealType = null,
      cookTime = null,
      servings = null,
      dietaryPreferences = [],
      allergies = [],
      favoriteCuisines = [],
    } = req.body || {};

    // Basic shape validation
    const payload = {
      user_id: userId || null,
      target_calories: calories,
      target_protein: protein,
      meal_type: mealType,
      cooking_time_max: cookTime,
      servings,
      dietary_preferences: dietaryPreferences || [],
      allergies: allergies || [],
      cuisine_preferences: favoriteCuisines || [],
      request_type: 'custom_criteria',
      created_at: new Date().toISOString()
    };

    // Use the correct plural table name
    let insertRes = await supabase
      .from("meal_generation_requests")
      .insert(payload)
      .select()
      .single();

    // If there's an error, log it and return error
    if (insertRes.error) {
      console.error("Insert into meal_generation_requests failed:", insertRes.error);
      return res.status(500).json({ error: insertRes.error.message, details: insertRes.error, payload });
    }

    return res.json({ request: insertRes.data });
  } catch (err) {
    console.error("/api/ai/requests unexpected error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

// POST /api/ai/plan/store
// Stores Type 2 generated meals in ai_generated_meals table
// Body: { userId: string, recipes: Array<AIRecipe>, generationCriteria: object }
router.post("/plan/store", async (req, res) => {
  try {
    const { userId, recipes, generationCriteria } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    if (!Array.isArray(recipes) || recipes.length === 0) {
      return res.status(400).json({ error: "recipes array is required" });
    }

    // Store each generated meal in the database
    const storedMeals = [];
    for (const recipe of recipes) {
      try {
        const storedMeal = await storeType2GeneratedMeal(recipe, userId, generationCriteria);
        storedMeals.push({
          ...recipe,
          id: storedMeal.id, // Use database ID
          storedAt: storedMeal.created_at
        });
      } catch (storeError) {
        console.error(`Failed to store meal ${recipe.name}:`, storeError);
        // Continue storing other meals even if one fails
      }
    }

    if (storedMeals.length === 0) {
      return res.status(500).json({ 
        error: "Failed to store any meals in database",
        attempted: recipes.length,
        stored: 0
      });
    }

    return res.json({ 
      recipes: storedMeals,
      stored: true,
      storedCount: storedMeals.length,
      attemptedCount: recipes.length
    });
    
  } catch (err) {
    console.error("Error storing Type 2 meals:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

export default router;



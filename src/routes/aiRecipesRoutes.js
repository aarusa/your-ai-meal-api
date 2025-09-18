import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import supabase from "../database/supabaseClient.js";
import { storeGeneratedMeal } from "../controllers/mealsController.js";

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

// POST /api/ai/recipes
// Body: { userId?: string, ingredients: Array<{ id: string, name?: string }>, servings?: number }
router.post("/recipes", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const { userId, ingredients = [], servings = 2 } = req.body || {};
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: "ingredients must be an array" });
    }

    const preferences = await fetchUserPreferences(userId);

    const ingredientList = ingredients.length > 0 
      ? ingredients.map((i) => (i.name ? `${i.name} (${i.id})` : i.id)).join(", ")
      : "No specific ingredients provided - create recipes based on preferences";

    const preferenceText = `Dietary: ${preferences.dietary.join(", ") || "none"}; Allergies: ${
      preferences.allergies.join(", ") || "none"
    }; Favorite cuisines: ${preferences.cuisines.join(", ") || "none"}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
    });

    const prompt = `You are an expert recipe generator. Create 3 recipe options ${ingredients.length > 0 
      ? 'that can be made primarily with the provided pantry ingredients' 
      : 'based on the user\'s dietary preferences and favorite cuisines'}. Strictly avoid any allergies and adhere to dietary preferences. Prefer favorite cuisines. 

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
        {"productId": "ingredient-id", "amount": 1, "unit": "cup"}
      ],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fat": 10},
      "tags": ["healthy", "quick"]
    }
  ]
}

Requirements:
${ingredients.length > 0 
  ? '- Use productId values using the provided ingredient ids when possible.\n- If a minor staple is required (salt, oil), include but keep minimal.'
  : '- Create recipes using common, accessible ingredients that fit the dietary preferences.\n- Focus on the preferred cuisines and dietary restrictions.'}
- Keep servings at ${servings} by default.
- Ensure all ingredients and steps are realistic and consistent.
- Return ONLY the JSON object, nothing else.

Input ingredients: ${ingredientList}
User preferences: ${preferenceText}`; 

    const aiResult = await model.generateContent(prompt);
    const aiResponse = await aiResult.response;
    const text = aiResponse.text();

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

export default router;



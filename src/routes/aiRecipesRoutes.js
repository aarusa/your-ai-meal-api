import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import supabase from "../database/supabaseClient.js";

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
    });

    const prompt = `You are an expert recipe generator. Create 3 recipe options that can be made primarily with the provided pantry ingredients. Strictly avoid any allergies and adhere to dietary preferences. Prefer favorite cuisines. Return valid JSON only in this TypeScript type shape:

type Recipe = {
  id: string;
  name: string;
  description: string;
  category: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  ingredients: { productId: string; amount: number; unit: string }[];
  instructions: string[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  tags: string[];
};

Requirements:
- Use productId values using the provided ingredient ids when possible.
- If a minor staple is required (salt, oil), include but keep minimal.
- Keep servings at ${servings} by default.
- Ensure all ingredients and steps are realistic and consistent.

Input ingredients: ${ingredientList}
User preferences: ${preferenceText}

Respond with: { recipes: Recipe[] }`; 

    const aiResult = await model.generateContent(prompt);
    const aiResponse = await aiResult.response;
    const text = aiResponse.text();

    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : text;

    let payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (_) {
      return res.status(500).json({ error: "Invalid AI JSON response", raw: text });
    }

    const recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
    return res.json({ recipes });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err) });
  }
});

export default router;



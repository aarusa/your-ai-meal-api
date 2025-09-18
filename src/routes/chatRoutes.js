import express from "express";
// Switch to OpenRouter (DeepSeek) for chat

const router = express.Router();

// Test endpoint to check Gemini configuration
router.get("/test", async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: "OPENROUTER_API_KEY not configured",
        message: "Please add your OpenRouter API key to the .env file"
      });
    }

    const testModels = [process.env.OPENROUTER_MODEL, "deepseek/deepseek-chat", "deepseek/deepseek-r1:free", "meta-llama/llama-3.1-8b-instruct:free"].filter(Boolean);
    let testData = null, lastErr = null;
    for (const model of testModels) {
      const resOR = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say 'API connection successful!'" }]
        })
      });
      if (!resOR.ok) {
        lastErr = await resOR.text();
        continue;
      }
      testData = await resOR.json();
      break;
    }
    if (!testData) {
      return res.status(500).json({ error: "OpenRouter test failed", detail: lastErr });
    }
    const text = testData?.choices?.[0]?.message?.content || "";
    
    res.json({ 
      success: true,
      message: "Gemini API is working correctly!",
      response: text,
      model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v3:free"
    });
    
  } catch (err) {
    res.status(500).json({ 
      error: "Gemini API Error",
      message: err.message 
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body || {};
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return res.status(200).json({ 
        reply: "I'm ready to chat once an OpenRouter API key is configured on the server." 
      });
    }

    // Convert messages to Gemini format
    const conversationHistory = (messages || []).map((m) => {
      const role = m.role || (m.isBot ? "model" : "user");
      const content = m.text || m.content;
      return `${role === "user" ? "Human" : "Assistant"}: ${content}`;
    }).join("\n");

    const systemPrompt = `You are an expert AI Nutrition Assistant specialized in meal planning, dietary advice, and healthy eating. Your expertise includes:

- Nutrition science and macronutrient balance
- Meal planning and recipe suggestions
- Dietary restrictions and allergies
- Weight management and fitness nutrition
- Healthy cooking techniques and food preparation
- Supplement recommendations (when appropriate)
- Hydration and lifestyle factors

Guidelines:
- Provide evidence-based, practical advice
- Be concise but comprehensive
- Consider individual dietary needs and preferences
- Suggest specific foods, portions, and meal timing
- Always recommend consulting healthcare professionals for medical advice
- Focus on sustainable, realistic dietary changes
- Include practical cooking tips and meal prep suggestions

Current context: User is using a meal planning app with pantry management and recipe features.

${conversationHistory}`;

    const models = [process.env.OPENROUTER_MODEL, "deepseek/deepseek-chat", "deepseek/deepseek-r1:free", "meta-llama/llama-3.1-8b-instruct:free"].filter(Boolean);
    let data = null, last = null;
    for (const model of models) {
      const resOR = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: systemPrompt }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });
      if (!resOR.ok) { last = await resOR.text(); continue; }
      data = await resOR.json();
      break;
    }
    if (!data) {
      return res.status(500).json({ error: "OpenRouter chat failed", detail: last });
    }
    const reply = data?.choices?.[0]?.message?.content || "";
    
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      detail: String(err) 
    });
  }
});

// Chatbot-based meal generation endpoint
// POST /api/chat/generate-meal
// Body: { userId?: string, ingredients?: string[], dietaryPreferences?: string[], allergies?: string[], favoriteCuisines?: string[], calories?: number, protein?: number, mealType?: string, cookTime?: number, servings?: number }
router.post("/generate-meal", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: "GEMINI_API_KEY not configured",
        message: "Please add your Gemini API key to the .env file"
      });
    }

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1200,
      }
    });

    const constraints = [
      mealType ? `Meal type: ${mealType}` : null,
      typeof calories === 'number' ? `Target calories per serving: ${calories}` : null,
      typeof protein === 'number' ? `Target protein per serving: ${protein}g` : null,
      typeof cookTime === 'number' ? `Max cook time: ${cookTime} minutes` : null,
      servings ? `Servings: ${servings}` : null,
      (dietaryPreferences || []).length ? `Dietary: ${(dietaryPreferences||[]).join(', ')}` : null,
      (allergies || []).length ? `Allergies: ${(allergies||[]).join(', ')}` : null,
      (favoriteCuisines || []).length ? `Preferred cuisines: ${(favoriteCuisines||[]).join(', ')}` : null,
    ].filter(Boolean).join("; ");

    const ingredientList = (ingredients || []).join(", ") || "none provided";

    const prompt = `You are an expert recipe generator. Create 1-3 realistic recipe options that satisfy the user's constraints and preferences. If pantry ingredients are provided, prioritize using them but you may include common staples as needed.

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
        {"productId": "ingredient-id-or-name", "amount": 1, "unit": "cup"}
      ],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fat": 10},
      "tags": ["healthy", "quick"]
    }
  ]
}

Constraints: ${constraints || 'None'}
Pantry ingredients (optional): ${ingredientList}
Return ONLY the JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON safely
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
    } catch (e) {
      return res.status(500).json({ error: "Invalid AI JSON response", raw: text });
    }

    const recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
    return res.json({ recipes });
  } catch (err) {
    res.status(500).json({ 
      error: "SERVER_ERROR",
      detail: String(err) 
    });
  }
});

export default router;



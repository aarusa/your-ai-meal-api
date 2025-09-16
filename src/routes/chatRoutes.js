import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// Test endpoint to check Gemini configuration
router.get("/test", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: "GEMINI_API_KEY not configured",
        message: "Please add your Gemini API key to the .env file"
      });
    }
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Test the connection
    const result = await model.generateContent("Say 'API connection successful!'");
    const response = await result.response;
    const text = response.text();
    
    res.json({ 
      success: true,
      message: "Gemini API is working correctly!",
      response: text,
      model: "gemini-pro"
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
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(200).json({ 
        reply: "I'm ready to chat once a Gemini API key is configured on the server." 
      });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      }
    });

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

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const reply = response.text();
    
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      detail: String(err) 
    });
  }
});

export default router;



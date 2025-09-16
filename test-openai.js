import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testGeminiConnection() {
  console.log("🔍 Testing Gemini API Connection...\n");
  
  // Check if API key is configured
  const apiKey = process.env.GEMINI_API_KEY;
  
  console.log("📋 Configuration:");
  console.log(`API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`Model: gemini-pro\n`);
  
  if (!apiKey) {
    console.log("❌ ERROR: GEMINI_API_KEY is not set in your .env file");
    console.log("Please add your Gemini API key to backend/.env file");
    console.log("Get your free API key at: https://aistudio.google.com");
    return;
  }
  
  try {
    console.log("🚀 Sending test request to Gemini...");
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50,
      }
    });
    
    const result = await model.generateContent("Say exactly: 'API connection successful!'");
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ API Response:");
    console.log(`Message: ${text}`);
    console.log(`Model Used: gemini-pro`);
    
    console.log("\n🎉 Gemini API is working correctly!");
    console.log("💡 You now have access to free AI nutrition assistance!");
    
  } catch (error) {
    console.log("❌ Connection Error:");
    console.log(error.message);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.log("💡 Check if your Gemini API key is correct");
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      console.log("💡 You might have hit the free tier limits");
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.log("💡 Check if your API key has the right permissions");
    }
  }
}

// Run the test
testGeminiConnection();

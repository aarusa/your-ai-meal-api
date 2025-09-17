import supabase from "../database/supabaseClient.js";
import crypto from "crypto";

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max, decimals = 1) {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function generateMacros(category) {
  // Rough macro templates per category (per 100g)
  switch (category) {
    case "Fruits":
      return {
        energy_kcal_100g: randomFloat(40, 90, 0),
        protein_per_100g: randomFloat(0.3, 2.0, 1),
        carbs_per_100g: randomFloat(10, 24, 1),
        fats_per_100g: randomFloat(0.1, 1.0, 1),
        fiber_per_100g: randomFloat(1.0, 5.0, 1),
        sugar_per_100g: randomFloat(8, 20, 1),
      };
    case "Vegetables":
      return {
        energy_kcal_100g: randomFloat(15, 45, 0),
        protein_per_100g: randomFloat(1.0, 4.0, 1),
        carbs_per_100g: randomFloat(3, 10, 1),
        fats_per_100g: randomFloat(0.1, 1.0, 1),
        fiber_per_100g: randomFloat(1.0, 4.0, 1),
        sugar_per_100g: randomFloat(1, 5, 1),
      };
    case "Grains":
      return {
        energy_kcal_100g: randomFloat(100, 370, 0),
        protein_per_100g: randomFloat(3, 14, 1),
        carbs_per_100g: randomFloat(20, 75, 1),
        fats_per_100g: randomFloat(0.5, 8.0, 1),
        fiber_per_100g: randomFloat(1.0, 10.0, 1),
        sugar_per_100g: randomFloat(0.1, 5.0, 1),
      };
    case "Meat":
    case "Fish":
    case "Legumes":
      return {
        energy_kcal_100g: randomFloat(90, 260, 0),
        protein_per_100g: randomFloat(12, 30, 1),
        carbs_per_100g: randomFloat(0, 25, 1),
        fats_per_100g: randomFloat(1, 20, 1),
        fiber_per_100g: randomFloat(0, 8, 1),
        sugar_per_100g: randomFloat(0, 4, 1),
      };
    case "Dairy":
      return {
        energy_kcal_100g: randomFloat(50, 400, 0),
        protein_per_100g: randomFloat(3, 25, 1),
        carbs_per_100g: randomFloat(1, 12, 1),
        fats_per_100g: randomFloat(1, 35, 1),
        fiber_per_100g: 0,
        sugar_per_100g: randomFloat(0.1, 6.0, 1),
      };
    case "Nuts":
    case "Oils":
      return {
        energy_kcal_100g: randomFloat(550, 900, 0),
        protein_per_100g: randomFloat(5, 25, 1),
        carbs_per_100g: randomFloat(0.1, 25, 1),
        fats_per_100g: randomFloat(45, 100, 1),
        fiber_per_100g: randomFloat(0.1, 15, 1),
        sugar_per_100g: randomFloat(0, 8, 1),
      };
    default:
      return {
        energy_kcal_100g: randomFloat(50, 250, 0),
        protein_per_100g: randomFloat(2, 15, 1),
        carbs_per_100g: randomFloat(2, 35, 1),
        fats_per_100g: randomFloat(0.5, 15, 1),
        fiber_per_100g: randomFloat(0.1, 8, 1),
        sugar_per_100g: randomFloat(0, 10, 1),
      };
  }
}

function generateSampleProducts(count = 200) {
  const categories = [
    "Fruits",
    "Vegetables",
    "Grains",
    "Meat",
    "Fish",
    "Dairy",
    "Nuts",
    "Legumes",
    "Oils",
    "Herbs",
  ];

  const fruits = ["Apple", "Banana", "Orange", "Mango", "Pineapple", "Blueberries", "Strawberries", "Grapes", "Pear", "Kiwi"];
  const vegetables = ["Broccoli", "Spinach", "Carrot", "Tomato", "Cucumber", "Bell Pepper", "Onion", "Garlic", "Mushroom", "Zucchini"];
  const grains = ["Brown Rice", "White Rice", "Quinoa", "Rolled Oats", "Whole Wheat Pasta", "Couscous", "Barley", "Buckwheat", "Millet", "Cornmeal"];
  const meats = ["Chicken Breast", "Ground Beef", "Pork Chop", "Turkey Breast", "Lamb", "Bacon", "Ham", "Beef Steak", "Sausage", "Meatballs"];
  const fish = ["Salmon Fillet", "Tuna", "Cod", "Shrimp", "Crab", "Lobster", "Sardines", "Mackerel", "Tilapia", "Trout"];
  const dairy = ["Whole Milk", "Greek Yogurt", "Cheddar Cheese", "Mozzarella", "Butter", "Cottage Cheese", "Cream", "Skim Milk", "Ice Cream", "Yogurt"];
  const nuts = ["Almonds", "Walnuts", "Cashews", "Pistachios", "Peanuts", "Hazelnuts", "Pecans", "Macadamia", "Pine Nuts", "Chia Seeds"];
  const legumes = ["Black Beans", "Chickpeas", "Lentils", "Kidney Beans", "Pinto Beans", "Peas", "Navy Beans", "Soybeans", "Tofu", "Tempeh"];
  const oils = ["Olive Oil", "Avocado Oil", "Coconut Oil", "Ghee", "Canola Oil", "Sunflower Oil", "Peanut Oil", "Sesame Oil", "Butter Ghee", "Vegetable Oil"];
  const herbs = ["Basil", "Oregano", "Cinnamon", "Turmeric", "Ginger", "Parsley", "Cilantro", "Rosemary", "Thyme", "Mint"];

  const pools = {
    Fruits: fruits,
    Vegetables: vegetables,
    Grains: grains,
    Meat: meats,
    Fish: fish,
    Dairy: dairy,
    Nuts: nuts,
    Legumes: legumes,
    Oils: oils,
    Herbs: herbs,
  };

  const brands = ["Nature's Best", "FreshFarm", "HealthCo", "NutriLife", "GoodFoods", "DailyChoice", "PureHarvest", "GreenLeaf", "OceanCatch", "SunnyVale"];

  const items = [];
  for (let i = 0; i < count; i++) {
    const category = randomChoice(categories);
    const baseName = randomChoice(pools[category]);
    const brand = Math.random() < 0.6 ? randomChoice(brands) : null;
    const variant = Math.random() < 0.5 ? randomChoice(["Organic", "Low Fat", "No Added Sugar", "Gluten-Free", "Unsalted", "Extra Virgin", "Farm Fresh"]) : undefined;
    const name = variant ? `${baseName} (${variant})` : baseName;
    const id = crypto.randomUUID();
    const macros = generateMacros(category);

    items.push({
      id,
      external_id: null,
      external_source: null,
      name,
      brand,
      description: `${name} - ${category}`,
      category,
      subcategory: null,
      barcode: Math.random() < 0.2 ? String(Math.floor(100000000000 + Math.random() * 900000000000)) : null,
      image_url: null,
      image_urls: null,
      thumbnail_url: null,
      calories_per_100g: macros.energy_kcal_100g,
      energy_kcal_100g: macros.energy_kcal_100g,
      protein_per_100g: macros.protein_per_100g,
      carbs_per_100g: macros.carbs_per_100g,
      carbohydrates_100g: macros.carbs_per_100g,
      fats_per_100g: macros.fats_per_100g,
      fiber_per_100g: macros.fiber_per_100g,
      sugar_per_100g: macros.sugar_per_100g,
      sodium_per_100g: randomFloat(0, 1000, 0),
      salt_100g: randomFloat(0, 2.0, 2),
      saturated_fat_per_100g: randomFloat(0, 20, 1),
      trans_fat_per_100g: randomFloat(0, 2, 1),
      cholesterol_per_100g: randomFloat(0, 120, 0),
      is_halal: true,
      is_vegan: ["Meat", "Fish", "Dairy"].includes(category) ? false : Math.random() < 0.9,
      is_vegetarian: ["Meat", "Fish"].includes(category) ? false : true,
      is_kosher: Math.random() < 0.9,
      is_gluten_free: category !== "Grains" || Math.random() < 0.3,
      is_dairy_free: category !== "Dairy",
      is_nut_free: category !== "Nuts",
      is_soy_free: true,
      is_shellfish_free: category !== "Fish" || Math.random() < 0.5 ? true : false,
      is_egg_free: true,
      is_fish_free: category !== "Fish",
      is_palm_oil_free: Math.random() < 0.7,
      common_units: ["g", "cup", "tbsp", "tsp"],
      serving_size_grams: randomFloat(10, 250, 0),
      // Set to null to satisfy strict DB check constraints
      nutriscore_grade: null,
      search_keywords: [baseName.toLowerCase(), category.toLowerCase(), ...(brand ? [brand.toLowerCase()] : [])],
      ai_tags: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    });
  }
  return items;
}

async function insertInBatches(rows, batchSize = 100) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("products").insert(batch);
    if (error) throw error;
  }
}

async function main() {
  try {
    const arg = process.argv[2];
    const count = Math.min(Math.max(parseInt(arg, 10) || 200, 1), 500);
    console.log(`Generating ${count} sample products...`);
    const items = generateSampleProducts(count);
    console.log(`Inserting ${items.length} products into database...`);
    await insertInBatches(items, 100);
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err?.message || err);
    process.exit(1);
  }
}

main();



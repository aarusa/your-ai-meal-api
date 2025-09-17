import supabase from "../database/supabaseClient.js";

async function getProductsByIds(ids = []) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return data || [];
}

export async function getPantry(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { data: rows, error } = await supabase
      .from("user_pantry_items")
      .select("product_id, quantity, unit, quantity_in_grams, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, sugar_per_100g, sodium_per_100g, is_halal, is_vegan, is_vegetarian, is_kosher, is_gluten_free, is_dairy_free, is_nut_free, is_soy_free, is_shellfish_free, is_egg_free")
      .eq("user_id", userId);
    if (error) return res.status(400).json({ error: error.message });

    const productIds = (rows || []).map((r) => r.product_id);
    const products = await getProductsByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    const items = (rows || []).map((r) => {
      const p = productById.get(r.product_id) || { id: r.product_id, name: "Unknown", category: "Unknown", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fats_per_100g: 0, description: null };
      return {
        id: p.id,
        name: p.name,
        category: p.category || "Unknown",
        calories: r.calories_per_100g ?? p.calories_per_100g ?? p.energy_kcal_100g ?? 0,
        protein: r.protein_per_100g ?? p.protein_per_100g ?? 0,
        carbs: r.carbs_per_100g ?? r.carbohydrates_100g ?? p.carbs_per_100g ?? p.carbohydrates_100g ?? 0,
        fat: r.fats_per_100g ?? p.fats_per_100g ?? 0,
        description: p.description || undefined,
        quantity: r.quantity,
        unit: r.unit ?? undefined,
        quantity_in_grams: r.quantity_in_grams ?? undefined,
        is_halal: r.is_halal ?? p.is_halal ?? false,
        is_vegan: r.is_vegan ?? p.is_vegan ?? false,
        is_vegetarian: r.is_vegetarian ?? p.is_vegetarian ?? false,
        is_kosher: r.is_kosher ?? p.is_kosher ?? false,
        is_gluten_free: r.is_gluten_free ?? p.is_gluten_free ?? false,
        is_dairy_free: r.is_dairy_free ?? p.is_dairy_free ?? false,
        is_nut_free: r.is_nut_free ?? p.is_nut_free ?? false,
        is_soy_free: r.is_soy_free ?? p.is_soy_free ?? false,
        is_shellfish_free: r.is_shellfish_free ?? p.is_shellfish_free ?? false,
        is_egg_free: r.is_egg_free ?? p.is_egg_free ?? false,
        addedAt: new Date().toISOString(),
      };
    });
    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function addPantryItem(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const item = req.body;
    if (!item?.id) return res.status(400).json({ error: "product id is required" });
    const qty = item.quantity ?? 1;
    const unit = item.unit ?? "servings";
    const qtyGrams = item.quantity_in_grams ?? null;

    // Ensure a corresponding row exists in public.users for FK
    const { data: appUser, error: appUserErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (appUserErr) return res.status(400).json({ error: appUserErr.message });
    if (!appUser) {
      // Create a shadow user row with guaranteed-unique email derived from userId
      const uniqueEmail = `user_${userId}@local.invalid`;
      const placeholderPassword = `external-${Math.random().toString(36).slice(2)}`;
      const { error: createUserErr } = await supabase
        .from("users")
        .upsert(
          [{ id: userId, email: uniqueEmail, password_hash: placeholderPassword }],
          { onConflict: "id" }
        );
      if (createUserErr) return res.status(400).json({ error: createUserErr.message });
    }

    // Ensure product exists in products table; if missing, create a minimal product from payload
    let productIdToUse = item.id;
    const { data: productRow, error: prodErr } = await supabase
      .from("products")
      .select("id")
      .eq("id", productIdToUse)
      .maybeSingle();
    if (prodErr) return res.status(400).json({ error: prodErr.message });
    if (!productRow) {
      const newProduct = {
        name: item.name || "Custom Item",
        brand: item.brand ?? null,
        description: item.description ?? null,
        category: item.category ?? null,
        calories_per_100g: item.calories_per_100g ?? item.calories ?? null,
        energy_kcal_100g: item.energy_kcal_100g ?? item.calories ?? null,
        protein_per_100g: item.protein_per_100g ?? item.protein ?? null,
        carbs_per_100g: item.carbs_per_100g ?? item.carbs ?? null,
        carbohydrates_100g: item.carbohydrates_100g ?? item.carbs ?? null,
        fats_per_100g: item.fats_per_100g ?? item.fat ?? null,
        is_halal: item.is_halal ?? false,
        is_vegan: item.is_vegan ?? false,
        is_vegetarian: item.is_vegetarian ?? false,
        is_kosher: item.is_kosher ?? false,
        is_gluten_free: item.is_gluten_free ?? false,
        is_dairy_free: item.is_dairy_free ?? false,
        is_nut_free: item.is_nut_free ?? false,
        is_soy_free: item.is_soy_free ?? false,
        is_shellfish_free: item.is_shellfish_free ?? false,
        is_egg_free: item.is_egg_free ?? false,
        is_fish_free: item.is_fish_free ?? false,
        is_palm_oil_free: item.is_palm_oil_free ?? false,
        is_active: true,
      };
      const { data: created, error: createErr } = await supabase
        .from("products")
        .insert([newProduct])
        .select("id")
        .maybeSingle();
      if (createErr) return res.status(400).json({ error: createErr.message });
      productIdToUse = created?.id;
      if (!productIdToUse) return res.status(400).json({ error: "Failed to create product for pantry item" });
    }

    // Try to increment if exists
    const { data: existing, error: selErr } = await supabase
      .from("user_pantry_items")
      .select("quantity")
      .eq("user_id", userId)
      .eq("product_id", item.id)
      .maybeSingle();
    if (selErr) return res.status(400).json({ error: selErr.message });

    const nutritionPatch = {
      calories_per_100g: item.calories_per_100g ?? item.calories ?? null,
      protein_per_100g: item.protein_per_100g ?? item.protein ?? null,
      carbs_per_100g: item.carbs_per_100g ?? item.carbs ?? null,
      fats_per_100g: item.fats_per_100g ?? item.fat ?? null,
      fiber_per_100g: item.fiber_per_100g ?? null,
      sugar_per_100g: item.sugar_per_100g ?? null,
      sodium_per_100g: item.sodium_per_100g ?? null,
      is_halal: item.is_halal ?? null,
      is_vegan: item.is_vegan ?? null,
      is_vegetarian: item.is_vegetarian ?? null,
      is_kosher: item.is_kosher ?? null,
      is_gluten_free: item.is_gluten_free ?? null,
      is_dairy_free: item.is_dairy_free ?? null,
      is_nut_free: item.is_nut_free ?? null,
      is_soy_free: item.is_soy_free ?? null,
      is_shellfish_free: item.is_shellfish_free ?? null,
      is_egg_free: item.is_egg_free ?? null,
    };

    if (existing) {
      const { error: upErr } = await supabase
        .from("user_pantry_items")
        .update({ quantity: (existing.quantity || 0) + qty, unit, quantity_in_grams: qtyGrams, ...nutritionPatch })
        .eq("user_id", userId)
        .eq("product_id", item.id);
      if (upErr) return res.status(400).json({ error: upErr.message });
    } else {
      const { error: inErr } = await supabase
        .from("user_pantry_items")
        .insert([{ user_id: userId, product_id: productIdToUse, quantity: qty, unit, quantity_in_grams: qtyGrams, ...nutritionPatch }]);
      if (inErr) return res.status(400).json({ error: inErr.message });
    }

    return await getPantry(req, res);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updatePantryItem(req, res) {
  try {
    const { userId, productId } = req.query;
    const { quantity } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!productId) return res.status(400).json({ error: "productId is required" });
    if (typeof quantity !== "number") return res.status(400).json({ error: "quantity is required" });

    if (quantity <= 0) {
      const { error } = await supabase
        .from("user_pantry_items")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) return res.status(400).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from("user_pantry_items")
        .update({ quantity })
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) return res.status(400).json({ error: error.message });
    }

    return await getPantry(req, res);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function removePantryItem(req, res) {
  try {
    const { userId, productId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!productId) return res.status(400).json({ error: "productId is required" });

    const { error } = await supabase
      .from("user_pantry_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) return res.status(400).json({ error: error.message });

    return await getPantry(req, res);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function clearPantry(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const { error } = await supabase
      .from("user_pantry_items")
      .delete()
      .eq("user_id", userId);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json([]);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}



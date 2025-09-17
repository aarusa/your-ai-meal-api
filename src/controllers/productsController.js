import supabase from "../database/supabaseClient.js";

// List products with optional query params: search, category, is_active, limit, offset
export async function listProducts(req, res) {
  try {
    const { search, category, is_active, limit = 50, offset = 0 } = req.query || {};

    let query = supabase.from("products").select("*", { count: "exact" });

    if (category) {
      query = query.eq("category", category);
    }
    if (is_active !== undefined) {
      const activeBool = String(is_active).toLowerCase() === "true";
      query = query.eq("is_active", activeBool);
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      // Use ilike on name, brand, category, description
      query = query.or(
        [
          `name.ilike.%${term}%`,
          `brand.ilike.%${term}%`,
          `category.ilike.%${term}%`,
          `description.ilike.%${term}%`,
        ].join(",")
      );
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1).order("updated_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ items: data, total: count ?? data?.length ?? 0, limit: parsedLimit, offset: parsedOffset });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Get single product by id
export async function getProduct(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Create product
export async function createProduct(req, res) {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ error: "name is required" });
    }

    const toInsert = {
      ...body,
      is_active: body.is_active ?? true,
    };

    const { data, error } = await supabase.from("products").insert([toInsert]).select();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data[0]);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Update product
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const { data, error } = await supabase.from("products").update(body).eq("id", id).select();
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json(data[0]);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete product
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").delete().eq("id", id).select();
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ message: "Deleted", product: data[0] });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}



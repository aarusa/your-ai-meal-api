import supabase from "../database/supabaseClient.js";
import bcrypt from 'bcrypt';

// ==========================================================
// 1. User List
// ==========================================================
export async function getUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        user_profiles(*),
        user_allergies(
          allergy_id,
          allergies(*)
        ),
        user_cuisine_preferences(
          cuisine_id,
          cuisines(*)
        ),
        user_dietary_preferences(
          preference_id,
          dietary_preferences(*)
        )
      `);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// ==========================================================
// 2. Create User
// ==========================================================
export async function createUser(req, res) {
    try {
        const {
            email,
            password,
            first_name,
            middle_name,
            last_name,
            // profile fields
            date_of_birth,
            gender,
            activity_level,
            height_cm,
            current_weight,
            target_weight,
            health_goals,
            water_reminder_enabled,
            water_reminder_interval,
            // preference arrays (IDs)
            allergies = [],
            cuisine_preferences = [],
            dietary_preferences = [],
        } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // 1) Insert into users
        const { data: users, error: userError } = await supabase
            .from('users')
            .insert([
                {
                    email,
                    password_hash: hashedPassword,
                    first_name,
                    middle_name,
                    last_name,
                }
            ])
            .select();

        if (userError) throw userError;
        const createdUser = users[0];
        const user_id = createdUser.id;

        // 2) Insert/Update user_profiles without relying on ON CONFLICT
        const { data: existingProfile, error: profileSelectError } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', user_id)
            .maybeSingle();
        if (profileSelectError) throw profileSelectError;
        if (existingProfile) {
            const { error: profileUpdateError } = await supabase
                .from('user_profiles')
                .update({
                    date_of_birth: date_of_birth ?? null,
                    gender: gender ?? null,
                    activity_level: activity_level ?? null,
                    height_cm: height_cm ?? null,
                    current_weight: current_weight ?? null,
                    target_weight: target_weight ?? null,
                    health_goals: Array.isArray(health_goals) ? health_goals : [],
                    water_reminder_enabled: !!water_reminder_enabled,
                    water_reminder_interval: water_reminder_interval ?? null,
                })
                .eq('user_id', user_id);
            if (profileUpdateError) throw profileUpdateError;
        } else {
            const { error: profileInsertError } = await supabase
                .from('user_profiles')
                .insert([{
                    user_id,
                    date_of_birth: date_of_birth ?? null,
                    gender: gender ?? null,
                    activity_level: activity_level ?? null,
                    height_cm: height_cm ?? null,
                    current_weight: current_weight ?? null,
                    target_weight: target_weight ?? null,
                    health_goals: Array.isArray(health_goals) ? health_goals : [],
                    water_reminder_enabled: !!water_reminder_enabled,
                    water_reminder_interval: water_reminder_interval ?? null,
                }]);
            if (profileInsertError) throw profileInsertError;
        }

        // 3) Replace join tables (delete then insert)
        // Allergies
        await supabase.from('user_allergies').delete().eq('user_id', user_id);
        if (Array.isArray(allergies) && allergies.length) {
            const allergyRows = allergies.map((allergy_id) => ({ allergy_id, user_id }));
            const { error } = await supabase.from('user_allergies').insert(allergyRows);
            if (error) throw error;
        }
        // Cuisines
        await supabase.from('user_cuisine_preferences').delete().eq('user_id', user_id);
        if (Array.isArray(cuisine_preferences) && cuisine_preferences.length) {
            const cuisineRows = cuisine_preferences.map((cuisine_id) => ({ cuisine_id, user_id }));
            const { error } = await supabase.from('user_cuisine_preferences').insert(cuisineRows);
            if (error) throw error;
        }
        // Dietary preferences
        await supabase.from('user_dietary_preferences').delete().eq('user_id', user_id);
        if (Array.isArray(dietary_preferences) && dietary_preferences.length) {
            const prefRows = dietary_preferences.map((preference_id) => ({ preference_id, user_id }));
            const { error } = await supabase.from('user_dietary_preferences').insert(prefRows);
            if (error) throw error;
        }

        return res.status(201).json({
            message: "User registered successfully!",
            user: createdUser,
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
}

// ==========================================================
// 3. Edit User
// ==========================================================
export async function editUser(req, res) {
    try {
        const { id } = req.params; // user ID from URL
        const {
            email,
            first_name,
            middle_name,
            last_name,
            date_of_birth,
            gender,
            activity_level,
            height_cm,
            current_weight,
            target_weight,
            health_goals,
            water_reminder_enabled,
            water_reminder_interval,
            allergies,
            cuisine_preferences,
            dietary_preferences,
        } = req.body || {};

        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ email, first_name, middle_name, last_name })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data.length) {
            return res.status(404).json({ error: "User not found" });
        }

        // Upsert profile if provided
        if (
            date_of_birth !== undefined ||
            gender !== undefined ||
            activity_level !== undefined ||
            height_cm !== undefined ||
            current_weight !== undefined ||
            target_weight !== undefined ||
            health_goals !== undefined ||
            water_reminder_enabled !== undefined ||
            water_reminder_interval !== undefined
        ) {
            const { data: existingProfile, error: ps } = await supabase
                .from('user_profiles')
                .select('user_id')
                .eq('user_id', id)
                .maybeSingle();
            if (ps) throw ps;

            if (existingProfile) {
                const { error: pu } = await supabase
                    .from('user_profiles')
                    .update({
                        date_of_birth: date_of_birth ?? null,
                        gender: gender ?? null,
                        activity_level: activity_level ?? null,
                        height_cm: height_cm ?? null,
                        current_weight: current_weight ?? null,
                        target_weight: target_weight ?? null,
                        health_goals: Array.isArray(health_goals) ? health_goals : [],
                        water_reminder_enabled: water_reminder_enabled ?? null,
                        water_reminder_interval: water_reminder_interval ?? null,
                    })
                    .eq('user_id', id);
                if (pu) throw pu;
            } else {
                const { error: pi } = await supabase
                    .from('user_profiles')
                    .insert([{
                        user_id: id,
                        date_of_birth: date_of_birth ?? null,
                        gender: gender ?? null,
                        activity_level: activity_level ?? null,
                        height_cm: height_cm ?? null,
                        current_weight: current_weight ?? null,
                        target_weight: target_weight ?? null,
                        health_goals: Array.isArray(health_goals) ? health_goals : [],
                        water_reminder_enabled: water_reminder_enabled ?? null,
                        water_reminder_interval: water_reminder_interval ?? null,
                    }]);
                if (pi) throw pi;
            }
        }

        // Replace join tables if arrays provided
        if (Array.isArray(allergies)) {
            await supabase.from('user_allergies').delete().eq('user_id', id);
            if (allergies.length) {
                const rows = allergies.map((allergy_id) => ({ allergy_id, user_id: id }));
                const { error: j } = await supabase.from('user_allergies').insert(rows);
                if (j) throw j;
            }
        }
        if (Array.isArray(cuisine_preferences)) {
            await supabase.from('user_cuisine_preferences').delete().eq('user_id', id);
            if (cuisine_preferences.length) {
                const rows = cuisine_preferences.map((cuisine_id) => ({ cuisine_id, user_id: id }));
                const { error: j } = await supabase.from('user_cuisine_preferences').insert(rows);
                if (j) throw j;
            }
        }
        if (Array.isArray(dietary_preferences)) {
            await supabase.from('user_dietary_preferences').delete().eq('user_id', id);
            if (dietary_preferences.length) {
                const rows = dietary_preferences.map((preference_id) => ({ preference_id, user_id: id }));
                const { error: j } = await supabase.from('user_dietary_preferences').insert(rows);
                if (j) throw j;
            }
        }

        res.status(200).json({ message: "User updated successfully!", user: data[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

// ==========================================================
// 4. Delete User
// ==========================================================
export async function deleteUser(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const { data, error } = await supabase
            .from('users')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data.length) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ message: "User deleted successfully!", user: data[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

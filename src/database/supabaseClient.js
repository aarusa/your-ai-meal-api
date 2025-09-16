// Create a single supabase client for interacting with database
import { createClient } from '@supabase/supabase-js'
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase;


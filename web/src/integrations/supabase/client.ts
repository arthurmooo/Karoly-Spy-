import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ayczcnoxgaljkyiljill.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Y3pjbm94Z2Fsamt5aWxqaWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjYxMjQsImV4cCI6MjA4MzgwMjEyNH0.aBAJy84mUndCjHKMCXa_kdRVVBjVCc1Ar0L0UC_JQ7Q";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
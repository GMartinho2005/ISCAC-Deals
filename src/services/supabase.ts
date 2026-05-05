import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esynhuqedmucenvriakc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzeW5odXFlZG11Y2VudnJpYWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzg5NjUsImV4cCI6MjA5MTkxNDk2NX0.AH8oC8hDuK4yzNqwZ7oIYQH22GdD3vBOHgCjmXsJ7oA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
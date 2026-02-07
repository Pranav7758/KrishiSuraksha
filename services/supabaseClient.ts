import { createClient } from '@supabase/supabase-js';

// Prioritize environment variables, fallback to provided keys
const supabaseUrl = process.env.SUPABASE_URL || "https://trwruxyjaoyzyqtzirna.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd3J1eHlqYW95enlxdHppcm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODM3NjMsImV4cCI6MjA4NTk1OTc2M30.P_DfIehtg6SRj99RHQCz8gwFmxybye8v6Yho5M15JJE";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface AdvisoryRecord {
  id?: number;
  crop: string;
  stage: string;
  soil_type: string;
  advisory_json: any;
  created_at?: string;
  is_offline_sync?: boolean;
}
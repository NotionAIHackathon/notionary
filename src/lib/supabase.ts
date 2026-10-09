import { createClient } from "@supabase/supabase-js";

// These are PUBLIC project identifiers. All private keys stay in Edge secrets.
export const supabase = createClient(
  import.meta.env["VITE_SUPABASE_URL"] || "https://lchejzmcvogqcsgjbdde.supabase.co",
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "sb_publishable_615YnQk_FsFXLP0bz87wmw_tbEiuiGR",
);

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requireBuyerApiUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user || user.user_metadata?.user_type !== "buyer") {
    return { user: null, supabase };
  }

  return { user, supabase };
}

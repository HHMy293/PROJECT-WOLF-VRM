import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
let login: Promise<string> | undefined;
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Website chưa được cấu hình Supabase. Hãy thiết lập NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY rồi build hoặc deploy lại.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "Không được dùng Secret key trong trình duyệt. Hãy thay bằng Publishable key.",
    );
  let legacyRole: unknown;
  try {
    legacyRole = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).role;
  } catch {
    /* Publishable key không phải JWT. */
  }
  if (legacyRole === "service_role")
    throw new Error(
      "Không được dùng service_role ở frontend. Hãy thay bằng Publishable key hoặc anon key.",
    );
  client = createClient(url, key);
  return client;
}
export async function ensureIdentity(): Promise<string> {
  if (login) return login;
  login = (async () => {
    const db = getSupabase();
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session.user.id;
    const result = await db.auth.signInAnonymously();
    if (result.error) throw result.error;
    if (!result.data.user)
      throw new Error("Chưa tạo được phiên đăng nhập. Hãy thử lại.");
    return result.data.user.id;
  })();
  try {
    return await login;
  } finally {
    login = undefined;
  }
}

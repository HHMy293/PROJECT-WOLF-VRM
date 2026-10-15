import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let admin: SupabaseClient | undefined;
export function getAdmin() {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Server chưa có SUPABASE_SECRET_KEY. Hãy cấu hình khóa server riêng rồi khởi động hoặc deploy lại.",
    );
  if (key.startsWith("sb_publishable_"))
    throw new Error(
      "SUPABASE_SECRET_KEY cần khóa server, không dùng Publishable key.",
    );
  admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return admin;
}
export async function verifiedUser(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new Error("Bạn cần đăng nhập trước.");
  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data.user || data.user.role !== "authenticated")
    throw new Error("Phiên đăng nhập không hợp lệ. Hãy tải lại trang.");
  return data.user.id;
}

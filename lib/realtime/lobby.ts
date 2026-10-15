import type { RoleId } from "@/types/game";
import { getSupabase } from "@/lib/supabase/browser";

export type LobbyRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished" | "closed";
  game_id: string | null;
  test_mode: boolean;
  mode: "quick" | "classic";
  capacity: number;
  roles: Record<RoleId, number>;
  config_mode: "preset" | "custom";
  reveal_dead: boolean;
  revision: number;
};
export type LobbyPlayer = {
  id: string;
  room_id: string;
  user_id: string | null;
  bot: boolean;
  last_seen_at: string;
  name: string;
  avatar: number;
  ready: boolean;
  joined_at: string;
  left_at: string | null;
  banned: boolean;
};
export type LobbySnapshot = { room: LobbyRoom; players: LobbyPlayer[] };
export type LobbySettings = Pick<
  LobbyRoom,
  "capacity" | "mode" | "roles" | "config_mode" | "reveal_dead"
>;
export async function loadLobby(roomId: string): Promise<LobbySnapshot | null> {
  const db = getSupabase();
  const room = await db
    .from("wolf_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (room.error) throw room.error;
  if (!room.data || room.data.status === "closed") return null;
  const players = await db
    .from("wolf_players")
    .select("*")
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at")
    .order("id");
  if (players.error) throw players.error;
  return {
    room: room.data as LobbyRoom,
    players: players.data as LobbyPlayer[],
  };
}
export async function activeRoom(userId: string): Promise<string | null> {
  const result = await getSupabase()
    .from("wolf_players")
    .select("room_id")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.room_id ?? null;
}
export async function enterLobby(
  name: string,
  code: string | null,
  capacity: number,
  mode: LobbyRoom["mode"],
  avatar: number,
) {
  const result = await getSupabase().rpc("wolf_enter_room", {
    p_name: name,
    p_code: code,
    p_capacity: capacity,
    p_mode: mode,
    p_avatar: avatar,
  });
  if (result.error) throw result.error;
  if (typeof result.data !== "string")
    throw new Error("Phản hồi tạo phòng không hợp lệ.");
  return result.data;
}
export async function readyLobby(id: string, ready: boolean) {
  const result = await getSupabase().rpc("wolf_set_ready", {
    p_room: id,
    p_ready: ready,
  });
  if (result.error) throw result.error;
}
export async function saveLobby(id: string, settings: LobbySettings) {
  const result = await getSupabase().rpc("wolf_save_settings", {
    p_room: id,
    p_capacity: settings.capacity,
    p_mode: settings.mode,
    p_roles: settings.roles,
    p_config_mode: settings.config_mode,
    p_reveal_dead: settings.reveal_dead,
  });
  if (result.error) throw result.error;
}
export async function leaveLobby(id: string, target: string | null = null) {
  const result = await getSupabase().rpc("wolf_leave_room", {
    p_room: id,
    p_target: target,
  });
  if (result.error) throw result.error;
}
export function explainLobbyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Chưa hoàn tất thao tác. Hãy thử lại.";
  if (/anonymous.*disabled/i.test(message))
    return "Supabase chưa bật đăng nhập ẩn danh. Bật Allow anonymous sign-ins trong Authentication.";
  if (/rate limit|too many requests/i.test(message))
    return "Bạn đã thao tác quá nhiều lần. Hãy chờ một chút rồi thử lại.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message))
    return "Không kết nối được Supabase. Kiểm tra mạng và cấu hình website.";
  if (/schema cache|does not exist|permission denied/i.test(message))
    return "Database chưa sẵn sàng hoặc thiếu quyền. Hãy kiểm tra đã chạy toàn bộ WOLF-01-Sanh-cho.sql trong đúng project Supabase.";
  return message;
}

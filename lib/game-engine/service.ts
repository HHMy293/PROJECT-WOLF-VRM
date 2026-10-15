import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { getAdmin } from "@/lib/supabase/server";
import {
  act,
  createGame,
  publicGame,
  privateGame,
  tick,
  RuleError,
} from "./engine";
import type { EngineState, Intent, GameView } from "./types";
import type { LobbyRoom, LobbyPlayer } from "@/lib/realtime/lobby";
export async function memberRoom(roomId: string, uid: string) {
  const db = getAdmin();
  const member = await db
    .from("wolf_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", uid)
    .is("left_at", null)
    .maybeSingle();
  if (member.error) throw member.error;
  if (!member.data) throw new RuleError("Bạn không ở trong phòng này.");
  const room = await db
    .from("wolf_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (room.error) throw room.error;
  if (!room.data || room.data.status === "closed")
    throw new RuleError("Phòng đã đóng.");
  return room.data as LobbyRoom;
}
export async function startGame(
  roomId: string,
  uid: string,
): Promise<GameView> {
  const db = getAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const room = await memberRoom(roomId, uid);
    if (room.host_id !== uid)
      throw new RuleError("Chỉ chủ phòng được bắt đầu ván.");
    if (room.game_id && room.status === "playing") return gameView(roomId, uid);
    if (room.status !== "waiting")
      throw new RuleError("Hãy mở ván mới từ màn hình kết quả.");
    const result = await db
      .from("wolf_players")
      .select("*")
      .eq("room_id", roomId)
      .is("left_at", null)
      .order("joined_at")
      .order("id");
    if (result.error) throw result.error;
    const roster = result.data as LobbyPlayer[];
    if (roster.length !== room.capacity || roster.some((p) => !p.ready))
      throw new RuleError(
        "Cần đủ số người và tất cả sẵn sàng. Bạn có thể thêm bot để thử.",
      );
    const state = createGame(
      randomUUID(),
      roomId,
      roster,
      room.roles,
      room.mode,
      room.reveal_dead,
      Date.now(),
      randomInt,
    );
    const saved = await db.rpc("wolf_engine_start", {
      p_room: roomId,
      p_user: uid,
      p_revision: room.revision,
      p_id: state.id,
      p_state: state,
      p_snapshot: publicGame(state),
    });
    if (saved.error) throw saved.error;
    if (saved.data === true)
      return {
        public: publicGame(state),
        private: privateGame(state, uid),
        serverNow: Date.now(),
        revision: 1,
      };
  }
  throw new RuleError("Phòng vừa thay đổi. Hãy thử lại.");
}
export async function gameView(
  roomId: string,
  uid: string,
  intent?: Intent,
): Promise<GameView> {
  const db = getAdmin();
  for (let attempt = 0; attempt < 8; attempt++) {
    const room = await memberRoom(roomId, uid);
    if (!room.game_id || room.status === "waiting")
      throw new RuleError("Ván chưa bắt đầu.");
    const result = await db
      .from("wolf_game_secrets")
      .select("state,version")
      .eq("game_id", room.game_id)
      .single();
    if (result.error) throw result.error;
    const original = result.data.state as EngineState;
    const now = Date.now();
    const next = intent
      ? act(original, uid, intent, room.host_id, now, randomInt)
      : tick(original, now, randomInt);
    if (JSON.stringify(next) !== JSON.stringify(original)) {
      const saved = await db.rpc("wolf_engine_commit", {
        p_id: next.id,
        p_version: result.data.version,
        p_state: next,
        p_snapshot: publicGame(next),
        p_finished: next.phase === "game_over",
        p_actor: intent ? uid : null,
        p_host_action: Boolean(intent && ["skip_discussion", "skip_phase", "extend_phase"].includes(intent.type)),
      });
      if (saved.error) throw saved.error;
      if (saved.data !== true) continue;
    }
    return {
      public: publicGame(next),
      private: privateGame(next, uid),
      serverNow: now,
      revision:
        Number(result.data.version) +
        (JSON.stringify(next) !== JSON.stringify(original) ? 1 : 0),
    };
  }
  throw new RuleError(
    "Có nhiều thao tác đồng thời. Hãy thử lại sau khi đồng bộ.",
  );
}

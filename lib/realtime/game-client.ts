import { getSupabase } from "@/lib/supabase/browser";
import type { GameView, Intent } from "@/lib/game-engine/types";
export async function requestGame(
  roomId: string,
  intent?: Intent | { type: "start" },
  signal?: AbortSignal,
): Promise<GameView> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new Error("Bạn cần đăng nhập lại.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 12000);
  try {
  const result = await fetch(`/api/game/${roomId}/`, {
    method: intent ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(intent ? { "Content-Type": "application/json" } : {}),
    },
    ...(intent ? { body: JSON.stringify(intent) } : {}),
    cache: "no-store",
    signal: controller.signal,
  });
  const body = await result.json();
  if (!result.ok) throw new Error(body.error || "Chưa xử lý được thao tác.");
  return body as GameView;
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error("Server phản hồi chậm. Bấm Đồng bộ lại để kiểm tra thao tác đã được ghi nhận chưa.");
    throw e;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

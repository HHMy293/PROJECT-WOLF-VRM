import { NextResponse } from "next/server";
import { verifiedUser } from "@/lib/supabase/server";
import { gameView, startGame } from "@/lib/game-engine/service";
import { RuleError } from "@/lib/game-engine/engine";
import type { Intent } from "@/lib/game-engine/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };
function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Authorization",
    },
  });
}
function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Chưa hoàn tất thao tác.";
  if (error instanceof RuleError) return response({ error: message }, 409);
  if (/đăng nhập|Phiên đăng nhập/.test(message))
    return response({ error: message }, 401);
  if (/SUPABASE_SECRET_KEY|Publishable key/.test(message))
    return response({ error: message }, 503);
  console.error(
    "WOLF server operation failed",
    error instanceof Error ? error.name : "Database operation",
  );
  return response(
    {
      error:
        "Server chưa xử lý được trận. Kiểm tra đã chạy WOLF-02-Game-engine.sql và cấu hình đúng khóa server.",
    },
    503,
  );
}
function validId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new RuleError("Mã định danh phòng không hợp lệ.");
}
export async function GET(request: Request, context: Context) {
  try {
    const { roomId } = await context.params;
    validId(roomId);
    const uid = await verifiedUser(request);
    return response(await gameView(roomId, uid));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { roomId } = await context.params;
    validId(roomId);
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      return response({ error: "Yêu cầu quá lớn." }, 413);
    const uid = await verifiedUser(request);
    const raw = await request.text();
    if (raw.length > 4096) return response({ error: "Yêu cầu quá lớn." }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new RuleError("Yêu cầu không hợp lệ.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new RuleError("Yêu cầu không hợp lệ.");
    if (body.type === "start") return response(await startGame(roomId, uid));
    if (
      !["wolf_suggest", "ack", "target", "save", "poison", "pass", "skip_discussion", "skip_phase", "extend_phase"].includes(
        String(body.type),
      ) ||
      typeof body.gameId !== "string" ||
      !Number.isSafeInteger(body.seq) ||
      typeof body.nonce !== "string" ||
      !/^[A-Za-z0-9-]{8,80}$/.test(body.nonce) ||
      (body.target !== undefined && typeof body.target !== "string")
    )
      throw new RuleError("Hành động không hợp lệ.");
    validId(body.gameId);
    if (body.target !== undefined) validId(body.target as string);
    const intent: Intent = {
      type: body.type as Intent["type"],
      gameId: body.gameId,
      seq: body.seq as number,
      nonce: body.nonce,
      ...(typeof body.target === "string" ? { target: body.target } : {}),
    };
    return response(await gameView(roomId, uid, intent));
  } catch (e) {
    return failure(e);
  }
}

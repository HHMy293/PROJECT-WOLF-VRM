// Pure rules. This module is imported by server code and tests, never by browser components.
import type { RoleId, Phase } from "@/types/game";
import type {
  EngineState,
  EnginePlayer,
  Intent,
  ActionKind,
  PublicGame,
  PrivateGame,
} from "./types";
export class RuleError extends Error {}
export type Random = (max: number) => number;
const requireRule = (ok: unknown, message: string) => {
  if (!ok) throw new RuleError(message);
};
const living = (s: EngineState) => s.players.filter((p) => p.alive);
const byId = (s: EngineState, id: string) => s.players.find((p) => p.id === id);
export function createGame(
  id: string,
  roomId: string,
  roster: {
    id: string;
    user_id: string | null;
    name: string;
    avatar: number;
    bot?: boolean;
  }[],
  deck: Record<RoleId, number>,
  mode: "quick" | "classic",
  revealDead: boolean,
  now: number,
  random: Random,
): EngineState {
  requireRule(
    roster.length >= 6 && roster.length <= 12,
    "Trận cần từ 6 đến 12 người.",
  );
  const cards: RoleId[] = [];
  for (const role of [
    "wolf",
    "villager",
    "seer",
    "witch",
    "guard",
    "hunter",
  ] as RoleId[]) {
    requireRule(
      Number.isInteger(deck[role]) && deck[role] >= 0 && deck[role] <= 12,
      "Bộ thẻ không hợp lệ.",
    );
    for (let n = 0; n < deck[role]; n++) cards.push(role);
  }
  requireRule(
    cards.length === roster.length &&
      deck.wolf >= 1 &&
      deck.wolf * 2 < cards.length,
    "Bộ thẻ không khớp số người.",
  );
  for (let i = cards.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const s: EngineState = {
    id,
    roomId,
    mode,
    revealDead,
    phase: "role_reveal",
    seq: 1,
    round: 1,
    started: now,
    deadline: now + (mode === "quick" ? 45000 : 60000),
    stage: null,
    players: roster.map((p, i) => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      avatar: p.avatar,
      bot: Boolean(p.bot),
      role: cards[i],
      alive: true,
      saveUsed: false,
      poisonUsed: false,
      lastGuard: null,
      hunterUsed: false,
      findings: [],
    })),
    actions: {},
    protected: [],
    bite: null,
    poison: [],
    deaths: [],
    hunters: [],
    resume: "discussion",
    runoff: [],
    secondVote: false,
    tally: {},
    eliminated: null,
    message: "Chiếc mặt nạ của bạn",
    winner: null,
    requests: [],
    history: [],
    historyComplete: true,
  };
  return s;
}
function duration(s: EngineState, phase: Phase): number {
  const fast = s.mode === "quick";
  if (phase === "discussion") return fast ? 120000 : 300000;
  if (phase === "voting") return fast ? 60000 : 90000;
  if (phase === "hunter_action") return fast ? 45000 : 60000;
  if (phase === "role_reveal") return fast ? 45000 : 60000;
  if (phase === "night") {
    const seconds = fast
      ? { guard: 60, wolf: 75, seer: 60, witch: 90 }
      : { guard: 90, wolf: 120, seer: 90, witch: 120 };
    return seconds[s.stage!] * 1000;
  }
  return phase === "win_check" ? 1500 : 6000;
}
function enter(s: EngineState, phase: Phase, at: number) {
  s.phase = phase;
  s.seq++;
  s.started = at;
  s.extendedSeconds = 0;
  s.actions = {};
  if (phase !== "night") s.stage = null;
  s.deadline = phase === "game_over" ? null : at + duration(s, phase);
}
function nightStage(s: EngineState, stage: EngineState["stage"], at: number) {
  s.stage = stage;
  enter(s, "night", at);
}
function startNight(s: EngineState, at: number) {
  s.wolfPlans = {};
  s.protected = [];
  s.bite = null;
  s.poison = [];
  s.deaths = [];
  s.runoff = [];
  s.secondVote = false;
  s.tally = {};
  s.eliminated = null;
  nightStage(s, "guard", at);
}
function actors(s: EngineState): EnginePlayer[] {
  if (s.phase === "role_reveal") return living(s);
  if (s.phase === "voting") return living(s);
  if (s.phase === "hunter_action")
    return s.hunters.length ? [byId(s, s.hunters[0])!] : [];
  if (s.phase === "night") return living(s).filter((p) => p.role === s.stage);
  return [];
}
export function eligibleTargets(s: EngineState, p: EnginePlayer): string[] {
  if (!actors(s).some((a) => a.id === p.id) || (s.actions[p.id] && !(s.phase === "night" && p.role === "wolf"))) return [];
  return living(s)
    .filter((target) => {
      if (s.phase === "voting")
        return (
          target.id !== p.id &&
          (!s.runoff.length || s.runoff.includes(target.id))
        );
      if (s.phase === "hunter_action") return target.id !== p.id;
      if (s.phase !== "night") return false;
      if (p.role === "guard") return target.id !== p.lastGuard;
      if (p.role === "wolf") return target.role !== "wolf";
      return target.id !== p.id;
    })
    .map((p) => p.id);
}
function apply(
  s: EngineState,
  p: EnginePlayer,
  type: ActionKind,
  target?: string,
) {
  requireRule(
    actors(s).some((a) => a.id === p.id),
    "Bạn không được hành động ở lượt này.",
  );
  if (type === "wolf_suggest") {
    requireRule(s.phase === "night" && s.stage === "wolf" && p.role === "wolf", "Chỉ Sói còn sống được đề xuất trong lượt Sói.");
    requireRule(target && eligibleTargets(s, p).includes(target), "Mục tiêu không hợp lệ.");
    s.wolfPlans ??= {};
    s.wolfPlans[p.id] = { target: target!, locked: false };
    delete s.actions[p.id];
    return;
  }
  requireRule(!s.actions[p.id], "Bạn đã xác nhận ở lượt này. Đề xuất lại để thay đổi trước khi lượt đóng.");
  if (s.phase === "role_reveal")
    requireRule(type === "ack", "Hãy xác nhận vai trò.");
  else if (type === "pass") {
    /* Skip is an intentional abstention, not a fabricated target. */
  } else if (s.phase === "night" && p.role === "witch" && type === "save") {
    requireRule(
      !p.saveUsed && s.bite && byId(s, s.bite)?.alive,
      "Không thể dùng bình Cứu lúc này.",
    );
    p.saveUsed = true;
  } else {
    requireRule(
      type ===
        (s.phase === "night" && p.role === "witch" ? "poison" : "target"),
      "Hành động không hợp lệ.",
    );
    requireRule(
      target && eligibleTargets(s, p).includes(target),
      "Mục tiêu không hợp lệ.",
    );
    if (s.phase === "night" && p.role === "witch") {
      requireRule(!p.poisonUsed, "Bình Độc đã được dùng.");
      p.poisonUsed = true;
    }
  }
  s.actions[p.id] = { type, ...(target ? { target } : {}) };
  if (s.phase === "night" && p.role === "wolf") {
    s.wolfPlans ??= {};
    s.wolfPlans[p.id] = { target: type === "target" ? target! : null, locked: true };
  }
  if (s.phase === "night" && p.role === "seer" && type === "target")
    p.findings.push({
      round: s.round,
      target: target!,
      wolf: byId(s, target!)!.role === "wolf",
    });
}
function markDeath(s: EngineState, id: string) {
  const p = byId(s, id);
  if (!p || !p.alive) return;
  p.alive = false;
  if (!s.deaths.includes(id)) s.deaths.push(id);
  if (p.role === "hunter" && !p.hunterUsed && !s.hunters.includes(id))
    s.hunters.push(id);
}
function countTargets(s: EngineState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of Object.values(s.actions))
    if (a.target && a.type === "target")
      counts[a.target] = (counts[a.target] ?? 0) + 1;
  return counts;
}
function leaders(counts: Record<string, number>): string[] {
  const max = Math.max(0, ...Object.values(counts));
  return max > 0
    ? Object.keys(counts)
        .filter((id) => counts[id] === max)
        .sort()
    : [];
}
function botAct(s: EngineState, random: Random, botNow: number) {
  for (const p of actors(s).filter((p) => p.bot && !s.actions[p.id])) {
    if (s.phase === "role_reveal") {
      apply(s, p, "ack");
      continue;
    }
    const targets = eligibleTargets(s, p);
    if (s.phase === "night" && p.role === "witch") {
      if (!p.saveUsed && s.bite && random(2) === 0) apply(s, p, "save");
      else if (!p.poisonUsed && targets.length && random(3) === 0)
        apply(s, p, "poison", targets[random(targets.length)]);
      else apply(s, p, "pass");
    } else if (s.phase === "night" && p.role === "wolf" && targets.length) {
      // Bots only inspect plans shared by their own pack, never another role's information.
      const pack = actors(s);
      const humanPlans = pack.filter(a => !a.bot).map(a => s.wolfPlans?.[a.id]).filter(a => a?.target);
      const shared = humanPlans.length ? humanPlans : Object.values(s.wolfPlans ?? {}).filter(a => a.target);
      const counts: Record<string, number> = {};
      for (const plan of shared) if (plan?.target && targets.includes(plan.target)) counts[plan.target] = (counts[plan.target] ?? 0) + 1;
      const target = leaders(counts)[0] ?? targets[random(targets.length)];
      apply(s, p, "wolf_suggest", target);
      // Give humans time to propose, then the bots confirm the pack's leading proposal.
      if (pack.every(a => a.bot) || s.actions[pack.find(a => !a.bot)?.id ?? ""] || s.started + 30000 <= botNow)
        apply(s, p, "target", target);
    } else if (targets.length)
      apply(s, p, "target", targets[random(targets.length)]);
    else apply(s, p, "pass");
  }
}
function advance(s: EngineState, at: number) {
  // Store only closed turns. Never publish this log until the game is over.
  const logged = ["night", "voting", "hunter_action"].includes(s.phase);
  const entry = logged ? {
    seq: s.seq, round: s.round, phase: s.phase, stage: s.stage,
    secondVote: s.secondVote, at,
    actions: actors(s).map(p => ({ actor: p.id,
      type: s.actions[p.id]?.type ?? "unsubmitted" as const,
      ...(s.actions[p.id]?.type === "save" && s.bite ? {target: s.bite} : s.actions[p.id]?.target ? {target: s.actions[p.id].target} : {}),
    })),
    outcomes: [] as NonNullable<EngineState["history"]>[number]["outcomes"],
  } : null;
  switch (s.phase) {
    case "role_reveal":
      startNight(s, at);
      break;
    case "night": {
      if (s.stage === "guard") {
        for (const p of actors(s)) {
          const a = s.actions[p.id];
          p.lastGuard = a?.type === "target" ? a.target! : null;
          if (p.lastGuard) s.protected.push(p.lastGuard);
        }
        nightStage(s, "wolf", at);
      } else if (s.stage === "wolf") {
        const targets = leaders(countTargets(s));
        s.bite = targets.length === 1 ? targets[0] : null;
        entry!.outcomes.push(s.bite ? {kind: "bite", target: s.bite} : {kind: "no_kill"});
        nightStage(s, "seer", at);
      } else if (s.stage === "seer") nightStage(s, "witch", at);
      else {
        const saved = Object.values(s.actions).some((a) => a.type === "save");
        s.poison = Object.values(s.actions)
          .filter((a) => a.type === "poison" && a.target)
          .map((a) => a.target!);
        s.deaths = [];
        if (s.bite && saved) entry!.outcomes.push({kind: "saved", target: s.bite});
        if (s.bite && s.protected.includes(s.bite)) entry!.outcomes.push({kind: "protected", target: s.bite});
        if (s.bite && !saved && !s.protected.includes(s.bite)) {
          markDeath(s, s.bite);
          entry!.outcomes.push({kind: "wolf_kill", target: s.bite});
        }
        for (const [actor, action] of Object.entries(s.actions)) {
          if (action.type !== "poison" || !action.target) continue;
          // A simultaneous bite and poison are both lethal causes of this death.
          markDeath(s, action.target);
          entry!.outcomes.push({kind: "poison_kill", actor, target: action.target});
        }
        if (!s.deaths.length) entry!.outcomes.push({kind: "no_kill"});
        s.resume = "discussion";
        s.message = s.deaths.length
          ? "Đêm qua, ngôi làng đã mất người..."
          : "Một đêm bình yên. Không có ai chết đêm qua.";
        enter(s, "morning", at);
      }
      break;
    }
    case "morning":
      enter(s, s.hunters.length ? "hunter_action" : "win_check", at);
      break;
    case "discussion":
      s.runoff = [];
      s.secondVote = false;
      s.tally = {};
      enter(s, "voting", at);
      break;
    case "voting": {
      const tally = countTargets(s);
      const tied = leaders(tally);
      s.tally = tally;
      s.deaths = [];
      s.eliminated = null;
      if (tied.length > 1 && !s.secondVote) {
        s.runoff = tied;
        s.secondVote = true;
        enter(s, "voting", at);
        s.message = "Phiếu hòa. Bỏ phiếu phụ giữa những người hòa.";
        break;
      }
      if (tied.length === 1) {
        s.eliminated = tied[0];
        markDeath(s, tied[0]);
        entry!.outcomes.push({kind: "vote_kill", target: tied[0]});
        s.message = `${byId(s, tied[0])!.name} đã bị dân làng loại.`;
      } else
        s.message = tied.length
          ? "Phiếu phụ vẫn hòa. Không ai bị loại."
          : "Không có phiếu hợp lệ. Không ai bị loại.";
      s.resume = "night";
      enter(s, "vote_result", at);
      break;
    }
    case "vote_result":
      enter(s, s.hunters.length ? "hunter_action" : "win_check", at);
      break;
    case "hunter_action": {
      const id = s.hunters.shift();
      if (id) {
        const p = byId(s, id)!;
        const a = s.actions[id];
        p.hunterUsed = true;
        if (a?.type === "target" && a.target) {
          markDeath(s, a.target);
          entry!.outcomes.push({kind: "hunter_kill", actor: id, target: a.target});
          s.message = `${p.name} đã kéo ${byId(s, a.target)!.name} đi cùng.`;
        } else s.message = `${p.name} đã chọn không bắn.`;
      }
      enter(s, s.hunters.length ? "hunter_action" : "win_check", at);
      break;
    }
    case "win_check": {
      const wolves = living(s).filter((p) => p.role === "wolf").length;
      const village = living(s).length - wolves;
      s.winner = wolves === 0 ? "village" : wolves >= village ? "wolf" : null;
      if (s.winner) {
        s.message =
          s.winner === "village"
            ? "Bình minh đã đến. Phe Làng chiến thắng!"
            : "Ma Sói đã chiếm ngôi làng!";
        enter(s, "game_over", at);
      } else if (s.resume === "night") {
        s.round++;
        startNight(s, at);
      } else enter(s, "discussion", at);
      break;
    }
  }
  if (entry) {
    s.history ??= [];
    s.history.push(entry);
  }
}
export function tick(
  original: EngineState,
  now: number,
  random: Random,
): EngineState {
  const s = structuredClone(original);
  for (let n = 0; n < 80 && s.phase !== "game_over"; n++) {
    if (now >= s.started + 2000) botAct(s, random, now);
    const expected = actors(s);
    const actionPhase = [
      "role_reveal",
      "night",
      "voting",
      "hunter_action",
    ].includes(s.phase);
    const complete =
      actionPhase && expected.every((p) => Boolean(s.actions[p.id]));
    const expired = s.deadline !== null && now >= s.deadline;
    if (!complete && !expired) break;
    advance(s, expired ? s.deadline! : now);
  }
  return s;
}
export function act(
  original: EngineState,
  userId: string,
  intent: Intent,
  hostId: string,
  now: number,
  random: Random,
): EngineState {
  const key = `${userId}:${intent.nonce}`;
  if (original.requests.includes(key)) return original;
  const s = tick(original, now, random);
  requireRule(
    s.id === intent.gameId && s.seq === intent.seq,
    "Lượt đã thay đổi. Hãy chọn lại sau khi đồng bộ.",
  );
  requireRule(s.phase !== "game_over", "Ván đã kết thúc.");
  const p = s.players.find((p) => p.userId === userId && !p.bot);
  requireRule(p, "Bạn không thuộc ván này.");
  if (intent.type === "skip_discussion") {
    requireRule(
      userId === hostId && s.phase === "discussion",
      "Chỉ chủ phòng được kết thúc thảo luận.",
    );
    advance(s, now);
  } else if (intent.type === "skip_phase" || intent.type === "extend_phase") {
    requireRule(userId === hostId, "Chỉ chủ phòng được điều khiển thời gian.");
    requireRule(s.deadline !== null, "Giai đoạn này không có đồng hồ.");
    if (intent.type === "extend_phase") {
      requireRule((s.extendedSeconds ?? 0) < 120, "Mỗi lượt chỉ được cộng tối đa 120 giây.");
      s.deadline! += 30000;
      s.extendedSeconds = (s.extendedSeconds ?? 0) + 30;
    } else advance(s, now);
  } else apply(s, p!, intent.type, intent.target);
  s.requests.push(key);
  s.requests = s.requests.slice(-200);
  return tick(s, now, random);
}
export function publicGame(s: EngineState): PublicGame {
  return {
    id: s.id,
    roomId: s.roomId,
    phase: s.phase,
    seq: s.seq,
    round: s.round,
    started: s.started,
    deadline: s.deadline,
    extendedSeconds: s.extendedSeconds ?? 0,
    stage: s.stage,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      bot: p.bot,
      alive: p.alive,
      ...(s.phase === "game_over" || (!p.alive && s.revealDead)
        ? { revealedRole: p.role }
        : {}),
    })),
    voted: s.phase === "voting" ? Object.keys(s.actions) : [],
    runoff: s.runoff,
    secondVote: s.secondVote,
    tally: ["vote_result", "hunter_action", "win_check", "game_over"].includes(
      s.phase,
    )
      ? s.tally
      : {},
    deaths: [
      "morning",
      "vote_result",
      "hunter_action",
      "win_check",
      "game_over",
    ].includes(s.phase)
      ? s.deaths
      : [],
    eliminated: s.eliminated,
    hunter: s.phase === "hunter_action" ? (s.hunters[0] ?? null) : null,
    message: [
      "morning",
      "vote_result",
      "hunter_action",
      "win_check",
      "game_over",
    ].includes(s.phase)
      ? s.message
      : "",
    winner: s.winner,
    ...(s.phase === "game_over" ? {
      winnerIds: s.players.filter(p => (p.role === "wolf" ? "wolf" : "village") === s.winner).map(p => p.id),
      history: s.history ?? [],
      historyComplete: s.historyComplete === true,
    } : {}),
  };
}
export function privateGame(s: EngineState, uid: string): PrivateGame {
  const p = s.players.find((p) => p.userId === uid && !p.bot);
  requireRule(p, "Bạn không thuộc ván này.");
  const mine = p!;
  const packTurn = s.phase === "night" && s.stage === "wolf" && mine.role === "wolf" && mine.alive;
  const canAct = actors(s).some((a) => a.id === mine.id) && (!s.actions[mine.id] || packTurn);
  return {
    playerId: mine.id,
    role: mine.role,
    alive: mine.alive,
    bot: false,
    wolfChoices: packTurn ? living(s).filter(p => p.role === "wolf").map(p => ({ playerId: p.id, target: s.wolfPlans?.[p.id]?.target ?? s.actions[p.id]?.target ?? null, locked: Boolean(s.actions[p.id]) })) : [],
    teammates:
      mine.role === "wolf"
        ? s.players
            .filter((p) => p.role === "wolf" && p.id !== mine.id)
            .map((p) => p.id)
        : [],
    saveUsed: mine.saveUsed,
    poisonUsed: mine.poisonUsed,
    lastGuard: mine.lastGuard,
    findings: mine.findings,
    bite:
      s.phase === "night" &&
      s.stage === "witch" &&
      mine.role === "witch" &&
      mine.alive
        ? s.bite
        : null,
    submitted: Boolean(s.actions[mine.id]),
    canAct,
    targets: canAct ? eligibleTargets(s, mine) : [],
  };
}

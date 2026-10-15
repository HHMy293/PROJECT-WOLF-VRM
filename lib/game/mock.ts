/** Device-local scripted presentation adapter. Never use as an authoritative multiplayer engine. */
import { Session, Player, RoleId, Phase } from "@/types/game";
import { presets } from "./catalog";
export const storageKey = "wolf-prototype-v1";
const names = [
  "Bạn",
  "Minh",
  "Trang",
  "Tuấn",
  "Linh",
  "Huy",
  "An",
  "Ngọc",
  "Phúc",
  "Hà",
  "Duy",
  "Mai",
];
export function mockPlayers(n: number, name: string): Player[] {
  return names.slice(0, n).map((x, id) => ({
    id,
    name: id === 0 ? name : x,
    avatar: id % 6,
    alive: true,
    connected: true,
    ready: true,
    host: id === 0,
  }));
}
export function initialSession(): Session {
  return {
    screen: "home",
    name: "",
    code: "",
    mode: "quick",
    phase: "waiting",
    round: 1,
    players: [],
    role: "seer",
    revealed: false,
    selected: null,
    confirmed: false,
    revealDead: false,
    capacity: 8,
    roles: presets(8),
    roleConfigMode: "preset",
    seconds: 45,
    result: null,
    winner: "village",
    potion: null,
    usedSave: false,
    usedPoison: false,
    previousGuard: null,
    runoff: [],
    runoffRound: false,
    spectator: false,
  };
}
export function duration(s: Session, phase: Phase) {
  const fast = s.mode === "quick";
  if (phase === "discussion") return fast ? 120 : 300;
  if (phase === "role_reveal" || phase === "hunter_action") return fast ? 45 : 60;
  if (phase === "voting") return fast ? 60 : 90;
  if (phase === "night") return fast
    ? { wolf: 75, seer: 60, witch: 90, guard: 60, hunter: 60, villager: 60 }[s.role]
    : { wolf: 120, seer: 90, witch: 120, guard: 90, hunter: 90, villager: 90 }[s.role];
  return 8;
}
export function enterPhase(s: Session, phase: Phase): Session {
  return {
    ...s,
    phase,
    seconds: duration(s, phase),
    selected: null,
    confirmed: false,
    potion: null,
  };
}
export function canTarget(s: Session, id: number) {
  const p = s.players.find((p) => p.id === id);
  if (!p?.alive || s.spectator) return false;
  if (s.phase === "voting")
    return id !== 0 && (!s.runoff.length || s.runoff.includes(id));
  if (s.phase === "hunter_action") return id !== 0;
  if (s.phase !== "night") return false;
  switch (s.role) {
    case "seer":
      return id !== 0;
    case "wolf":
      return id !== 0 && id !== 1;
    case "guard":
      return id !== s.previousGuard;
    case "witch":
      return s.potion === "poison" && id !== 0;
    default:
      return false;
  }
}
export function mockRole(id: number, s: Session): RoleId {
  if (id === 0) return s.role;
  const special: RoleId[] = [
    "wolf",
    "wolf",
    "villager",
    "hunter",
    "witch",
    "guard",
    "villager",
    "villager",
    "wolf",
    "villager",
    "villager",
  ];
  return special[id - 1] || "villager";
}
export function advance(s: Session): Session {
  switch (s.phase) {
    case "role_reveal":
      return enterPhase(s, "night");
    case "night": {
      let target = s.players.find((p) => p.id === 2 && p.alive)?.id ?? null;
      if (
        (s.confirmed && s.role === "guard" && s.selected === target) ||
        (s.confirmed && s.role === "witch" && s.potion === "save")
      )
        target = null;
      let players = s.players.map((p) => ({
        ...p,
        alive: p.id === target ? false : p.alive,
      }));
      if (s.confirmed && s.role === "witch" && s.potion === "poison")
        players = players.map((p) => ({
          ...p,
          alive: p.id === s.selected ? false : p.alive,
        }));
      return {
        ...enterPhase(s, "morning"),
        players,
        result: target,
        previousGuard:
          s.confirmed && s.role === "guard" ? s.selected : s.previousGuard,
      };
    }
    case "morning":
      return enterPhase(s, "discussion");
    case "discussion":
      return enterPhase(s, "voting");
    case "voting": {
      const target =
        s.selected ?? s.players.find((p) => p.alive && p.id !== 0)?.id ?? null;
      return {
        ...enterPhase(s, "vote_result"),
        result: target,
        players: s.players.map((p) => ({
          ...p,
          alive: p.id === target ? false : p.alive,
        })),
      };
    }
    case "vote_result":
      return enterPhase(
        s,
        s.result !== null && mockRole(s.result, s) === "hunter"
          ? "hunter_action"
          : "win_check",
      );
    case "hunter_action":
      return {
        ...enterPhase(s, "win_check"),
        players: s.players.map((p) => ({
          ...p,
          alive: p.id === s.selected ? false : p.alive,
        })),
      };
    case "win_check":
      return s.round >= 2
        ? enterPhase(s, "game_over")
        : {
            ...enterPhase(s, "night"),
            round: s.round + 1,
            runoff: [],
            runoffRound: false,
          };
    default:
      return s;
  }
}

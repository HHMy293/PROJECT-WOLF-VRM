export type RoleId =
  "wolf" | "villager" | "seer" | "witch" | "guard" | "hunter";
export type Phase =
  | "waiting"
  | "role_reveal"
  | "night"
  | "morning"
  | "discussion"
  | "voting"
  | "vote_result"
  | "hunter_action"
  | "win_check"
  | "game_over";
export type Screen = "home" | "create" | "join" | "lobby" | "game";
export type Player = {
  id: number;
  name: string;
  avatar: number;
  alive: boolean;
  connected: boolean;
  ready: boolean;
  host: boolean;
};
export type Session = {
  screen: Screen;
  name: string;
  code: string;
  mode: "quick" | "classic";
  phase: Phase;
  round: number;
  players: Player[];
  role: RoleId;
  revealed: boolean;
  selected: number | null;
  confirmed: boolean;
  revealDead: boolean;
  capacity: number;
  roles: Record<RoleId, number>;
  roleConfigMode: "preset" | "custom";
  seconds: number;
  result: number | null;
  winner: "village" | "wolf";
  potion: "save" | "poison" | null;
  usedSave: boolean;
  usedPoison: boolean;
  previousGuard: number | null;
  runoff: number[];
  runoffRound: boolean;
  spectator: boolean;
};

import type { Phase, Player, RoleId } from "@/types/game";
/** Public state excludes hidden roles, vote targets and night actions. */
export interface PublicGameSnapshot {
  roomCode: string;
  phase: Phase;
  round: number;
  players: Player[];
  phaseEndsAt: string;
  winner: "village" | "wolf" | null;
  votedPlayerIds: number[];
  runoffCandidates: number[];
}
export interface PrivatePlayerSnapshot {
  playerId: number;
  role: RoleId;
  wolfTeammateIds: number[];
  actionCompleted: boolean;
  seerResult: "wolf" | "not_wolf" | null;
  witchVictimId: number | null;
  saveAvailable: boolean;
  poisonAvailable: boolean;
}
export type PlayerIntent =
  | { type: "ready"; ready: boolean }
  | { type: "vote"; targetId: number }
  | {
      type: "night_action";
      action: "protect" | "bite" | "inspect" | "save" | "poison" | "skip";
      targetId?: number;
    }
  | { type: "hunter_shot"; targetId: number | null };
/** A host can request an early discussion end; the server validates current host and phase. */
export type HostIntent = { type: "end_discussion" };
/** Phase 2+ must implement this on an authenticated server; never trust device-local state. */
export interface GameTransport {
  subscribePublic(
    roomCode: string,
    onState: (state: PublicGameSnapshot) => void,
  ): () => void;
  subscribePrivate(onState: (state: PrivatePlayerSnapshot) => void): () => void;
  sendIntent(intent: PlayerIntent): Promise<void>;
  sendHostIntent(intent: HostIntent): Promise<void>;
}

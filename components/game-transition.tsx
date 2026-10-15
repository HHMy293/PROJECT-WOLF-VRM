"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import type { PublicGame } from "@/lib/game-engine/types";

export default function GameTransition({ game }: { game: PublicGame }) {
  const [notice, setNotice] = useState<{ kind: "night" | "day"; round: number; key: string } | null>(null);
  const seen = useRef(new Set<string>());
  const previous = useRef<"night" | "day" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();
  const kind = game.phase === "night" ? "night" : ["morning", "discussion", "voting", "vote_result"].includes(game.phase) ? "day" : null;

  useEffect(() => {
    if (game.phase === "game_over") {
      if (timer.current) clearTimeout(timer.current);
      setNotice(null);
      return;
    }
    if (!kind) return;
    const key = `${game.id}:${game.round}:${kind}`;
    const shouldShow = kind === "night" || game.phase === "morning" || previous.current === "night";
    previous.current = kind;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    if (!shouldShow) return;
    if (timer.current) clearTimeout(timer.current);
    setNotice({ kind, round: game.round, key });
    timer.current = setTimeout(() => setNotice(null), reduce ? 1200 : 2200);
  }, [game.id, game.round, game.phase, kind, reduce]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return <AnimatePresence>
    {notice && <motion.div
      key={notice.key}
      className={`game-transition ${notice.kind}`}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.3 }}
    >
      <motion.div className="transition-card" initial={reduce ? false : { y: 14, scale: 0.97 }} animate={{ y: 0, scale: 1 }}>
        {notice.kind === "night" ? <Moon size={54} /> : <Sun size={54} />}
        <span className="eyebrow">VÒNG {notice.round}</span>
        <h2>{notice.kind === "night" ? "MÀN ĐÊM BUÔNG XUỐNG" : "BÌNH MINH ĐÃ ĐẾN"}</h2>
        <p>{notice.kind === "night" ? "Ngôi làng chìm vào giấc ngủ. Những thế lực trong bóng tối thức giấc." : "Ngôi làng thức dậy. Đêm qua đã để lại điều gì?"}</p>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}

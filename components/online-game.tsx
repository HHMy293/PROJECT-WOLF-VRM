"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Moon,
  Sun,
  Users,
  Timer,
  LogOut,
  Check,
  Skull,
  Eye,
  EyeOff,
  Shield,
  FlaskConical,
  Target,
  Wheat,
  Swords,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import GameChat from "@/components/game-chat";
import GameTransition from "@/components/game-transition";
import GameSummary from "@/components/game-summary";
import { Button } from "@/components/ui/button";
import { roles, labels } from "@/lib/game/catalog";
import { getSupabase } from "@/lib/supabase/browser";
import { requestGame } from "@/lib/realtime/game-client";
import type { GameView, ActionKind } from "@/lib/game-engine/types";
import type { LobbyRoom } from "@/lib/realtime/lobby";
const icons = {
  wolf: Swords,
  villager: Wheat,
  seer: Eye,
  witch: FlaskConical,
  guard: Shield,
  hunter: Target,
};
const stages = {
  guard: "Bảo Vệ",
  wolf: "Ma Sói",
  seer: "Tiên Tri",
  witch: "Phù Thủy",
};
export default function OnlineGame({
  room,
  userId,
  onLeave,
  onDay,
  muted,
  onMutedChange,
}: {
  room: LobbyRoom;
  userId: string;
  onLeave: () => void;
  onDay: (day: boolean) => void;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
}) {
  const [view, setView] = useState<GameView | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [privateVisible, setPrivateVisible] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [potion, setPotion] = useState<"save" | "poison" | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const privateContent = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const offset = useRef(0);
  const acceptedView = useRef<GameView | null>(null);
  const [music, setMusic] = useState(false);
  function sound() {
    if (muted) return;
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 440;
      g.gain.setValueAtTime(0.025, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.16);
      o.onended = () => {
        void ctx.close();
      };
    } catch {
      /* Audio may be blocked until interaction. */
    }
  }
  const reduce = useReducedMotion();
  const lastSeq = useRef(0);
  const game = view?.public;
  const me = view?.private;
  const accept = useCallback((next: GameView) => {
    if (acceptedView.current && next.revision < acceptedView.current.revision) return;
    acceptedView.current = next;
    offset.current = next.serverNow - Date.now();
    setView((previous) =>
      !previous || next.public.id !== previous.public.id || next.revision > previous.revision ? next : previous,
    );
    setOffline(false);
    setLastSync(Date.now());
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      accept(await requestGame(room.id, undefined, signal));
    },
    [room.id, accept],
  );
  useEffect(() => {
    let cancelled = false;
    let reading = false;
    let dirty = false;
    const controller = new AbortController();
    async function read() {
      if (cancelled) return;
      if (reading) {
        dirty = true;
        return;
      }
      reading = true;
      try {
        const next = await requestGame(room.id, undefined, controller.signal);
        if (!cancelled) accept(next);
      } catch (e) {
        if (!cancelled) {
          setOffline(true);
          setError(e instanceof Error ? e.message : "Đang kết nối lại...");
        }
      } finally {
        reading = false;
        if (dirty && !cancelled) {
          dirty = false;
          void read();
        }
      }
    }
    const db = getSupabase();
    const channel = db
      .channel(`wolf-game:${room.game_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wolf_games",
          filter: `id=eq.${room.game_id}`,
        },
        () => {
          void read();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void read();
      });
    // Deadline belongs to server. Polling requests progression; browser never computes deaths or winners.
    const poll = setInterval(() => {
      if (navigator.onLine) void read();
    }, 2000);
    const focus = () => {
      void read();
    };
    const lost = () => { setOffline(true); setPrivateVisible(false); setRevealed(false); };
    window.addEventListener("offline", lost);
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    void read();
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("offline", lost);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      void db.removeChannel(channel);
    };
  }, [room.id, room.game_id, accept]);
  useEffect(() => {
    const hide = () => { setPrivateVisible(false); setRevealed(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("blur", hide);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (game && lastSeq.current !== game.seq) {
      lastSeq.current = game.seq;
      setPrivateVisible(false);
      setRevealed(false);
      setSelected(null);
      setPotion(null);
      setSkipConfirmation(false);
      setError("");
    }
  }, [game]);
  useEffect(() => {
    if (privateVisible) privateContent.current?.scrollTo(0, 0);
  }, [privateVisible, game?.seq]);
  useEffect(() => {
    onDay(
      Boolean(
        game &&
        [
          "morning",
          "discussion",
          "voting",
          "vote_result",
          "game_over",
        ].includes(game.phase),
      ),
    );
  }, [game?.phase, onDay]);
  useEffect(() => {
    if (!music || muted) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.01;
    gain.connect(ctx.destination);
    const oscs = [110, 164.81, 220].map((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    return () => {
      oscs.forEach((o) => o.stop());
      void ctx.close();
    };
  }, [music, muted]);
  async function send(type: ActionKind, target?: string) {
    if (!game || busyRef.current) return;
    busyRef.current = true;
    sound();
    setBusy(true);
    setError("");
    try {
      accept(
        await requestGame(room.id, {
          type,
          ...(target ? { target } : {}),
          gameId: game.id,
          seq: game.seq,
          nonce: crypto.randomUUID(),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa ghi nhận hành động.");
      try {
        await refresh();
      } catch {
        setOffline(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function rematch() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await getSupabase().rpc("wolf_rematch", {
        p_room: room.id,
      });
      if (result.error) throw result.error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa mở được ván mới.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (!game || !me)
    return (
      <section className="setup-section">
        <div className="setup-panel">
          <h1>Ngôi làng đang thức giấc...</h1>
          <p>{error || "Đang khôi phục ván và vai trò riêng của bạn."}</p>
          <Button variant="secondary" onClick={onLeave}>
            Rời phòng
          </Button>
        </div>
      </section>
    );
  const Icon = icons[me.role];
  const role = roles[me.role];
  const isHost = room.host_id === userId;
  const seconds = game.deadline
    ? Math.max(0, Math.ceil((game.deadline - clock) / 1000))
    : 0;
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const name = (id: string | null) =>
    game.players.find((p) => p.id === id)?.name ?? "Không có";
  const isNight = game.phase === "night";
  const wolfTurn = isNight && me.role === "wolf" && game.stage === "wolf" && me.alive;
  const wolfChoices = me.wolfChoices ?? [];
  const myWolfChoice = wolfChoices.find(p => p.playerId === me.playerId);
  const choosing =
    me.canAct && ["night", "voting", "hunter_action"].includes(game.phase);
  const canSelect =
    choosing && !offline && (privateVisible || !isNight) && !(isNight && me.role === "witch" && !potion);
  return (
    <section className="game-section online-game">
      <GameTransition game={game} />
      <div className="game-status">
        <span>
          {isNight ? <Moon size={16} /> : <Sun size={16} />}
          {labels[game.phase]} · Vòng {game.round}
          {isNight && game.stage && ` · Lượt ${stages[game.stage]}`}
        </span>
        <span>
          <Users size={16} />
          {game.players.filter((p) => p.alive).length}/{game.players.length} còn
          sống
        </span>
        <span className={seconds <= 10 ? "urgent" : ""}>
          <Timer size={16} />
          {game.phase === "game_over" ? "KẾT THÚC" : timer}
        </span>
        <button aria-label="Rời phòng" onClick={onLeave}>
          <LogOut size={16} />
        </button>
      </div>
      <div className="sync-strip" role="status">
        <span>{offline ? "Đang kết nối lại" : busy ? "Đang gửi · Chờ server xác nhận" : "Đã đồng bộ"}</span>
        <button className="text-button" disabled={busy} onClick={() => { void refresh().then(() => setError("")).catch(() => setOffline(true)); }}>Đồng bộ lại</button>
        <span>{lastSync ? `Cập nhật ${new Date(lastSync).toLocaleTimeString("vi-VN")}` : "Đang tải"}</span>
      </div>
      {isHost && game.deadline !== null && game.phase !== "game_over" && (
        <div className="host-time-controls">
          <span>CHỦ PHÒNG · Thời gian lượt</span>
          <Button variant="secondary" disabled={busy || offline || (game.extendedSeconds ?? 0) >= 120} onClick={() => void send("extend_phase")}>
            +30 GIÂY{(game.extendedSeconds ?? 0) > 0 ? ` · Đã thêm ${game.extendedSeconds}s` : ""}
          </Button>
          <Button variant="ghost" disabled={busy || offline} onClick={() => {
            if (["role_reveal", "night", "voting", "hunter_action"].includes(game.phase)) setSkipConfirmation(true);
            else void send("skip_phase");
          }}>{game.phase === "discussion" ? "KẾT THÚC THẢO LUẬN" : "SKIP · CHUYỂN LƯỢT"}</Button>
          {skipConfirmation && <div className="host-skip-confirm" role="alert">
            <span>Chuyển lượt ngay? Lựa chọn đã xác nhận vẫn được tính; người chưa xác nhận sẽ mất lượt. Ban đêm chỉ chuyển giai đoạn hiện tại.</span>
            <Button disabled={busy || offline} onClick={() => { setSkipConfirmation(false); void send("skip_phase"); }}>XÁC NHẬN CHUYỂN LƯỢT</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setSkipConfirmation(false)}>TIẾP TỤC CHỜ</Button>
          </div>}
        </div>
      )}
      {choosing && !me.submitted && seconds > 0 && seconds <= 10 && <p className="turn-warning" role="status">Còn {seconds} giây · Hãy xác nhận lựa chọn để được tính.</p>}
      {offline && (
        <p className="online-error" role="status">
          Mất kết nối · Đang khôi phục ván. Lựa chọn được kiểm tra lại trên
          server.
        </p>
      )}
      {error && (
        <p className="online-error" role="alert">
          {error}
        </p>
      )}
      <div className="match-shell"><GameChat game={game} me={me} /><div className="match-main">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          initial={reduce ? false : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {game.phase === "role_reveal" ? (
            <div className="reveal-screen">
              <span className="eyebrow">CHIẾC MẶT NẠ CỦA BẠN</span>
              <h1>Không ai được biết điều này.</h1>
              <button
                className={`flip-card ${revealed ? "flipped" : ""}`}
                aria-label={revealed ? "Nhấn để ẩn vai trò" : "Nhấn để xem vai trò"}
                aria-pressed={revealed}
                onClick={() => {
                  sound();
                  setRevealed(!revealed);
                }}
              >
                <span className="flip-inner">
                  <span className="card-back" aria-hidden={revealed}>
                    <Moon size={56} />
                    <strong>NHẤN ĐỂ XEM</strong>
                  </span>
                  <span className="card-front" aria-hidden={!revealed} style={revealed ? { color: role.color } : undefined}>
                    {revealed && <><Icon size={58} /><strong>{role.name}</strong><small>{role.team}</small></>}
                  </span>
                </span>
              </button>
              {revealed && (
                <>
                  <details className="role-rules">
                    <summary>Chức năng và luật của lá bài</summary>
                    <p>{role.description}</p>
                    {me.role === "wolf" && <p>Chỉ cắn người ngoài phe Sói. Mỗi Sói một phiếu xác nhận; người có nhiều phiếu nhất bị cắn. Hòa hoặc tất cả bỏ qua: không cắn. Đề xuất có thể sửa trước khi lượt đóng.</p>}
                    {me.role === "guard" && <p>Được tự bảo vệ; không lặp mục tiêu hai đêm liên tiếp. Chỉ chặn Sói cắn, không chặn độc. Bỏ qua một đêm thì đêm sau được chọn lại.</p>}
                    {me.role === "seer" && <p>Không tự soi; biết mục tiêu là Sói hay không phải Sói. Kết quả chỉ bạn thấy và được lưu theo đêm.</p>}
                    {me.role === "witch" && <p>Mỗi bình dùng một lần cả ván; tối đa một bình mỗi đêm. Cứu đúng người bị Sói cắn, có thể cứu bản thân. Độc chọn người khác còn sống; độc không bị Bảo Vệ hoặc bình Cứu chặn.</p>}
                    {me.role === "hunter" && <p>Bị cắn, trúng độc hoặc bị loại đều được bắn một người còn sống khác. Chỉ một phát cả ván; bỏ qua/hết giờ thì không bắn. Chuỗi Thợ Săn xử lý xong mới xét thắng.</p>}
                    {me.role === "villager" && <p>Không có kỹ năng đêm. Ban ngày thảo luận và bỏ phiếu; không tự bỏ phiếu cho mình.</p>}
                  </details>
                  {me.teammates.length > 0 && (
                    <p>Sói đồng đội: {me.teammates.map(name).join(", ")}</p>
                  )}
                  <Button
                    disabled={busy || me.submitted || !me.canAct}
                    onClick={() => {
                      void send("ack");
                    }}
                  >
                    {me.submitted
                      ? "ĐÃ XÁC NHẬN · ĐỢI MỌI NGƯỜI"
                      : "TÔI ĐÃ HIỂU VAI TRÒ"}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {game.phase === "game_over"
                      ? "VẬN MỆNH NGÔI LÀNG"
                      : game.phase === "night"
                        ? `ĐÊM THỨ ${game.round}`
                        : "NGÔI LÀNG DƯỚI ÁNH TRĂNG"}
                  </span>
                  <h1>
                    {game.phase === "game_over"
                      ? game.winner === "village"
                        ? "Bình minh đã đến"
                        : "Ma Sói đã chiếm ngôi làng"
                      : game.phase === "voting"
                        ? game.secondVote
                          ? "Lá phiếu quyết định"
                          : "Ai là Ma Sói?"
                        : labels[game.phase]}
                  </h1>
                  <p>
                    {game.message ||
                      (isNight
                        ? me.canAct
                          ? !privateVisible ? "Nhấn Xem vai trò và kỹ năng trước khi chọn mục tiêu." : me.submitted ? "Đã ghi nhận phiếu. Chờ bầy Sói hoàn tất hoặc đề xuất lại trước khi lượt đóng." : "Đến lượt của bạn. Hãy chọn và xác nhận."
                          : "Hãy ngủ thật ngon... nếu bạn có thể. Những thế lực trong màn đêm đang hành động."
                        : game.phase === "discussion"
                          ? "Hãy thảo luận trực tiếp và tìm ra kẻ đáng ngờ."
                          : game.phase === "voting"
                            ? game.secondVote
                              ? "Bỏ phiếu lại giữa những người hòa phiếu cao nhất. Nếu tiếp tục hòa hoặc không có phiếu hợp lệ, không ai bị loại."
                              : "Phiếu được giữ kín đến khi đóng lượt."
                            : "Ngôi làng đang chờ vận mệnh tiếp theo.")}
                  </p>
                </div>
              </div>
              {game.phase === "game_over" && (
                <div className="victory-title">
                  {game.winner === "village"
                    ? "PHE LÀNG CHIẾN THẮNG"
                    : "PHE MA SÓI CHIẾN THẮNG"}
                </div>
              )}
              {game.phase === "morning" && (
                <div className="night-result">
                  {game.deaths.length ? (
                    game.deaths.map((id) => (
                      <h2 key={id}>
                        <Skull size={22} /> {name(id)} đã chết.
                      </h2>
                    ))
                  ) : (
                    <h2>Một đêm bình yên.</h2>
                  )}
                </div>
              )}
              <div className="game-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <h2>
                      <Users size={19} /> Người trong làng
                    </h2>
                    {!me.alive && <span>Đang theo dõi</span>}
                  </div>
                  <div className="players-grid">
                    {game.players.map((p) => {
                      const enabled =
                        canSelect && (isNight && me.role === "witch" && potion === "save" ? p.id === me.bite : me.targets.includes(p.id)) && !busy;
                      const Avatar = p.bot ? Swords : Wheat;
                      const Revealed = p.revealedRole
                        ? icons[p.revealedRole]
                        : null;
                      return (
                        <motion.button
                          key={p.id}
                          className={`player-card ${!p.alive ? "dead" : ""} ${selected === p.id && (privateVisible || !isNight) ? "selected" : ""} ${enabled ? "targetable" : ""} ${game.winnerIds?.includes(p.id) ? "winner" : ""}`}
                          disabled={!enabled}
                          aria-label={`${p.name}${p.bot ? ", bot thử nghiệm" : ""}${p.alive ? ", còn sống" : ", đã chết"}`}
                          aria-pressed={selected === p.id && (privateVisible || !isNight)}
                          onClick={() => {
                            setSelected(p.id);
                            if (wolfTurn) void send("wolf_suggest", p.id);
                          }}
                        >
                          <div className={`avatar avatar-${p.avatar}`}>
                            <Avatar size={24} />
                            <span>{p.name.slice(0, 1)}</span>
                          </div>
                          <strong>
                            {p.name}
                            {p.id === me.playerId && <small> (Bạn)</small>}
                          </strong>
                          <span>
                            {p.bot && "Bot · "}
                            {p.alive ? "Còn sống" : "Đã chết"}
                          </span>
                          {game.phase === "voting" && p.alive && (
                            <span>
                              {game.voted.includes(p.id)
                                ? "Đã bỏ phiếu ✓"
                                : "Đang chọn..."}
                            </span>
                          )}
                          {game.winnerIds?.includes(p.id) && <span className="winner-badge">🏆 Chiến thắng</span>}
                          {Revealed && (
                            <span>
                              <Revealed size={14} />{" "}
                              {roles[p.revealedRole!].name}
                            </span>
                          )}
                          {selected === p.id && (privateVisible || !isNight) && <Check className="selection-check" size={18} />}
                        </motion.button>
                      );
                    })}
                  </div>
                  {Object.keys(game.tally).length > 0 && (
                    <details className="vote-summary">
                    <summary>Kết quả phiếu · {Object.values(game.tally).reduce((sum, n) => sum + n, 0)} phiếu hợp lệ</summary>
                    <div className="vote-bars">
                      {Object.entries(game.tally).map(([id, n]) => (
                        <div key={id}>
                          <span>{name(id)}</span>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(5, (n / game.players.length) * 100)}%`,
                            }}
                            className="vote-bar"
                          />
                          <strong>{n} phiếu</strong>
                        </div>
                      ))}
                    </div>
                    </details>
                  )}
                </div>
                <aside className="panel online-action-panel">
                  <button className="privacy-toggle" aria-expanded={privateVisible} onClick={() => setPrivateVisible(v => !v)}>
                    {privateVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    {privateVisible ? "Ẩn vai trò và kỹ năng" : "Xem vai trò và kỹ năng"}
                  </button>
                  {!privateVisible && <p className="private-placeholder">Thông tin riêng đã được che. Nhấn để xem, nhấn lần nữa hoặc Esc để ẩn. Tự ẩn khi đổi lượt hoặc rời cửa sổ.</p>}
                  {privateVisible && <div ref={privateContent} className={`private-content ${wolfTurn ? "pack-turn" : ""}`}>
                  <span className="eyebrow">VAI TRÒ RIÊNG CỦA BẠN</span>
                  <h2 style={{ color: role.color }}>
                    <Icon size={24} /> {role.name}
                  </h2>
                  <details className="role-rules">
                    <summary>Chức năng và luật của lá bài</summary>
                    <p>{role.description}</p>
                    {me.role === "wolf" && <p>Chỉ cắn người ngoài phe Sói. Mỗi Sói một phiếu xác nhận; người có nhiều phiếu nhất bị cắn. Hòa hoặc tất cả bỏ qua: không cắn. Đề xuất có thể sửa trước khi lượt đóng.</p>}
                    {me.role === "guard" && <p>Được tự bảo vệ; không lặp mục tiêu hai đêm liên tiếp. Chỉ chặn Sói cắn, không chặn độc. Bỏ qua một đêm thì đêm sau được chọn lại.</p>}
                    {me.role === "seer" && <p>Không tự soi; biết mục tiêu là Sói hay không phải Sói. Kết quả chỉ bạn thấy và được lưu theo đêm.</p>}
                    {me.role === "witch" && <p>Mỗi bình dùng một lần cả ván; tối đa một bình mỗi đêm. Cứu đúng người bị Sói cắn, có thể cứu bản thân. Độc chọn người khác còn sống; độc không bị Bảo Vệ hoặc bình Cứu chặn.</p>}
                    {me.role === "hunter" && <p>Bị cắn, trúng độc hoặc bị loại đều được bắn một người còn sống khác. Chỉ một phát cả ván; bỏ qua/hết giờ thì không bắn. Chuỗi Thợ Săn xử lý xong mới xét thắng.</p>}
                    {me.role === "villager" && <p>Không có kỹ năng đêm. Ban ngày thảo luận và bỏ phiếu; không tự bỏ phiếu cho mình.</p>}
                  </details>
                  {me.teammates.length > 0 && (
                    <p>Sói đồng đội: {me.teammates.map(name).join(", ")}</p>
                  )}
                  {wolfTurn && <div className="wolf-pack" aria-label="Phối hợp riêng của Sói">
                    <h3>Đề xuất của bầy Sói</h3>
                    <p>Chạm thẻ để chia sẻ đề xuất riêng. Bấm xác nhận để chốt phiếu cắn.</p>
                    <ul>{wolfChoices.map(choice => <li key={choice.playerId}>
                      <strong>{name(choice.playerId)}</strong>
                      <span>{choice.target ? name(choice.target) : choice.locked ? "Bỏ qua" : "Chưa đề xuất"}</span>
                      <small>{choice.locked ? "Đã chốt" : "Đề xuất"}</small>
                    </li>)}</ul>
                    <p>{wolfChoices.filter(c => c.locked).length}/{wolfChoices.length} Sói đã xác nhận · Hòa phiếu cuối lượt sẽ không cắn.</p>
                    {myWolfChoice?.locked && <p>Muốn đổi? Chạm mục tiêu khác để mở lại phiếu trước khi lượt đóng.</p>}
                  </div>}
                  {!me.alive && (
                    <p>
                      Bạn đã chết. Bạn có thể theo dõi ván; chỉ Thợ Săn đến lượt
                      mới được bắn.
                    </p>
                  )}
                  {me.role === "seer" && me.findings.length > 0 && (
                    <div className="seer-result">
                      {me.findings.map((f) => (
                        <p key={`${f.round}:${f.target}`}>
                          Đêm {f.round} · {name(f.target)}:{" "}
                          <strong>
                            {f.wolf ? "MA SÓI" : "KHÔNG PHẢI MA SÓI"}
                          </strong>
                        </p>
                      ))}
                    </div>
                  )}
                  {isNight && me.role === "witch" && me.canAct && (
                    <>
                      <p>
                        Nạn nhân đêm {game.round}: <strong>{name(me.bite)}</strong>
                      </p>
                      <div className="hero-actions">
                        <Button
                          variant={potion === "save" ? "primary" : "secondary"}
                          disabled={busy || me.saveUsed || !me.bite}
                          onClick={() => {
                            setPotion("save");
                            setSelected(me.bite);
                          }}
                        >
                          Bình Cứu{me.saveUsed ? " · Đã dùng" : ""}
                        </Button>
                        <Button
                          variant={potion === "poison" ? "danger" : "secondary"}
                          disabled={busy || me.poisonUsed}
                          onClick={() => {
                            setPotion("poison");
                            setSelected(null);
                          }}
                        >
                          Bình Độc{me.poisonUsed ? " · Đã dùng" : ""}
                        </Button>
                      </div>
                      <p>
                        Bình Cứu chỉ cứu nạn nhân bị Sói cắn trong đêm này, không hồi sinh người chết từ đêm trước. Mỗi bình dùng một lần cả ván; tối đa một bình mỗi đêm.
                      </p>
                    </>
                  )}
                  {game.phase === "hunter_action" && (
                    <p>
                      Phát súng cuối cùng của{" "}
                      <strong>{name(game.hunter)}</strong>.
                    </p>
                  )}
                  </div>}
                  {choosing && (!isNight || privateVisible) && (
                    <>
                      <p>
                        {potion === "save"
                          ? `Đã chọn cứu ${name(me.bite)} trong đêm này. Bấm xác nhận bên dưới; không cần chọn người khác.`
                          : selected
                            ? `Đã chọn: ${name(selected)}.`
                            : isNight && me.role === "witch" && !potion ? "Chọn Bình Cứu hoặc Bình Độc trước. Bình Độc cần chọn thêm mục tiêu." : wolfTurn ? "Chạm thẻ để đồng đội thấy đề xuất." : "Chọn một người trên thẻ bên cạnh."}
                      </p>
                      <div className="game-action-buttons">
                      <Button
                        className="full-width"
                        disabled={
                          busy ||
                          offline ||
                          (wolfTurn && Boolean(myWolfChoice?.locked)) ||
                          (!selected && potion !== "save" && !(wolfTurn && myWolfChoice?.target)) ||
                          (isNight && me.role === "witch" && !potion)
                        }
                        onClick={() => {
                          void send(
                            isNight && me.role === "witch" ? potion! : "target",
                            selected ?? (wolfTurn ? myWolfChoice?.target ?? undefined : undefined),
                          );
                        }}
                      >
                        {game.phase === "voting"
                          ? "XÁC NHẬN PHIẾU"
                          : wolfTurn ? "XÁC NHẬN MỤC TIÊU CẮN" : isNight && me.role === "witch" && potion === "save" ? "XÁC NHẬN CỨU" : isNight && me.role === "witch" && potion === "poison" ? "XÁC NHẬN DÙNG ĐỘC" : "XÁC NHẬN LỰA CHỌN"}
                      </Button>
                      <Button
                        className="full-width"
                        variant="ghost"
                        disabled={busy || offline || me.submitted}
                        onClick={() => {
                          void send("pass");
                        }}
                      >
                        {game.phase === "hunter_action"
                          ? "Không bắn"
                          : game.phase === "voting"
                            ? "Không bỏ phiếu"
                            : "Bỏ qua hành động"}
                      </Button>
                      </div>
                    </>
                  )}
                  {!choosing && !me.submitted && game.phase !== "game_over" && <p role="status">{!me.alive ? "Bạn đang theo dõi trận đấu." : isNight ? "Chưa đến lượt của bạn. Hệ thống tự mở kỹ năng đúng lượt." : "Đang chờ giai đoạn tiếp theo."}</p>}
                  {me.submitted && (
                    <p>
                      <Check size={16} /> Đã ghi nhận trên server. Đang đợi mọi người hoàn tất.
                    </p>
                  )}
                  {game.phase === "game_over" && (
                    <>
                      {isHost ? (
                        <Button
                          disabled={busy || offline}
                          className="full-width"
                          onClick={() => {
                            void rematch();
                          }}
                        >
                          <RotateCcw size={17} /> CHƠI VÁN MỚI
                        </Button>
                      ) : (
                        <p>Đợi chủ phòng mở ván mới.</p>
                      )}
                      <Button
                        variant="ghost"
                        className="full-width"
                        onClick={onLeave}
                      >
                        <LogOut size={17} /> Rời phòng
                      </Button>
                    </>
                  )}
                </aside>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      {game.phase === "game_over" && <GameSummary game={game} />}
      </div></div>
      <div className="demo-settings">
        <button className="text-button" onClick={() => onMutedChange(!muted)}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{" "}
          {muted ? "Bật âm thanh" : "Tắt âm thanh"}
        </button>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={music}
            onChange={(e) => setMusic(e.target.checked)}
          />{" "}
          Nhạc nền nhẹ
        </label>
        {room.test_mode && (
          <span>
            Trận thử có bot · Bot chọn theo luật đơn giản, không thảo luận.
          </span>
        )}
      </div>
    </section>
  );
}

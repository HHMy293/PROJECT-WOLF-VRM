"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Moon,
  Users,
  Plus,
  KeyRound,
  BookOpen,
  Settings,
  Copy,
  Check,
  Crown,
  Wifi,
  WifiOff,
  Shield,
  Eye,
  FlaskConical,
  Target,
  Wheat,
  Swords,
  ChevronLeft,
  LogOut,
  RotateCcw,
  Sparkles,
  Play,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import OnlineGame from "@/components/online-game";
import { requestGame } from "@/lib/realtime/game-client";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { roles, roleIds, presets } from "@/lib/game/catalog";
import { ensureIdentity, getSupabase } from "@/lib/supabase/browser";
import {
  activeRoom,
  enterLobby,
  loadLobby,
  readyLobby,
  leaveLobby,
  saveLobby,
  explainLobbyError,
  type LobbySnapshot,
  type LobbySettings,
  type LobbyPlayer,
} from "@/lib/realtime/lobby";
import type { Screen, RoleId } from "@/types/game";

const icons = {
  wolf: Swords,
  villager: Wheat,
  seer: Eye,
  witch: FlaskConical,
  guard: Shield,
  hunter: Target,
};
const avatars = [Moon, Wheat, FlaskConical, Target, Eye, Shield];
const paths: Record<Screen, string> = {
  home: "/",
  create: "/tao-phong/",
  join: "/tham-gia/",
  lobby: "/phong/",
  game: "/game/",
};
function RoleIcon({ role, size = 22 }: { role: RoleId; size?: number }) {
  const Icon = icons[role];
  return <Icon size={size} />;
}
function Avatar({ player }: { player: LobbyPlayer }) {
  const Icon = avatars[player.avatar] || Moon;
  return (
    <div className={`avatar avatar-${player.avatar}`}>
      <Icon size={26} />
      <span>{player.name.slice(0, 1)}</span>
    </div>
  );
}
const initialSettings = (): LobbySettings => ({
  capacity: 8,
  mode: "quick",
  roles: presets(8),
  config_mode: "preset",
  reveal_dead: false,
});

export default function OnlineWolfApp({
  initialScreen,
  onDemo,
}: {
  initialScreen: Screen;
  onDemo: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(
    initialScreen === "lobby" || initialScreen === "game"
      ? "home"
      : initialScreen,
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [mode, setMode] = useState<"quick" | "classic">("quick");
  const [userId, setUserId] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const uidRef = useRef("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState("");
  const [online, setOnline] = useState(true);
  const [connection, setConnection] = useState<"connecting" | "live" | "retry">(
    "connecting",
  );
  const [modal, setModal] = useState<
    "guide" | "roles" | "settings" | "leave" | "qr" | null
  >(null);
  const [draft, setDraft] = useState<LobbySettings>(initialSettings);
  const [day, setDay] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(localStorage.getItem("wolf-muted") === "true"); }, []);
  function changeMuted(value: boolean) { setMuted(value); localStorage.setItem("wolf-muted", String(value)); }
  const reduce = useReducedMotion();
  const room = snapshot?.room;
  const players = snapshot?.players ?? [];
  const self = players.find((p) => p.user_id === userId);
  const isHost = Boolean(room && room.host_id === userId);
  const total = Object.values(draft.roles).reduce((a, b) => a + b, 0);
  const validDeck =
    total === draft.capacity &&
    draft.roles.wolf >= 1 &&
    draft.roles.wolf * 2 < draft.capacity &&
    draft.capacity >= players.length;
  const readyCount = players.filter((p) => p.ready).length;

  function tone() {
    if (muted) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
      oscillator.onended = () => {
        void ctx.close();
      };
    } catch {
      /* Trình duyệt có thể chặn âm thanh trước tương tác. */
    }
  }
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(explainLobbyError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function go(next: Screen) {
    if (roomId) {
      setModal("leave");
      return;
    }
    setError("");
    setScreen(next);
    tone();
  }
  async function showRoom(id: string, uid: string) {
    const next = await loadLobby(id);
    if (!next || !next.players.some((p) => p.user_id === uid))
      throw new Error("Bạn không còn trong phòng này.");
    setSnapshot(next);
    setRoomId(id);
    setCode(next.room.code);
    setScreen(next.room.status === "waiting" ? "lobby" : "game");
    const me = next.players.find((p) => p.user_id === uid);
    if (me) {
      setName(me.name);
      setAvatar(me.avatar);
    }
  }
  useEffect(() => {
    let cancelled = false;
    setOrigin(window.location.origin);
    const invited = new URLSearchParams(location.search).get("code");
    if (invited && initialScreen === "join") setCode(invited.toUpperCase());
    setOnline(navigator.onLine);
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    void (async () => {
      try {
        const db = getSupabase();
        const auth = await db.auth.getSession();
        if (auth.error) throw auth.error;
        if (!auth.data.session || cancelled) return;
        const uid = auth.data.session.user.id;
        uidRef.current = uid;
        setUserId(uid);
        const id = await activeRoom(uid);
        if (!id || cancelled) return;
        const next = await loadLobby(id);
        if (!next || cancelled) return;
        const me = next.players.find((p) => p.user_id === uid);
        if (!me) return;
        setSnapshot(next);
        setRoomId(id);
        setCode(next.room.code);
        setName(me.name);
        setAvatar(me.avatar);
        setScreen(next.room.status === "waiting" ? "lobby" : "game");
      } catch (e) {
        if (
          !cancelled &&
          (initialScreen === "lobby" || initialScreen === "game")
        )
          setError(explainLobbyError(e));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [initialScreen]);
  useEffect(() => {
    if (initializing) return;
    history.replaceState(
      null,
      "",
      paths[screen] +
        ((screen === "lobby" || screen === "game") && room
          ? `?code=${room.code}`
          : screen === "join" && /^[A-Z0-9]{6}$/.test(code)
            ? `?code=${code}`
            : ""),
    );
  }, [screen, room, code, initializing]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!roomId) return;
    const db = getSupabase();
    let cancelled = false;
    let reading = false;
    let dirty = false;
    setConnection("connecting");
    async function refresh() {
      if (cancelled) return;
      if (reading) {
        dirty = true;
        return;
      }
      reading = true;
      try {
        const next = await loadLobby(roomId!);
        if (cancelled) return;
        if (!next || !next.players.some((p) => p.user_id === uidRef.current)) {
          setRoomId(null);
          setSnapshot(null);
          setScreen("home");
          setModal(null);
          setToast(
            "Bạn không còn trong phòng này. Có thể phòng đã đóng hoặc chủ phòng đã mời bạn ra.",
          );
          return;
        }
        setSnapshot(next);
        setScreen(next.room.status === "waiting" ? "lobby" : "game");
      } catch (e) {
        if (!cancelled) {
          setConnection("retry");
          setError(explainLobbyError(e));
        }
      } finally {
        reading = false;
        if (dirty && !cancelled) {
          dirty = false;
          void refresh();
        }
      }
    }
    const channel = db
      .channel(`wolf-lobby:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wolf_rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wolf_players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        setConnection(
          status === "SUBSCRIBED"
            ? "live"
            : status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
              ? "retry"
              : "connecting",
        );
        if (status === "SUBSCRIBED") void refresh();
      });
    // Reconcile sau mất kết nối và sau khi bị kick (RLS có thể chặn sự kiện cuối).
    const heartbeat = () => {
      if (navigator.onLine) void db.rpc("wolf_heartbeat", { p_room: roomId });
    };
    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, 25000);
    const timer = setInterval(() => {
      if (navigator.onLine) void refresh();
    }, 10000);
    const focus = () => {
      if (navigator.onLine) void refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    void refresh();
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(heartbeatTimer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      void db.removeChannel(channel);
    };
  }, [roomId]);

  async function enter() {
    if (!name.trim()) {
      setError("Hãy nhập tên của bạn.");
      return;
    }
    if (screen === "join" && !/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase())) {
      setError("Mã phòng gồm đúng 6 chữ hoặc số.");
      return;
    }
    await run(async () => {
      const uid = await ensureIdentity();
      uidRef.current = uid;
      setUserId(uid);
      const id = await enterLobby(
        name.trim(),
        screen === "join" ? code.trim().toUpperCase() : null,
        8,
        mode,
        avatar,
      );
      await showRoom(id, uid);
      setToast("Bạn đã bước vào ngôi làng.");
      tone();
    });
  }
  async function copy() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `${origin}/tham-gia/?code=${room.code}`,
      );
      setToast("Đã sao chép liên kết mời.");
    } catch {
      setToast(`Hãy chia sẻ mã phòng ${room.code}.`);
    }
  }
  async function refreshAfterAction() {
    if (roomId) {
      const next = await loadLobby(roomId);
      if (next) setSnapshot(next);
    }
  }
  function openSettings() {
    if (!room || !isHost) return;
    setDraft({
      capacity: room.capacity,
      mode: room.mode,
      roles: { ...room.roles },
      config_mode: room.config_mode,
      reveal_dead: room.reveal_dead,
    });
    setError("");
    setModal("settings");
  }

  return (
    <div
      className={`wolf-app ${day && screen === "game" ? "day" : ""} ${screen === "home" ? "home-view" : screen === "game" ? "inner-view game-view" : "inner-view"}`}
    >
      <div className="world-bg" />
      <div className="world-shade" />
      <div className="fog fog-one" />
      <div className="fog fog-two" />
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${i * 6.3}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${10 + (i % 5)}s`,
            }}
          />
        ))}
      </div>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="Trang chủ Project WOLF"
        >
          <span className="brand-mark">
            <Swords size={24} />
          </span>
          <span>
            PROJECT <b>WOLF</b>
            <small>NGÔI LÀNG DƯỚI ÁNH TRĂNG</small>
          </span>
        </button>
        <nav>
          <button onClick={() => setModal("guide")}>
            <BookOpen size={16} />
            <span>Cách chơi</span>
          </button>
          <button onClick={() => setModal("roles")}>
            <Users size={16} />
            <span>Vai trò</span>
          </button>
          <span className="nav-separator" />
          <button
            className="icon-button"
            aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            onClick={() => changeMuted(!muted)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </nav>
      </header>
      {error && (
        <div className="online-error" role="alert">
          <span>{error}</span>
          <button aria-label="Đóng thông báo" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {!online && (
        <div className="online-error" role="status">
          <WifiOff size={18} /> Mất kết nối mạng. Hệ thống sẽ đồng bộ lại khi
          kết nối trở lại.
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.main
          key={screen}
          initial={reduce ? false : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
        >
          {screen === "home" && (
            <>
              <section className="hero">
                <div className="chapter">
                  <span /> MỘT NGÔI LÀNG. HAI PHE. MỘT BÌNH MINH.
                </div>
                <p className="hero-prelude">Trong đêm đen dài vô tận...</p>
                <h1>
                  AI SẼ SỐNG SÓT
                  <br />
                  ĐẾN <em>BÌNH MINH?</em>
                </h1>
                <p className="hero-copy">
                  Lời nói có thể là lời thú nhận. Sự im lặng có thể là cái bẫy.
                  <br />
                  Tin ai, nghi ngờ ai — số phận ngôi làng nằm trong tay bạn.
                </p>
                <div className="hero-actions">
                  <Button disabled={initializing} onClick={() => go("create")}>
                    <Plus size={20} /> TẠO PHÒNG
                  </Button>
                  <Button
                    disabled={initializing}
                    variant="secondary"
                    onClick={() => go("join")}
                  >
                    <KeyRound size={19} /> NHẬP MÃ PHÒNG
                  </Button>
                </div>
                <div className="hero-meta">
                  <span>
                    <Users size={15} /> 6–12 người
                  </span>
                  <i />
                  <span>
                    <Wifi size={15} /> Chơi cùng bạn bè
                  </span>
                  <i />
                  <span>
                    <Moon size={15} /> Không cần đăng ký
                  </span>
                </div>
                <p className="prototype-note">
                  {initializing
                    ? "Đang kiểm tra phiên đăng nhập..."
                    : "Trận thật từ 6–12 người · Có bot để thử nghiệm"}
                </p>
                <button className="demo-link" onClick={onDemo}>
                  Xem bản mô phỏng giao diện <Play size={13} />
                </button>
              </section>
              <div className="home-bottom">
                <span className="bottom-note">
                  <Moon size={17} /> Trăng đã lên. Ngôi làng đang chờ bạn.
                </span>
                <span>
                  SUY LUẬN <i>✦</i> ĐÁNH LỪA <i>✦</i> SINH TỒN
                </span>
              </div>
            </>
          )}
          {(screen === "create" || screen === "join") && (
            <section className="setup-section">
              <button
                className="back-link"
                disabled={busy}
                onClick={() => go("home")}
              >
                <ChevronLeft size={17} /> Trở về ngôi làng
              </button>
              <div className="setup-panel">
                <span className="eyebrow">BƯỚC VÀO CÂU CHUYỆN</span>
                <h1>
                  {screen === "create"
                    ? "Khơi đầu một đêm mới"
                    : "Ngôi làng đang chờ"}
                </h1>
                <p>
                  {screen === "create"
                    ? "Tạo phòng online và mời những người bạn."
                    : "Nhập mã phòng được bạn bè chia sẻ."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void enter();
                  }}
                >
                  <label htmlFor="name">Tên của bạn</label>
                  <input
                    id="name"
                    maxLength={24}
                    autoComplete="nickname"
                    placeholder="Bạn được gọi là gì?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                  <label>Biểu tượng của bạn</label>
                  <div
                    className="avatar-options"
                    role="group"
                    aria-label="Chọn biểu tượng"
                  >
                    {avatars.map((Icon, i) => (
                      <button
                        type="button"
                        key={i}
                        disabled={busy}
                        className={avatar === i ? "selected" : ""}
                        aria-label={`Biểu tượng ${i + 1}`}
                        aria-pressed={avatar === i}
                        onClick={() => setAvatar(i)}
                      >
                        <Icon size={22} />
                      </button>
                    ))}
                  </div>
                  {screen === "join" ? (
                    <>
                      <label htmlFor="code">Mã phòng</label>
                      <input
                        id="code"
                        maxLength={6}
                        autoComplete="off"
                        placeholder="VD: A1B2C3"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        disabled={busy}
                      />
                    </>
                  ) : (
                    <>
                      <label htmlFor="mode">Nhịp độ</label>
                      <select
                        id="mode"
                        value={mode}
                        onChange={(e) =>
                          setMode(e.target.value as "quick" | "classic")
                        }
                        disabled={busy}
                      >
                        <option value="quick">Nhanh</option>
                        <option value="classic">Cổ điển</option>
                      </select>
                      <p className="prototype-note">
                        Mặc định 8 chỗ. Chủ phòng có thể đổi từ 6 đến 12 trong
                        thiết lập.
                      </p>
                    </>
                  )}
                  <Button
                    type="submit"
                    className="full-width"
                    disabled={busy || initializing || !online}
                  >
                    {busy
                      ? "ĐANG KẾT NỐI..."
                      : screen === "create"
                        ? "TẠO PHÒNG"
                        : "THAM GIA PHÒNG"}
                  </Button>
                </form>
                <div className="prototype-note">
                  Mỗi người có phiên riêng. Tên và trạng thái được đồng bộ giữa
                  các thiết bị.
                </div>
              </div>
            </section>
          )}
          {screen === "lobby" && room?.status === "waiting" && (
            <section className="lobby-section">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">NGÔI LÀNG DƯỚI ÁNH TRĂNG</span>
                  <h1>Đêm nay, ai sẽ đến?</h1>
                  <p>Đợi những người bạn. Và cả những kẻ bạn chưa thể tin.</p>
                </div>
                <Button
                  disabled={busy}
                  variant="ghost"
                  onClick={() => setModal("leave")}
                >
                  <LogOut size={17} /> Rời phòng
                </Button>
              </div>
              <div className="lobby-grid">
                <div className="panel village-panel">
                  <div className="panel-heading">
                    <h2>
                      <Users size={19} /> Người trong làng{" "}
                      <span>
                        {players.length}/{room.capacity}
                      </span>
                    </h2>
                    <span className="connected">
                      {online && connection === "live" ? (
                        <>
                          <Wifi size={14} /> Đã đồng bộ realtime
                        </>
                      ) : (
                        <>
                          <WifiOff size={14} />{" "}
                          {online ? "Đang kết nối lại" : "Mất mạng"}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="lobby-players">
                    <AnimatePresence>
                      {players.map((p) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          key={p.id}
                          className="lobby-player"
                        >
                          <Avatar player={p} />
                          <strong>
                            {p.name}
                            {p.user_id === userId && <small> (Bạn)</small>}
                          </strong>
                          <span>
                            {p.bot && "Bot · "}
                            {p.user_id === room.host_id && (
                              <>
                                <Crown size={13} /> Chủ phòng ·{" "}
                              </>
                            )}
                            {p.ready ? (
                              <>
                                <Check size={13} /> Sẵn sàng
                              </>
                            ) : (
                              "Chưa sẵn sàng"
                            )}
                          </span>
                          {isHost && !p.bot && p.user_id !== userId && (
                            <button
                              disabled={busy || !online}
                              className="kick"
                              aria-label={`Mời ${p.name} rời phòng`}
                              onClick={() => {
                                void run(async () => {
                                  await leaveLobby(room.id, p.user_id);
                                  await refreshAfterAction();
                                  setToast(`${p.name} đã rời ngôi làng.`);
                                });
                              }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {players.length < room.capacity && (
                      <button
                        className="empty-player"
                        onClick={() => {
                          void copy();
                        }}
                      >
                        <Plus size={25} />
                        <span>Mời bạn bè vào phòng</span>
                      </button>
                    )}
                  </div>
                  <div className="lobby-story">
                    <Sparkles size={16} />
                    <span>
                      {readyCount}/{players.length} người sẵn sàng. Hãy chia sẻ
                      mã phòng để mời bạn bè.
                    </span>
                  </div>
                </div>
                <aside>
                  <div className="panel invite-panel">
                    <span className="eyebrow">MÃ NGÔI LÀNG</span>
                    <div className="room-code">{room.code}</div>
                    <p>Chia sẻ mã này với bạn bè của bạn.</p>
                    <Button
                      variant="secondary"
                      className="full-width"
                      onClick={() => {
                        void copy();
                      }}
                    >
                      <Copy size={16} /> Sao chép liên kết
                    </Button>
                    <button className="text-button" onClick={() => setModal("qr")}>Hiện mã QR</button>

                  </div>
                  <div className="panel settings-panel">
                    <div className="panel-heading">
                      <h2>
                        <Settings size={17} /> Luật của ngôi làng
                      </h2>
                      {isHost && (
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={openSettings}
                        >
                          Chỉnh
                        </button>
                      )}
                    </div>
                    <details className="lobby-rules"><summary>{room.capacity} người · {room.mode === "quick" ? "Nhanh" : "Cổ điển"} · Xem luật</summary>
                    <dl>
                      <div>
                        <dt>Chế độ</dt>
                        <dd>{room.mode === "quick" ? "Nhanh" : "Cổ điển"}</dd>
                      </div>
                      <div>
                        <dt>Thảo luận</dt>
                        <dd>{room.mode === "quick" ? "2 phút" : "5 phút"}</dd>
                      </div>
                      <div>
                        <dt>Hiện vai khi chết</dt>
                        <dd>{room.reveal_dead ? "Bật" : "Tắt"}</dd>
                      </div>
                    </dl>
                    <div className="role-chips">
                      {roleIds
                        .filter((r) => room.roles[r] > 0)
                        .map((r) => (
                          <span key={r} title={roles[r].name}>
                            <RoleIcon role={r} size={15} />
                            {room.roles[r]}
                          </span>
                        ))}
                    </div>
                    </details>
                  </div>
                  <Button
                    className="full-width"
                    variant={self?.ready ? "secondary" : "primary"}
                    disabled={busy || !online || !self}
                    onClick={() => {
                      void run(async () => {
                        await readyLobby(room.id, !self?.ready);
                        await refreshAfterAction();
                        tone();
                      });
                    }}
                  >
                    <Check size={19} />{" "}
                    {self?.ready ? "HỦY SẴN SÀNG" : "TÔI ĐÃ SẴN SÀNG"}
                  </Button>
                  {isHost && (
                    <>
                      <Button
                        className="full-width"
                        disabled={
                          busy ||
                          !online ||
                          players.length !== room.capacity ||
                          players.some((p) => !p.ready)
                        }
                        style={{ marginTop: 12 }}
                        onClick={() => {
                          void run(async () => {
                            await requestGame(room.id, { type: "start" });
                            await refreshAfterAction();
                            setScreen("game");
                          });
                        }}
                      >
                        <Moon size={19} /> BẮT ĐẦU ĐÊM ĐẦU TIÊN
                      </Button>
                      {players.length < room.capacity && (
                      <Button
                        className="full-width"
                        variant="ghost"
                        disabled={
                          busy || !online || players.length === room.capacity
                        }
                        onClick={() => {
                          void run(async () => {
                            const result = await getSupabase().rpc(
                              "wolf_test_bots",
                              { p_room: room.id, p_fill: true },
                            );
                            if (result.error) throw result.error;
                            await refreshAfterAction();
                            setToast(
                              "Đã thêm bot thử nghiệm. Bot chơi theo luật đơn giản.",
                            );
                          });
                        }}
                      >
                        Thêm bot để đủ chỗ
                      </Button>
                      )}
                      {players.some((p) => p.bot) && (
                        <Button
                          className="full-width"
                          variant="ghost"
                          disabled={busy || !online}
                          onClick={() => {
                            void run(async () => {
                              const result = await getSupabase().rpc(
                                "wolf_test_bots",
                                { p_room: room.id, p_fill: false },
                              );
                              if (result.error) throw result.error;
                              await refreshAfterAction();
                            });
                          }}
                        >
                          Xóa tất cả bot
                        </Button>
                      )}
                    </>
                  )}
                  <p className="prototype-note">
                    Đủ người và tất cả sẵn sàng để bắt đầu. Bot chỉ dùng để chơi thử.
                  </p>
                </aside>
              </div>
            </section>
          )}
          {screen === "game" && room && room.game_id && (
            <OnlineGame
              key={room.game_id}
              room={room}
              userId={userId}
              onLeave={() => setModal("leave")}
              onDay={setDay}
              muted={muted}
              onMutedChange={changeMuted}
            />
          )}
        </motion.main>
      </AnimatePresence>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
        title={
          modal === "qr"
            ? "Mời bạn vào phòng"
            : modal === "settings"
            ? "Luật của ngôi làng"
            : modal === "roles"
              ? "Những chiếc mặt nạ"
              : modal === "leave"
                ? "Rời ngôi làng?"
                : "Cách chơi"
        }
      >
        {modal === "qr" && room && <div className="qr"><QRCodeSVG value={`${origin}/tham-gia/?code=${room.code}`} size={200} /><p>Mã phòng: {room.code}</p></div>}
        {modal === "guide" && (
          <div className="settings-form">
            <p>
              Ma Sói ẩn mình trong ngôi làng. Ban đêm, mỗi vai trò thực hiện kỹ
              năng. Ban ngày, cả làng thảo luận và bỏ phiếu tìm Sói.
            </p>
            <p>
              Để thử sảnh chờ: một người tạo phòng, những người còn lại nhập
              đúng mã. Bấm Tôi đã sẵn sàng. Chủ phòng có thể điều chỉnh số chỗ
              và bộ thẻ.
            </p>
            <p>
              Trận đấu chạy theo thời gian server. Người chết chỉ theo dõi;
              vai trò và lựa chọn được giữ riêng tư.
            </p>
          </div>
        )}
        {modal === "roles" && (
          <div className="role-guide">
            {roleIds.map((r) => (
              <article key={r}>
                <div style={{ color: roles[r].color }}>
                  <RoleIcon role={r} />
                  <h3>{roles[r].name}</h3>
                </div>
                <p>{roles[r].description}</p>
              </article>
            ))}
          </div>
        )}
        {modal === "settings" && (
          <div className="settings-form">
            <label>
              Số người cho ván{" "}
              <select
                disabled={busy}
                value={draft.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    capacity,
                    roles: presets(capacity),
                    config_mode: "preset",
                  }));
                }}
              >
                {[6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n} disabled={n < players.length}>
                    {n} người
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhịp độ{" "}
              <select
                disabled={busy}
                value={draft.mode}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    mode: e.target.value as "quick" | "classic",
                  }))
                }
              >
                <option value="quick">Nhanh</option>
                <option value="classic">Cổ điển</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                disabled={busy}
                checked={draft.reveal_dead}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reveal_dead: e.target.checked,
                  }))
                }
              />{" "}
              Hiện vai trò khi chết
            </label>
            <div className="panel-heading">
              <h3>Phân bổ vai trò</h3>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    roles: presets(prev.capacity),
                    config_mode: "preset",
                  }))
                }
              >
                <RotateCcw size={15} /> Khôi phục mặc định
              </Button>
            </div>
            <p>
              {draft.config_mode === "custom"
                ? "Bộ thẻ tùy chỉnh"
                : `Bộ thẻ mặc định cho ${draft.capacity} người`}
              . Đổi số người sẽ nạp lại mặc định; sau đó bạn có thể chỉnh từng
              vai.
            </p>
            {roleIds.map((r) => (
              <label className="role-count" key={r}>
                <span>
                  <RoleIcon role={r} size={16} />
                  {roles[r].name}
                </span>
                <input
                  type="number"
                  min={0}
                  max={12}
                  disabled={busy}
                  value={draft.roles[r]}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      config_mode: "custom",
                      roles: {
                        ...prev.roles,
                        [r]: Math.max(0, Math.min(12, Number(e.target.value))),
                      },
                    }))
                  }
                />
              </label>
            ))}
            <p className="prototype-note">
              Tổng số thẻ: {total}/{draft.capacity} · Trong phòng:{" "}
              {players.length}/{draft.capacity} người
              {!validDeck && (
                <span className="error-text">
                  <br />
                  Tổng thẻ phải bằng số chỗ; có ít nhất 1 Sói và ít hơn nửa
                  phòng.
                </span>
              )}
            </p>
            <p className="prototype-note">
              Lưu thiết lập sẽ yêu cầu người chơi thật sẵn sàng lại; bot tự sẵn sàng.
            </p>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <Button
              className="full-width"
              disabled={!validDeck || busy || !online || !isHost}
              onClick={() => {
                if (!room) return;
                void run(async () => {
                  await saveLobby(room.id, draft);
                  await refreshAfterAction();
                  setModal(null);
                  setToast("Đã đồng bộ thiết lập phòng.");
                });
              }}
            >
              {busy ? "ĐANG LƯU..." : "Lưu thiết lập"}
            </Button>
          </div>
        )}
        {modal === "leave" && (
          <>
            <p>
              {isHost
                ? "Bạn sẽ rời phòng. Quyền chủ phòng sẽ được chuyển cho người còn lại; phòng trống sẽ đóng."
                : "Bạn sẽ rời phòng. Bạn có thể tham gia lại bằng mã nếu còn chỗ."}
            </p>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <div className="hero-actions">
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Ở lại
              </Button>
              <Button
                disabled={busy || !online}
                variant="danger"
                onClick={() => {
                  if (!room) return;
                  void run(async () => {
                    await leaveLobby(room.id);
                    setRoomId(null);
                    setSnapshot(null);
                    setScreen("home");
                    setModal(null);
                    setToast("Bạn đã rời ngôi làng.");
                  });
                }}
              >
                Rời phòng
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Check size={17} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

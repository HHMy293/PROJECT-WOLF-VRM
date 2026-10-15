"use client";
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Moon,
  Sun,
  Users,
  Plus,
  KeyRound,
  Volume2,
  VolumeX,
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
  Timer,
  LogOut,
  RotateCcw,
  Sparkles,
  Play,
  Skull,
  Zap,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { roles, roleIds, presets, labels } from "@/lib/game/catalog";
import {
  initialSession,
  mockPlayers,
  enterPhase,
  advance,
  canTarget,
  mockRole,
  storageKey,
} from "@/lib/game/mock";
import { Session, Screen, RoleId, Phase, Player } from "@/types/game";
const icons = {
  wolf: Swords,
  villager: Wheat,
  seer: Eye,
  witch: FlaskConical,
  guard: Shield,
  hunter: Target,
};
const avatarIcons = [Moon, Wheat, FlaskConical, Target, Eye, Shield];
function RoleIcon({ role, size = 28 }: { role: RoleId; size?: number }) {
  const Icon = icons[role];
  return <Icon size={size} />;
}
function Avatar({ p }: { p: Player }) {
  const Icon = avatarIcons[p.avatar];
  return (
    <div className={`avatar avatar-${p.avatar}`}>
      <Icon size={26} />
      <span>{p.name.slice(0, 1)}</span>
    </div>
  );
}
const destinations: Record<Screen, string> = {
  home: "/",
  create: "/tao-phong/",
  join: "/tham-gia/",
  lobby: "/phong/",
  game: "/game/",
};
export default function WolfApp({ initialScreen }: { initialScreen: Screen }) {
  const [s, setS] = useState<Session>({
    ...initialSession(),
    screen: initialScreen,
  });
  const [privateVisible, setPrivateVisible] = useState(false);
  useEffect(() => {
    const hide = () => setPrivateVisible(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("blur", hide);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("blur", hide); window.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => { setPrivateVisible(false); }, [s.phase]);
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<
    "guide" | "roles" | "settings" | "sound" | "leave" | null
  >(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [music, setMusic] = useState(false);
  const [offline, setOffline] = useState(false);
  const [qr, setQr] = useState(false);
  const [origin, setOrigin] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const reduce = useReducedMotion();
  const update = (patch: Partial<Session>) =>
    setS((prev) => ({ ...prev, ...patch }));
  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version === 1 && Array.isArray(saved.session.players)) {
          const restored = { ...initialSession(), ...saved.session };
          const code = new URLSearchParams(location.search).get("code");
          if (initialScreen === "home") setS(restored);
          else if (
            (code && restored.code === code) ||
            initialScreen === "game" ||
            initialScreen === "lobby"
          )
            setS(restored);
        }
      } else if (initialScreen === "lobby" || initialScreen === "game")
        setS((prev) => ({ ...prev, screen: "home" }));
    } catch {}
    setHydrated(true);
    const off = () => setOffline(true),
      on = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [initialScreen]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, session: s }),
    );
    const query =
      s.code && (s.screen === "lobby" || s.screen === "game")
        ? `?code=${s.code}`
        : "";
    history.replaceState(null, "", destinations[s.screen] + query);
  }, [s, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (
      s.screen !== "game" ||
      [
        "role_reveal",
        "morning",
        "vote_result",
        "game_over",
        "win_check",
      ].includes(s.phase) ||
      offline
    )
      return;
    const timer = setInterval(
      () =>
        setS((prev) => {
          if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
          return advance(prev);
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [s.screen, s.phase, offline]);
  useEffect(() => {
    if (s.phase !== "win_check") return;
    const timer = setTimeout(() => setS((prev) => advance(prev)), 1400);
    return () => clearTimeout(timer);
  }, [s.phase]);
  useEffect(() => {
    if (!music || muted) return;
    let ctx: AudioContext;
    try {
      ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0.016;
      gain.connect(ctx.destination);
      const oscs = [110, 164.81, 220].map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      return () => {
        oscs.forEach((o) => o.stop());
        gain.disconnect();
      };
    } catch {}
  }, [music, muted]);
  function sound() {
    if (muted) return;
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      ctx.resume();
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(520, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.16);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch {}
  }
  function go(screen: Screen) {
    setError("");
    update({ screen });
    sound();
  }
  function create() {
    if (!s.name.trim()) {
      setError("Hãy nhập tên của bạn.");
      return;
    }
    const code =
      s.screen === "join"
        ? s.code.trim().toUpperCase()
        : Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Mã phòng gồm đúng 6 chữ hoặc số.");
      return;
    }
    setS((prev) => ({
      ...prev,
      name: prev.name.trim(),
      code,
      screen: "lobby",
      players: mockPlayers(6, prev.name.trim()),
      capacity: 6,
      roles: presets(6),
      roleConfigMode: "preset",
      phase: "waiting",
    }));
    setToast(`${s.name.trim()} vừa bước vào ngôi làng...`);
    sound();
  }
  function start() {
    const count = Object.values(s.roles).reduce((a, b) => a + b, 0);
    if (s.players.length < 6) {
      setToast("Cần ít nhất 6 người để bắt đầu.");
      return;
    }
    if (s.players.length !== s.capacity) {
      setToast(
        `Phòng đang có ${s.players.length}/${s.capacity} người. Hãy mời đủ người hoặc giảm số người cho ván trong thiết lập.`,
      );
      return;
    }
    if (
      count !== s.players.length ||
      s.roles.wolf < 1 ||
      s.roles.wolf >= s.players.length / 2
    ) {
      setToast(
        "Tổng vai trò phải bằng số người; cần ít nhất 1 Sói và ít hơn nửa phòng.",
      );
      return;
    }
    setS((prev) => ({
      ...enterPhase(prev, "role_reveal"),
      screen: "game",
      round: 1,
      revealed: false,
      players: prev.players.map((p) => ({ ...p, alive: true })),
      usedSave: false,
      usedPoison: false,
      spectator: false,
    }));
    sound();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${origin}/tham-gia/?code=${s.code}`);
      setToast("Đã sao chép liên kết mời.");
    } catch {
      setToast("Không thể sao chép. Hãy chia sẻ mã phòng " + s.code);
    }
  }
  useEffect(() => {
    if (initialScreen === "join") {
      const code = new URLSearchParams(location.search).get("code");
      if (code) update({ code });
    }
  }, [initialScreen]);
  function endDiscussion() {
    if (offline) return;
    setS((prev) => {
      if (
        prev.screen !== "game" ||
        prev.phase !== "discussion" ||
        !prev.players.some((player) => player.id === 0 && player.host)
      )
        return prev;
      return enterPhase(prev, "voting");
    });
    sound();
  }
  function next() {
    sound();
    setS((prev) => advance(prev));
  }
  function confirm() {
    if (s.spectator) return;
    if (s.role === "witch" && s.phase === "night" && !s.potion) {
      update({ confirmed: true });
      return;
    }
    if (s.selected === null && !(s.role === "witch" && s.potion === "save"))
      return;
    sound();
    update({
      confirmed: true,
      usedSave: s.usedSave || (s.role === "witch" && s.potion === "save"),
      usedPoison: s.usedPoison || (s.role === "witch" && s.potion === "poison"),
    });
    setToast(
      s.phase === "voting"
        ? "Phiếu của bạn đã được ghi nhận."
        : "Lựa chọn đã được ghi nhận.",
    );
  }
  const day =
    ["morning", "discussion", "voting", "vote_result", "game_over"].includes(
      s.phase,
    ) && s.screen === "game";
  const roleTotal = Object.values(s.roles).reduce(
    (total, count) => total + count,
    0,
  );
  const deckValid =
    roleTotal === s.capacity &&
    s.roles.wolf >= 1 &&
    s.roles.wolf < s.capacity / 2;
  const living = s.players.filter((p) => p.alive).length;
  const role = roles[s.role];
  const timer = `${Math.floor(s.seconds / 60)
    .toString()
    .padStart(2, "0")}:${(s.seconds % 60).toString().padStart(2, "0")}`;
  const title =
    s.phase === "night"
      ? `Đêm thứ ${s.round}`
      : s.phase === "voting"
        ? s.runoff.length
          ? "Lá phiếu quyết định"
          : "Ai là Ma Sói?"
        : labels[s.phase];
  const selectable =
    s.phase === "night" || s.phase === "voting" || s.phase === "hunter_action";
  function playerCard(p: Player) {
    const enabled = selectable && canTarget(s, p.id) && !s.confirmed;
    return (
      <motion.button
        layout
        key={p.id}
        type="button"
        className={`player-card ${!p.alive ? "dead" : ""} ${s.selected === p.id ? "selected" : ""} ${enabled ? "targetable" : ""}`}
        disabled={!enabled}
        onClick={() => {
          update({ selected: p.id });
          sound();
        }}
        aria-label={`${p.name}${p.alive ? ", còn sống" : ", đã chết"}`}
        aria-pressed={s.selected === p.id}
      >
        <Avatar p={p} />
        <strong>
          {p.name}
          {p.id === 0 && <small> (Bạn)</small>}
        </strong>
        <span className="player-status">
          {!p.alive ? (
            <>
              <Skull size={12} /> Đã chết
            </>
          ) : s.phase === "voting" ? (
            p.id === 0 && s.confirmed ? (
              <>
                <Check size={12} /> Đã bỏ phiếu
              </>
            ) : (
              "Đang chọn..."
            )
          ) : (
            <>
              <span className="status-dot" /> Còn sống
            </>
          )}
        </span>
        {s.selected === p.id && <Check className="selection-check" size={18} />}
      </motion.button>
    );
  }
  return (
    <div
      className={`wolf-app ${day ? "day" : ""} ${s.screen === "home" ? "home-view" : "inner-view"}`}
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
          onClick={() => (s.screen === "game" ? setModal("leave") : go("home"))}
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
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button
            className="icon-button"
            aria-label="Thiết lập âm thanh"
            onClick={() => setModal("sound")}
          >
            <Settings size={19} />
          </button>
        </nav>
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          key={s.screen}
          initial={reduce ? false : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
        >
          {s.screen === "home" && (
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
                  <Button onClick={() => go("create")}>
                    <Plus size={20} /> TẠO PHÒNG
                  </Button>
                  <Button variant="secondary" onClick={() => go("join")}>
                    <KeyRound size={19} /> NHẬP MÃ PHÒNG
                  </Button>
                </div>
                <div className="hero-meta">
                  <span>
                    <Users size={15} /> 6–12 người
                  </span>
                  <i />
                  <span>
                    <Zap size={15} /> Không cần cài đặt
                  </span>
                  <i />
                  <span>
                    <Moon size={15} /> Chơi ngay trên trình duyệt
                  </span>
                </div>
                <button
                  className="demo-link"
                  onClick={() => {
                    setS((prev) => ({
                      ...prev,
                      name: "Steven",
                      code: "WOLF01",
                      screen: "lobby",
                      players: mockPlayers(8, "Steven"),
                      capacity: 8,
                      roles: presets(8),
                      roleConfigMode: "preset",
                    }));
                  }}
                >
                  Khám phá một ngôi làng thử nghiệm <Play size={13} />
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
          {(s.screen === "create" || s.screen === "join") && (
            <section className="setup-section">
              <button className="back-link" onClick={() => go("home")}>
                <ChevronLeft size={17} /> Trở về ngôi làng
              </button>
              <div className="setup-panel">
                <span className="eyebrow">BƯỚC VÀO CÂU CHUYỆN</span>
                <h1>
                  {s.screen === "create"
                    ? "Khơi đầu một đêm mới"
                    : "Ngôi làng đang chờ"}
                </h1>
                <p>
                  {s.screen === "create"
                    ? "Tập hợp những người bạn. Để sự nghi ngờ bắt đầu."
                    : "Nhập mã phòng được bạn bè chia sẻ."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    create();
                  }}
                >
                  <label htmlFor="name">Tên của bạn</label>
                  <input
                    id="name"
                    placeholder="Bạn được gọi là gì?"
                    autoComplete="nickname"
                    value={s.name}
                    maxLength={20}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                  {s.screen === "join" ? (
                    <>
                      <label htmlFor="code">Mã phòng</label>
                      <input
                        id="code"
                        className="code-input"
                        placeholder="VD: WOLF01"
                        maxLength={6}
                        value={s.code}
                        onChange={(e) =>
                          update({
                            code: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <label>Nhịp độ trò chơi</label>
                      <div className="mode-options">
                        {(["quick", "classic"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={
                              s.mode === m
                                ? "mode-option active"
                                : "mode-option"
                            }
                            aria-pressed={s.mode === m}
                            onClick={() => update({ mode: m })}
                          >
                            {m === "quick" ? <Zap /> : <Moon />}
                            <strong>
                              {m === "quick" ? "Nhanh" : "Cổ điển"}
                            </strong>
                            <span>
                              {m === "quick"
                                ? "10–20 phút · Đề xuất"
                                : "30–60 phút · Suy luận sâu"}
                            </span>
                            {s.mode === m && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {error && (
                    <p role="alert" className="error-text">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="full-width">
                    {s.screen === "create" ? (
                      <Plus size={19} />
                    ) : (
                      <KeyRound size={19} />
                    )}{" "}
                    {s.screen === "create" ? "TẠO PHÒNG" : "THAM GIA PHÒNG"}
                  </Button>
                </form>
                <div className="prototype-note">
                  Bản trải nghiệm giao diện · Phòng và người chơi được mô phỏng
                  trên thiết bị này.
                </div>
              </div>
            </section>
          )}
          {s.screen === "lobby" && (
            <section className="lobby-section">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">NGÔI LÀNG DƯỚI ÁNH TRĂNG</span>
                  <h1>Đêm nay, ai sẽ đến?</h1>
                  <p>Đợi những người bạn. Và cả những kẻ bạn chưa thể tin.</p>
                </div>
                <Button variant="ghost" onClick={() => setModal("leave")}>
                  <LogOut size={17} /> Rời phòng
                </Button>
              </div>
              <div className="lobby-grid">
                <div className="panel village-panel">
                  <div className="panel-heading">
                    <h2>
                      <Users size={19} /> Người trong làng{" "}
                      <span>
                        {s.players.length}/{s.capacity}
                      </span>
                    </h2>
                    <span className="connected">
                      <Wifi size={14} /> Đã kết nối
                    </span>
                  </div>
                  <div className="lobby-players">
                    <AnimatePresence>
                      {s.players.map((p) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          key={p.id}
                          className="lobby-player"
                        >
                          <Avatar p={p} />
                          <strong>{p.name}</strong>
                          <span>
                            {p.host ? (
                              <>
                                <Crown size={13} /> Chủ phòng
                              </>
                            ) : p.ready ? (
                              <>
                                <Check size={13} /> Sẵn sàng
                              </>
                            ) : (
                              "Chưa sẵn sàng"
                            )}
                          </span>
                          {p.id !== 0 && (
                            <button
                              className="kick"
                              aria-label={`Mời ${p.name} rời phòng`}
                              onClick={() => {
                                const players = s.players.filter(
                                  (x) => x.id !== p.id,
                                );
                                update({ players });
                                setToast(`${p.name} đã rời ngôi làng.`);
                              }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {s.players.length < s.capacity && (
                      <button
                        className="empty-player"
                        onClick={() => {
                          const all = mockPlayers(s.capacity, s.name);
                          const p = all.find(
                            (p) => !s.players.some((x) => x.id === p.id),
                          );
                          if (p) {
                            const players = [...s.players, p];
                            update({ players });
                            setToast(`${p.name} vừa bước vào ngôi làng...`);
                          }
                        }}
                      >
                        <Plus size={25} />
                        <span>Thêm người mô phỏng</span>
                      </button>
                    )}
                  </div>
                  <div className="lobby-story">
                    <Sparkles size={16} />
                    <span>
                      Lửa đã cháy trong những căn nhà. Còn đủ chỗ cho những câu
                      chuyện mới.
                    </span>
                  </div>
                </div>
                <aside>
                  <div className="panel invite-panel">
                    <span className="eyebrow">MÃ NGÔI LÀNG</span>
                    <div className="room-code">{s.code}</div>
                    <p>Chia sẻ mã này với bạn bè của bạn.</p>
                    <Button
                      variant="secondary"
                      className="full-width"
                      onClick={copy}
                    >
                      <Copy size={16} /> Sao chép liên kết
                    </Button>
                    <button className="text-button" onClick={() => setQr(!qr)}>
                      {qr ? "Ẩn mã QR" : "Hiện mã QR"}
                    </button>
                    {qr && (
                      <div className="qr">
                        <QRCodeSVG
                          value={`${origin}/tham-gia/?code=${s.code}`}
                          size={160}
                        />
                      </div>
                    )}
                  </div>
                  <div className="panel settings-panel">
                    <div className="panel-heading">
                      <h2>
                        <Settings size={17} /> Luật của ngôi làng
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setModal("settings")}
                      >
                        Chỉnh
                      </button>
                    </div>
                    <dl>
                      <div>
                        <dt>Chế độ</dt>
                        <dd>{s.mode === "quick" ? "Nhanh" : "Cổ điển"}</dd>
                      </div>
                      <div>
                        <dt>Thảo luận</dt>
                        <dd>{s.mode === "quick" ? "2 phút" : "5 phút"}</dd>
                      </div>
                      <div>
                        <dt>Hiện vai khi chết</dt>
                        <dd>{s.revealDead ? "Bật" : "Tắt"}</dd>
                      </div>
                    </dl>
                    <div className="role-chips">
                      {roleIds
                        .filter((r) => s.roles[r] > 0)
                        .map((r) => (
                          <span key={r} title={roles[r].name}>
                            <RoleIcon role={r} size={15} />
                            {s.roles[r]}
                          </span>
                        ))}
                    </div>
                  </div>
                  <Button className="full-width" onClick={start}>
                    <Moon size={19} /> BẮT ĐẦU ĐÊM ĐẦU TIÊN
                  </Button>
                  <p className="prototype-note">
                    {s.players.length} người đã sẵn sàng · Mô phỏng trên thiết
                    bị này
                  </p>
                </aside>
              </div>
              <div className="demo-settings">
                <span>Trải nghiệm vai trò:</span>
                <select
                  aria-label="Vai trò trải nghiệm"
                  value={s.role}
                  onChange={(e) => update({ role: e.target.value as RoleId })}
                >
                  {roleIds.map((r) => (
                    <option key={r} value={r}>
                      {roles[r].name}
                    </option>
                  ))}
                </select>
                <span>Chỉ áp dụng cho bản mô phỏng.</span>
              </div>
            </section>
          )}
          {s.screen === "game" && (
            <section className="game-section">
              <div className="game-status">
                <span>
                  {day ? <Sun size={16} /> : <Moon size={16} />}{" "}
                  {labels[s.phase]} · Vòng {s.round}
                </span>
                <span>
                  <Users size={16} />
                  {living}/{s.players.length} còn sống
                </span>
                <span className={s.seconds <= 10 ? "urgent" : ""}>
                  <Timer size={16} />
                  {timer}
                </span>
                <button
                  aria-label="Rời phòng"
                  onClick={() => setModal("leave")}
                >
                  <LogOut size={16} />
                </button>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={s.phase + s.round}
                  className="phase-content"
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {s.phase === "role_reveal" ? (
                    <div className="reveal-screen">
                      <span className="eyebrow">
                        MỘT BÍ MẬT CHỈ DÀNH CHO BẠN
                      </span>
                      <h1>Chiếc mặt nạ của bạn</h1>
                      <p>Đừng để ánh mắt bên cạnh nhìn thấy.</p>
                      <button
                        className={`flip-card ${s.revealed ? "flipped" : ""}`}
                        onClick={() => {
                          update({ revealed: !s.revealed });
                          sound();
                        }}
                        aria-label={
                          s.revealed ? "Úp thẻ vai trò" : "Nhấn để xem vai trò"
                        }
                      >
                        <div className="flip-inner">
                          <div className="card-back">
                            <div className="card-ornament">
                              <Swords size={70} />
                            </div>
                            <span>PROJECT WOLF</span>
                            <strong>NHẤN ĐỂ XEM</strong>
                            <small>Số phận đã chọn bạn.</small>
                          </div>
                          <div
                            className="card-front"
                            style={
                              {
                                "--role-color": role.color,
                              } as React.CSSProperties
                            }
                          >
                            <span className="eyebrow">{role.team}</span>
                            <RoleIcon role={s.role} size={80} />
                            <h2>{role.name}</h2>
                            <p>{role.flavor}</p>
                          </div>
                        </div>
                      </button>
                      {s.revealed && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="reveal-detail"
                        >
                          <p>{role.description}</p>
                          {s.role === "wolf" && (
                            <span className="wolf-teammate">
                              Đồng đội của bạn: Minh
                            </span>
                          )}
                          <Button onClick={next}>
                            <Moon size={17} /> Tôi đã hiểu vai trò
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  ) : s.phase === "morning" ? (
                    <div className="cinematic-screen">
                      <Sun className="cinematic-symbol dawn-symbol" size={65} />
                      <span className="eyebrow">ĐÊM QUA...</span>
                      <h1>
                        {s.result === null
                          ? "Một đêm bình yên"
                          : `${s.players.find((p) => p.id === s.result)?.name} đã chết`}
                      </h1>
                      <p>
                        {s.result === null
                          ? "Không có ai chết đêm qua. Nhưng bóng tối vẫn chưa rời đi."
                          : "Một ngọn đèn đã tắt. Ngôi làng thức dậy trong sự ngờ vực."}
                      </p>
                      {s.revealDead && s.result !== null && (
                        <div className="revealed-dead">
                          <RoleIcon role={mockRole(s.result, s)} />
                          {roles[mockRole(s.result, s)].name}
                        </div>
                      )}
                      <Button onClick={next}>Bắt đầu thảo luận</Button>
                    </div>
                  ) : s.phase === "vote_result" ? (
                    <div className="result-screen">
                      <span className="eyebrow">LÁ PHIẾU ĐÃ ĐƯỢC MỞ</span>
                      <h1>
                        {s.result === null
                          ? "Không ai bị loại"
                          : `${s.players.find((p) => p.id === s.result)?.name} đã bị dân làng loại`}
                      </h1>
                      <p>
                        {s.result === null
                          ? "Phiếu phụ vẫn hòa. Ngôi làng bước vào một đêm mới."
                          : "Một quyết định. Một số phận. Liệu ngôi làng đã đúng?"}
                      </p>
                      <div className="vote-bars">
                        {s.players
                          .filter(
                            (p) => p.id === s.result || (p.alive && p.id !== 0),
                          )
                          .slice(0, 4)
                          .map((p, i) => (
                            <div key={p.id}>
                              <span>{p.name}</span>
                              <div>
                                <motion.i
                                  initial={{ width: 0 }}
                                  animate={{
                                    width:
                                      s.result === null
                                        ? "50%"
                                        : p.id === s.result
                                          ? "82%"
                                          : `${25 - i * 4}%`,
                                  }}
                                  transition={{ duration: 0.8, delay: i * 0.1 }}
                                />
                              </div>
                              <strong>
                                {s.result === null
                                  ? 2
                                  : p.id === s.result
                                    ? 5
                                    : 1}
                              </strong>
                            </div>
                          ))}
                      </div>
                      {s.revealDead && s.result !== null && (
                        <div className="revealed-dead">
                          <RoleIcon role={mockRole(s.result, s)} />
                          {roles[mockRole(s.result, s)].name}
                        </div>
                      )}
                      <Button onClick={next}>Tiếp tục câu chuyện</Button>
                    </div>
                  ) : s.phase === "game_over" ? (
                    <div
                      className={`victory-screen ${s.winner === "wolf" ? "wolf-victory" : ""}`}
                    >
                      <div className="victory-emblem">
                        {s.winner === "village" ? (
                          <Sun size={70} />
                        ) : (
                          <Swords size={70} />
                        )}
                      </div>
                      <span className="eyebrow">
                        {s.winner === "village"
                          ? "BÌNH MINH ĐÃ ĐẾN"
                          : "BÓNG TỐI BAO TRÙM"}
                      </span>
                      <h1>
                        {s.winner === "village"
                          ? "Phe Làng chiến thắng"
                          : "Ma Sói đã chiếm ngôi làng"}
                      </h1>
                      <p>
                        {s.winner === "village"
                          ? "Những người ở lại đã tìm thấy ánh sáng."
                          : "Ngôi làng ngủ yên. Lần này, mãi mãi."}
                      </p>
                      <div className="final-roles">
                        {s.players.map((p) => (
                          <div key={p.id}>
                            <RoleIcon role={mockRole(p.id, s)} />
                            <strong>{p.name}</strong>
                            <span>{roles[mockRole(p.id, s)].name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="hero-actions">
                        <Button
                          onClick={() => {
                            update({
                              screen: "lobby",
                              phase: "waiting",
                              players: mockPlayers(s.players.length, s.name),
                            });
                          }}
                        >
                          <RotateCcw size={17} /> Chơi ván mới
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setS(initialSession());
                          }}
                        >
                          <LogOut size={17} /> Rời phòng
                        </Button>
                      </div>
                    </div>
                  ) : s.phase === "win_check" ? (
                    <div className="cinematic-screen">
                      <div className="loading-orbit" />
                      <h1>Ngôi làng nín thở...</h1>
                      <p>Ánh sáng hay bóng tối sẽ ở lại?</p>
                    </div>
                  ) : (
                    <>
                      <div className="game-heading">
                        <span className="eyebrow">
                          {s.phase === "discussion"
                            ? "HÃY LẮNG NGHE. HÃY NGHI NGỜ."
                            : s.phase === "voting"
                              ? "SỐ PHẬN NẰM TRONG LÁ PHIẾU"
                              : s.phase === "hunter_action"
                                ? "MỘT CƠ HỘI CUỐI CÙNG"
                                : "NHỮNG THẾ LỰC TRONG MÀN ĐÊM ĐANG HÀNH ĐỘNG"}
                        </span>
                        <h1>{title}</h1>
                        <p>
                          {s.spectator
                            ? "Bạn đang theo dõi. Hãy giữ bí mật để câu chuyện tiếp tục."
                            : s.phase === "night" && !privateVisible
                              ? "Thông tin riêng đang được che. Mở bảng vai trò để xem kỹ năng."
                            : s.phase === "discussion"
                              ? "Trao đổi trực tiếp với bạn bè. Ai đang che giấu điều gì?"
                              : s.phase === "voting"
                                ? "Chọn người bạn nghi ngờ nhất. Phiếu được giữ kín đến khi đóng."
                                : s.phase === "hunter_action"
                                  ? "Thợ Săn đã ngã xuống. Chọn một người chết cùng hoặc không bắn."
                                  : s.role === "villager" || s.role === "hunter"
                                    ? "Hãy ngủ thật ngon... nếu bạn có thể."
                                    : `${privateVisible ? role.name : "Hành động ban đêm"} — ${s.role === "wolf" ? "Hãy chọn con mồi đêm nay." : s.role === "seer" ? "Bạn muốn nhìn thấu ai đêm nay?" : s.role === "guard" ? "Bạn sẽ bảo vệ ai đêm nay?" : "Một lựa chọn có thể đổi số phận."}`}
                        </p>
                      </div>
                      <div className="game-grid">
                        <aside className="panel role-sidebar">
                          <span className="eyebrow">
                            {s.spectator
                              ? "CHẾ ĐỘ THEO DÕI"
                              : "VAI TRÒ CỦA BẠN"}
                          </span>
                          <button className="privacy-toggle" aria-expanded={privateVisible} onClick={() => setPrivateVisible(v => !v)}>{privateVisible ? "Ẩn vai trò và kỹ năng" : "Xem vai trò và kỹ năng"}</button>
                          {!privateVisible && <p>Thông tin riêng đã được che. Nhấn để xem và nhấn lần nữa để ẩn.</p>}
                          <div hidden={!privateVisible}>
                          <div
                            className="small-role"
                            style={{ color: role.color }}
                          >
                            <RoleIcon role={s.role} size={40} />
                            <h2>{role.name}</h2>
                            <span>{role.team}</span>
                          </div>
                          <p>{role.description}</p>
                          {s.phase === "night" &&
                            s.role === "witch" &&
                            !s.spectator && (
                              <div className="potions">
                                <button
                                  disabled={
                                    s.usedSave ||
                                    s.confirmed ||
                                    !s.players.find(
                                      (p) => p.id === 2 && p.alive,
                                    )
                                  }
                                  className={
                                    s.potion === "save" ? "active" : ""
                                  }
                                  onClick={() =>
                                    update({ potion: "save", selected: 2 })
                                  }
                                >
                                  <FlaskConical size={18} /> Bình Cứu{" "}
                                  {s.usedSave ? "· Đã dùng" : ""}
                                </button>
                                <button
                                  disabled={s.usedPoison || s.confirmed}
                                  className={
                                    s.potion === "poison" ? "active poison" : ""
                                  }
                                  onClick={() =>
                                    update({ potion: "poison", selected: null })
                                  }
                                >
                                  <FlaskConical size={18} /> Bình Độc{" "}
                                  {s.usedPoison ? "· Đã dùng" : ""}
                                </button>
                                <small>
                                  {s.players.find((p) => p.id === 2 && p.alive)
                                    ? "Trang đang bị Sói cắn."
                                    : "Không có người bị Sói cắn trong lượt mô phỏng này."}
                                </small>
                              </div>
                            )}
                          {s.phase === "night" && s.role === "wolf" && (
                            <div className="wolf-teammate">
                              Minh là Sói đồng đội.
                            </div>
                          )}
                          </div>
                          <div className="private-note">
                            <Shield size={14} /> Chỉ mình bạn nhìn thấy lựa chọn
                            này.
                          </div>
                        </aside>
                        <div>
                          <div className="players-grid">
                            {s.players.map(playerCard)}
                          </div>
                          <div className="action-panel">
                            {s.confirmed ? (
                              <>
                                <Check size={22} />
                                <span>
                                  {s.phase === "voting"
                                    ? "Bạn đã bỏ phiếu. Đợi ngôi làng quyết định."
                                    : s.role === "seer"
                                      ? "Kết quả soi mô phỏng: " +
                                        (s.selected === 1
                                          ? "MA SÓI"
                                          : "KHÔNG PHẢI MA SÓI")
                                      : "Đã ghi nhận. Hãy giữ bí mật của bạn."}
                                </span>
                              </>
                            ) : s.spectator ? (
                              <>
                                <Eye size={22} />
                                <span>
                                  Bạn có thể theo dõi diễn biến, không thể hành
                                  động.
                                </span>
                              </>
                            ) : s.phase === "discussion" ? (
                              <>
                                <Timer size={22} />
                                <span>
                                  Thảo luận kết thúc khi hết giờ hoặc chủ phòng
                                  mở bỏ phiếu.
                                </span>
                              </>
                            ) : s.phase === "night" &&
                              ["villager", "hunter"].includes(s.role) ? (
                              <>
                                <Moon size={22} />
                                <span>Hãy chờ bình minh...</span>
                              </>
                            ) : (
                              <>
                                <span>
                                  {s.selected !== null
                                    ? `Bạn đã chọn: ${s.players.find((p) => p.id === s.selected)?.name}`
                                    : "Chọn một người trong ngôi làng."}
                                </span>
                                <Button
                                  disabled={
                                    s.selected === null &&
                                    !(s.role === "witch" && s.potion === "save")
                                  }
                                  onClick={confirm}
                                >
                                  <Check size={17} />
                                  {s.phase === "voting"
                                    ? "Xác nhận phiếu"
                                    : s.phase === "hunter_action"
                                      ? "Xác nhận phát súng"
                                      : "Xác nhận lựa chọn"}
                                </Button>
                              </>
                            )}
                            {s.phase === "discussion" &&
                              s.players.some(
                                (player) => player.id === 0 && player.host,
                              ) && (
                                <Button
                                  onClick={endDiscussion}
                                  disabled={offline}
                                  title="Chỉ chủ phòng có thể kết thúc thảo luận sớm để mở bỏ phiếu."
                                >
                                  <Check size={17} />
                                  Kết thúc thảo luận
                                </Button>
                              )}
                            {s.phase === "hunter_action" && (
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setS((prev) =>
                                    advance({ ...prev, selected: null }),
                                  )
                                }
                              >
                                Không bắn
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="prototype-controls">
                <span>
                  <Sparkles size={14} /> Điều khiển bản mô phỏng
                </span>
                {![
                  "role_reveal",
                  "discussion",
                  "win_check",
                  "game_over",
                ].includes(s.phase) && (
                  <button onClick={next}>
                    {s.phase === "night"
                      ? "Đến bình minh"
                      : s.phase === "discussion"
                        ? "Mở bỏ phiếu"
                        : s.phase === "voting"
                          ? "Đóng bỏ phiếu"
                          : "Chuyển cảnh"}
                  </button>
                )}
                {s.phase === "voting" && (
                  <button
                    onClick={() => {
                      if (s.runoffRound) {
                        setS((prev) => ({
                          ...enterPhase(prev, "vote_result"),
                          result: null,
                        }));
                        return;
                      }
                      const candidates = s.players
                        .filter((p) => p.alive && p.id !== 0)
                        .slice(0, 2)
                        .map((p) => p.id);
                      update({
                        runoff: candidates,
                        runoffRound: true,
                        selected: null,
                        confirmed: false,
                        seconds: 30,
                      });
                      setToast("Phiếu hòa. Bỏ phiếu phụ giữa hai người hòa.");
                    }}
                  >
                    {s.runoffRound
                      ? "Mô phỏng hòa lần nữa"
                      : "Mô phỏng phiếu hòa"}
                  </button>
                )}
                {s.phase === "night" && (
                  <button
                    onClick={() =>
                      setS((prev) => ({
                        ...enterPhase(prev, "morning"),
                        result: null,
                      }))
                    }
                  >
                    Đêm bình yên
                  </button>
                )}
                <button
                  onClick={() =>
                    update({
                      spectator: !s.spectator,
                      players: s.players.map((p) =>
                        p.id === 0 ? { ...p, alive: s.spectator } : p,
                      ),
                    })
                  }
                >
                  {s.spectator ? "Trở lại người chơi" : "Xem khi đã chết"}
                </button>
                <button onClick={() => setOffline(true)}>
                  Thử mất kết nối
                </button>
                {s.phase === "game_over" && (
                  <button
                    onClick={() =>
                      update({
                        winner: s.winner === "village" ? "wolf" : "village",
                      })
                    }
                  >
                    Xem chiến thắng phe{" "}
                    {s.winner === "village" ? "Sói" : "Làng"}
                  </button>
                )}
              </div>
            </section>
          )}
        </motion.main>
      </AnimatePresence>
      {s.screen !== "home" && (
        <footer className="inner-footer">
          <span>PROJECT WOLF</span>
          <span>Bản trải nghiệm giao diện · Chưa kết nối nhiều người chơi</span>
          <span>Trăng vẫn đang dõi theo.</span>
        </footer>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(o) => !o && setModal(null)}
        title={
          modal === "guide"
            ? "Cách chơi Ma Sói"
            : modal === "roles"
              ? "Những chiếc mặt nạ"
              : modal === "settings"
                ? "Luật của ngôi làng"
                : modal === "leave"
                  ? "Rời ngôi làng?"
                  : "Âm thanh"
        }
      >
        {modal === "guide" && (
          <div className="guide">
            <p>
              6–12 người chơi, hai phe đối đầu. Nói chuyện trực tiếp với nhau;
              trò chơi dẫn dắt các lượt.
            </p>
            {[
              [
                "01",
                "Nhận vai trò",
                "Giữ kín chiếc mặt nạ. Sói biết đồng đội, những người khác chỉ biết vai của mình.",
              ],
              [
                "02",
                "Khi màn đêm xuống",
                "Các vai thực hiện kỹ năng. Thứ tự: Bảo Vệ → Ma Sói → Tiên Tri → Phù Thủy.",
              ],
              [
                "03",
                "Khi bình minh lên",
                "Lắng nghe kết quả, thảo luận và bỏ phiếu. Hòa thì bỏ phiếu phụ; hòa lần nữa không ai bị loại.",
              ],
              [
                "04",
                "Một phe sẽ ở lại",
                "Phe Làng thắng khi hết Sói. Sói thắng khi số Sói còn sống ≥ số người phe Làng.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <b>{n}</b>
                <section>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </section>
              </div>
            ))}
            <p className="prototype-note">
              Phase 1 mô phỏng màn hình và kết quả. Chưa hỗ trợ phòng online
              thật.
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
                value={s.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  if (capacity < s.players.length) {
                    setToast(
                      "Hãy mời bớt người rời phòng trước khi giảm số người cho ván.",
                    );
                    return;
                  }
                  update({
                    capacity,
                    roles: presets(capacity),
                    roleConfigMode: "preset",
                  });
                }}
              >
                {[6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n} disabled={n < s.players.length}>
                    {n} người
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhịp độ{" "}
              <select
                value={s.mode}
                onChange={(e) =>
                  update({ mode: e.target.value as Session["mode"] })
                }
              >
                <option value="quick">Nhanh</option>
                <option value="classic">Cổ điển</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={s.revealDead}
                onChange={(e) => update({ revealDead: e.target.checked })}
              />{" "}
              Hiện vai trò khi chết
            </label>
            <div className="panel-heading" style={{ marginBottom: 0 }}>
              <h3>Phân bổ vai trò</h3>
              <Button
                variant="ghost"
                onClick={() =>
                  update({
                    roles: presets(s.capacity),
                    roleConfigMode: "preset",
                  })
                }
              >
                <RotateCcw size={15} /> Khôi phục mặc định
              </Button>
            </div>
            <p style={{ margin: 0 }}>
              {s.roleConfigMode === "custom"
                ? "Bộ thẻ tùy chỉnh"
                : `Bộ thẻ mặc định cho ${s.capacity} người`}
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
                  value={s.roles[r]}
                  onChange={(e) =>
                    update({
                      roleConfigMode: "custom",
                      roles: {
                        ...s.roles,
                        [r]: Math.max(0, Math.min(12, Number(e.target.value))),
                      },
                    })
                  }
                />
              </label>
            ))}
            <p className="prototype-note">
              Tổng số thẻ: {roleTotal}/{s.capacity} · Trong phòng:{" "}
              {s.players.length}/{s.capacity} người
              {roleTotal !== s.capacity && (
                <span className="error-text">
                  <br />
                  {roleTotal < s.capacity
                    ? `Còn thiếu ${s.capacity - roleTotal} lá thẻ.`
                    : `Dư ${roleTotal - s.capacity} lá thẻ.`}
                </span>
              )}
              {(s.roles.wolf < 1 || s.roles.wolf >= s.capacity / 2) && (
                <span className="error-text">
                  <br />
                  Cần ít nhất 1 Ma Sói và ít hơn một nửa số người.
                </span>
              )}
            </p>
            <Button
              className="full-width"
              disabled={!deckValid}
              onClick={() => setModal(null)}
            >
              Lưu thiết lập
            </Button>
          </div>
        )}
        {modal === "sound" && (
          <div className="settings-form">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!muted}
                onChange={(e) => setMuted(!e.target.checked)}
              />{" "}
              Hiệu ứng âm thanh
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={music}
                onChange={(e) => setMusic(e.target.checked)}
              />{" "}
              Nhạc nền nhẹ
            </label>
            <p>
              Mặc định nhạc nền tắt, hiệu ứng bật. Âm thanh bắt đầu sau thao tác
              của bạn.
            </p>
          </div>
        )}
        {modal === "leave" && (
          <>
            <p>
              Phiên thử trên thiết bị này sẽ kết thúc. Bạn có thể tạo một ngôi
              làng mới bất cứ lúc nào.
            </p>
            <div className="hero-actions">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Ở lại
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setS(initialSession());
                  setModal(null);
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
      <Dialog open={offline} onOpenChange={() => {}} title="Mất kết nối">
        <div className="reconnect">
          <WifiOff size={45} />
          <div className="loading-orbit" />
          <h3>Đang kết nối lại...</h3>
          <p>Nhân vật và lượt hiện tại vẫn được lưu trên thiết bị.</p>
          <Button
            onClick={() => {
              if (navigator.onLine) {
                setOffline(false);
                setToast("Đã khôi phục phiên trải nghiệm.");
              } else setToast("Thiết bị vẫn đang mất mạng.");
            }}
          >
            Thử kết nối lại
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

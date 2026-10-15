"use client";
import { useState } from "react";
import { roles } from "@/lib/game/catalog";
import type { PublicGame, TurnHistory } from "@/lib/game-engine/types";
const actionLabels: Record<string,string> = {target:"Chọn",save:"Cứu khỏi Sói cắn",poison:"Dùng bình Độc",pass:"Bỏ qua",unsubmitted:"Chưa xác nhận · hết giờ/Skip"};
const stageLabels: Record<string,string> = {guard:"Bảo Vệ",wolf:"Ma Sói",seer:"Tiên Tri",witch:"Phù Thủy"};
export default function GameSummary({game}:{game:PublicGame}) {
 const [round,setRound]=useState("all");
 const name=(id?:string)=>game.players.find(p=>p.id===id)?.name??"Không có";
 const history=game.history??[];
 const rounds=[...new Set(history.map(t=>t.round))];
 const winners=game.players.filter(p=>game.winnerIds?.includes(p.id));
 function outcome(o:TurnHistory["outcomes"][number]) {
  const n=name(o.target);
  return ({bite:`Bầy Sói chọn cắn ${n}`,protected:`${n} được Bảo Vệ chặn Sói cắn`,saved:`${n} được bình Cứu cứu khỏi Sói cắn (không chặn Độc)`,wolf_kill:`${n} chết do Sói cắn`,poison_kill:`${name(o.actor)} dùng Độc giết ${n}`,hunter_kill:`${name(o.actor)} bắn, kéo ${n} chết theo`,vote_kill:`${n} bị bỏ phiếu loại`,no_kill:"Không có người chết do hành động này"})[o.kind];
 }
 function exportLog() {
  const blob=new Blob([JSON.stringify({game,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=`WOLF-${game.id}-tong-ket.json`;a.click();URL.revokeObjectURL(url);
 }
 return <section className="panel game-summary" aria-label="Tổng kết trận đấu">
  <div className="panel-heading"><h2>Tổng kết trận đấu</h2><button className="text-button" onClick={exportLog}>Tải lịch sử JSON</button></div>
  <p className="winner-list">🏆 {winners.map(p=>`${p.name}${p.alive?" · sống sót":" · đã hy sinh"}`).join("; ")}</p>
  <p>Thắng theo phe, gồm cả người đã hy sinh. {game.players.filter(p=>p.alive).length} người sống sót.</p>
  {!game.historyComplete&&<p role="status">Ván bắt đầu bằng bản cũ: lịch sử trước khi cập nhật không thể khôi phục đầy đủ.</p>}
  <p>Bản này không có kỹ năng hồi sinh người đã chết. Bình Cứu chỉ ngăn Sói cắn trong đêm đang diễn ra.</p>
  <label>Lọc vòng <select aria-label="Lọc lịch sử theo vòng" value={round} onChange={e=>setRound(e.target.value)}><option value="all">Tất cả</option>{rounds.map(r=><option key={r} value={String(r)}>Vòng {r}</option>)}</select></label>
  <div className="history-scroll">{history.filter(t=>round==="all"||String(t.round)===round).map(t=><details key={t.seq} open={round!=="all"}>
   <summary>Vòng {t.round} · {t.phase==="night"?`Đêm · ${stageLabels[t.stage!]}`:t.phase==="voting"?t.secondVote?"Bỏ phiếu phụ":"Bỏ phiếu":"Phát súng Thợ Săn"}</summary>
   <table><thead><tr><th>Người chơi</th><th>Hành động</th><th>Mục tiêu</th></tr></thead><tbody>{t.actions.map(a=><tr key={a.actor}><td>{name(a.actor)}</td><td>{a.type==="target" ? t.stage==="wolf"?"Phiếu cắn":t.stage==="guard"?"Bảo vệ":t.stage==="seer"?"Soi":t.phase==="hunter_action"?"Bắn":"Vote loại":actionLabels[a.type]??a.type}</td><td>{a.target?name(a.target):"—"}</td></tr>)}</tbody></table>
   {t.outcomes.map((o,i)=><p className="history-outcome" key={i}>{outcome(o)}</p>)}
   {t.phase==="voting"&&!t.outcomes.length&&<p>Không loại người ở lượt này · hòa phiếu hoặc không có phiếu hợp lệ.</p>}
  </details>)}{!history.length&&<p>Chưa có lịch sử chi tiết cho ván này.</p>}</div>
 </section>;
}

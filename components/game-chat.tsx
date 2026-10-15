"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import type { PrivateGame, PublicGame } from "@/lib/game-engine/types";
const stickers:Record<string,{icon:string;label:string}>={wolf:{icon:"🐺",label:"Sói xuất hiện"},moon:{icon:"🌙",label:"Đêm xuống"},detective:{icon:"🧐",label:"Đáng nghi"},shield:{icon:"🛡️",label:"Bảo vệ"},potion:{icon:"🧪",label:"Bình bí ẩn"},victory:{icon:"🏆",label:"Chiến thắng"},ghost:{icon:"👻",label:"Hồn ma"},fire:{icon:"🔥",label:"Căng quá"}};
type Message={id:string;player_id:string;sender_name:string;channel:string;kind:string;body:string;created_at:string};
export default function GameChat({game,me}:{game:PublicGame;me:PrivateGame}) {
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(""),[picker,setPicker]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[live,setLive]=useState(false);
 const log=useRef<HTMLDivElement>(null),stickBottom=useRef(true),sending=useRef(false);
 const retry=useRef<{body:string;kind:string;nonce:string}|null>(null);
 const ended=game.phase==="game_over";
 const allowed=ended||!me.alive||["discussion","voting","vote_result","morning","win_check"].includes(game.phase);
 useEffect(()=>{
  let cancelled=false,reading=false,dirty=false;
  const db=getSupabase();
  async function read(){
   if(cancelled)return;if(reading){dirty=true;return}reading=true;
   try {
    const {data,error}=await db.from("wolf_chat_messages").select("id,player_id,sender_name,channel,kind,body,created_at").eq("game_id",game.id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(12000));
    if(error)throw error;
    if(!cancelled){setMessages((data??[]).reverse());setError("");}
   }catch{if(!cancelled)setError("Chat chưa kết nối. Kiểm tra migration 003 và kết nối mạng.");}
   finally{reading=false;if(dirty&&!cancelled){dirty=false;void read();}}
  }
  const channel=db.channel(`wolf-chat:${game.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"wolf_chat_messages",filter:`game_id=eq.${game.id}`},()=>void read()).subscribe(status=>{
   if(cancelled)return;setLive(status==="SUBSCRIBED");if(status==="SUBSCRIBED")void read();
  });
  const poll=setInterval(()=>{if(navigator.onLine)void read()},15000);
  const focus=()=>void read();window.addEventListener("online",focus);window.addEventListener("focus",focus);void read();
  return()=>{cancelled=true;clearInterval(poll);window.removeEventListener("online",focus);window.removeEventListener("focus",focus);void db.removeChannel(channel);};
 },[game.id,me.alive,ended]);
 useEffect(()=>{if(stickBottom.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[messages]);
 async function send(body:string,kind="text") {
  const clean=body.trim();if(!clean||!allowed||sending.current)return;
  sending.current=true;setBusy(true);setError("");
  const request=retry.current?.body===clean&&retry.current.kind===kind?retry.current:{body:clean,kind,nonce:crypto.randomUUID()};retry.current=request;
  try{
   const db=getSupabase();const {error}=await db.rpc("wolf_send_chat",{p_game:game.id,p_body:clean,p_kind:kind,p_nonce:request.nonce}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;
   retry.current=null;if(kind==="text")setDraft("");setPicker(false);stickBottom.current=true;
   // Immediate reconciliation also works if an INSERT arrives before subscription.
   const result=await db.from("wolf_chat_messages").select("id,player_id,sender_name,channel,kind,body,created_at").eq("game_id",game.id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(12000));
   if(!result.error)setMessages((result.data??[]).reverse());
  }catch(e){setError(e instanceof Error?e.message:typeof e==="object"&&e&&"message" in e?String(e.message):"Chưa gửi được. Bấm gửi lại để kiểm tra.");}
  finally{sending.current=false;setBusy(false);}
 }
 return <aside className="panel game-chat" aria-label="Chat trực tiếp">
  <div className="panel-heading"><h2>💬 Chat trực tiếp</h2><span className={live?"chat-live":""}>{live?"Trực tuyến":"Kết nối lại"}</span></div>
  <p className="chat-rules">{ended?"Tổng kết · tất cả cùng trò chuyện":!me.alive?"Kênh người đã chết · người sống không thấy":"Kênh người sống · tạm khóa ban đêm"}</p>
  <div className="chat-log" ref={log} role="log" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=log.current;if(el)stickBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<45;}}>
   {!messages.length&&<p className="chat-empty">Chưa có tin nhắn. Gửi lời chào khi đến ban ngày.</p>}
   {messages.map(m=><div className={`chat-message ${m.player_id===me.playerId?"mine":""}`} key={m.id}>
    <div><strong>{m.sender_name}</strong><time>{new Date(m.created_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</time></div>
    {ended&&<small>{m.channel==="dead"?"Hồn ma":m.channel==="end"?"Tổng kết":"Người sống"}</small>}
    {m.kind==="sticker"&&stickers[m.body]?<span className="chat-sticker" role="img" aria-label={stickers[m.body].label}>{stickers[m.body].icon}</span>:<p>{m.body}</p>}
   </div>)}
  </div>
  {error&&<p className="chat-error" role="alert">{error}</p>}
  {picker&&<div className="chat-picker" aria-label="Emoji và sticker"><div>{["😀","😂","🤔","😱","👍","❤️","🐺","🌙"].map(icon=><button key={icon} aria-label={`Thêm emoji ${icon}`} onClick={()=>setDraft(d=>(d+icon).slice(0,500))}>{icon}</button>)}</div><div>{Object.entries(stickers).map(([id,s])=><button key={id} disabled={busy||!allowed} aria-label={`Gửi sticker ${s.label}`} onClick={()=>void send(id,"sticker")}>{s.icon}</button>)}</div><small>Dòng trên: emoji · dòng dưới: gửi sticker</small></div>}
  <form autoComplete="off" onSubmit={e=>{e.preventDefault();void send(draft);}}>
   <label className="sr-only" htmlFor="chat-draft">Tin nhắn</label><textarea id="chat-draft" rows={2} autoComplete="off" autoCorrect="off" spellCheck={false} value={draft} maxLength={500} disabled={!allowed||busy} placeholder={allowed?"Nhập tin nhắn…":"Chat khóa lúc này"} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(draft);}}}/>
   <div><button type="button" disabled={!allowed||busy} aria-expanded={picker} aria-label="Chọn emoji và sticker" onClick={()=>setPicker(p=>!p)}>😊</button><small>{draft.length}/500</small><button type="submit" disabled={!allowed||busy||!draft.trim()}>{busy?"Đang gửi…":"Gửi"}</button></div>
  </form>
 </aside>;
}

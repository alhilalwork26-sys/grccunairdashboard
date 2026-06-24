"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Send, Loader2, MessageSquare, Users } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; role: string } | null;
}
interface DmRoom { room_id: string; other_user: UserProfile }
interface Props { currentUser: UserProfile; allUsers: UserProfile[]; dmRooms: DmRoom[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#0ea5e9","#14b8a6","#f97316","#84cc16"];
function uColor(id: string) { let h=0; for(let i=0;i<id.length;i++) h=id.charCodeAt(i)+((h<<5)-h); return PALETTE[Math.abs(h)%PALETTE.length]; }
function uInit(name: string) { return name.split(" ").slice(0,2).map(w=>w[0]??"").join("").toUpperCase()||"?"; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}); }
function fmtSep(iso: string) {
  const d=new Date(iso), now=new Date();
  if(d.toDateString()===now.toDateString()) return "Hari ini";
  const y=new Date(now); y.setDate(now.getDate()-1);
  if(d.toDateString()===y.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}

type Item = {type:"sep";label:string}|{type:"msg";msg:ChatMessage;isFirst:boolean;isOwn:boolean};
function group(msgs: ChatMessage[], myId: string): Item[] {
  const out: Item[] = []; let ld="", ls="", lt=0;
  for(const m of msgs){
    const s=fmtSep(m.created_at);
    if(s!==ld){out.push({type:"sep",label:s});ld=s;ls="";lt=0;}
    const t=new Date(m.created_at).getTime();
    const isFirst=m.sender_id!==ls||t-lt>5*60*1000;
    out.push({type:"msg",msg:m,isFirst,isOwn:m.sender_id===myId});
    ls=m.sender_id;lt=t;
  }
  return out;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Av({name,uid,size=32}:{name:string;uid:string;size?:number}) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:uColor(uid),display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*.36),fontWeight:700,color:"#fff",flexShrink:0,userSelect:"none"}}>
      {uInit(name)}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChatBoard({currentUser,allUsers,dmRooms:initDms}:Props) {
  const supabase = useMemo(()=>createClient(),[]);

  const [roomId,setRoomId]     = useState(GLOBAL_ROOM_ID);
  const [msgs,setMsgs]         = useState<ChatMessage[]>([]);
  const [dms,setDms]           = useState<DmRoom[]>(initDms);
  const [input,setInput]       = useState("");
  const [sending,setSending]   = useState(false);
  const [loading,setLoading]   = useState(true);
  const [making,setMaking]     = useState<string|null>(null);
  const [focused,setFocused]   = useState(false);

  const endRef  = useRef<HTMLDivElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);

  const isGlobal = roomId===GLOBAL_ROOM_ID;
  const curDm    = dms.find(d=>d.room_id===roomId);
  const roomName = isGlobal ? "GRCC Team" : (curDm?.other_user.full_name??"DM");
  const roomSub  = isGlobal ? `${allUsers.length+1} anggota` : (curDm?.other_user.role?.replace(/_/g," ")??"");

  const items = useMemo(()=>group(msgs,currentUser.id),[msgs,currentUser.id]);

  // ── Load + realtime ────────────────────────────────────────────────────────
  useEffect(()=>{
    let ok=true;
    setLoading(true); setMsgs([]);
    supabase.from("chat_messages").select("*,sender:profiles(id,full_name,role)")
      .eq("room_id",roomId).order("created_at",{ascending:true}).limit(150)
      .then(({data})=>{ if(ok){setMsgs((data as ChatMessage[])??[]);setLoading(false);} });

    const ch=supabase.channel(`chat:${roomId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:`room_id=eq.${roomId}`},
        async(p)=>{
          if(!ok) return;
          const {data}=await supabase.from("chat_messages").select("*,sender:profiles(id,full_name,role)").eq("id",(p.new as {id:string}).id).single();
          if(data&&ok) setMsgs(prev=>prev.some(m=>m.id===(data as ChatMessage).id)?prev:[...prev,data as ChatMessage]);
        })
      .subscribe();
    return ()=>{ ok=false; supabase.removeChannel(ch); };
  },[roomId,supabase]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  async function send() {
    const text=input.trim(); if(!text||sending) return;
    setSending(true); setInput("");
    if(taRef.current) taRef.current.style.height="auto";
    await supabase.from("chat_messages").insert({room_id:roomId,sender_id:currentUser.id,content:text});
    setSending(false); taRef.current?.focus();
  }

  async function openDM(u:UserProfile) {
    const ex=dms.find(d=>d.other_user.id===u.id);
    if(ex){setRoomId(ex.room_id);return;}
    setMaking(u.id);
    const {data:room}=await supabase.from("chat_rooms").insert({type:"direct"}).select().single();
    if(!room){setMaking(null);return;}
    await supabase.from("chat_room_members").insert([{room_id:room.id,user_id:currentUser.id},{room_id:room.id,user_id:u.id}]);
    setDms(prev=>[...prev,{room_id:room.id,other_user:u}]);
    setRoomId(room.id); setMaking(null);
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="board-root" style={{display:"flex",flexDirection:"column",height:"100vh",background:"#f8fafc"}}>
      <Topbar user={currentUser} title="Chat" />

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ─── Left Panel (clean white) ──────────────────────────────── */}
        <div style={{width:224,flexShrink:0,background:"#fff",borderRight:"1px solid #f0f0f5",display:"flex",flexDirection:"column",overflow:"hidden"}}>

          <div style={{flex:1,overflowY:"auto",padding:"18px 10px 10px"}}>

            {/* Channels */}
            <p style={{fontSize:10,fontWeight:700,color:"#b0b7c3",textTransform:"uppercase",letterSpacing:"0.09em",padding:"0 8px",marginBottom:6}}>Channel</p>

            <motion.button
              onClick={()=>setRoomId(GLOBAL_ROOM_ID)}
              whileTap={{scale:0.98}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",marginBottom:16,
                background:isGlobal?"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))":"transparent",
                transition:"background 0.15s",
              }}
            >
              <div style={{width:28,height:28,borderRadius:8,background:isGlobal?"linear-gradient(135deg,#6366f1,#4f46e5)":"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s",flexShrink:0}}>
                <Hash size={13} color={isGlobal?"#fff":"#9ca3af"} strokeWidth={2.5} />
              </div>
              <span style={{fontSize:13,fontWeight:isGlobal?700:500,color:isGlobal?"#4f46e5":"#374151",flex:1}}>grcc-team</span>
              {isGlobal && <div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",flexShrink:0}} />}
            </motion.button>

            {/* DMs */}
            <p style={{fontSize:10,fontWeight:700,color:"#b0b7c3",textTransform:"uppercase",letterSpacing:"0.09em",padding:"0 8px",marginBottom:6}}>Pesan Langsung</p>

            {allUsers.map((u,i)=>{
              const dm=dms.find(d=>d.other_user.id===u.id);
              const active=dm?.room_id===roomId;
              return (
                <motion.button key={u.id}
                  initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*.04,duration:.2}}
                  onClick={()=>openDM(u)} whileTap={{scale:.97}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",marginBottom:2,
                    background:active?"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))":"transparent",
                    transition:"background 0.15s",
                  }}
                >
                  <div style={{position:"relative",flexShrink:0}}>
                    <Av name={u.full_name} uid={u.id} size={28} />
                    <div style={{position:"absolute",bottom:0,right:0,width:7,height:7,borderRadius:"50%",background:"#10b981",border:"1.5px solid #fff"}} />
                  </div>
                  <span style={{fontSize:13,fontWeight:active?600:400,color:active?"#4f46e5":"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {u.full_name}
                  </span>
                  {making===u.id&&(
                    <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.7,ease:"linear"}}>
                      <Loader2 size={12} color="#9ca3af" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Current user footer */}
          <div style={{padding:"10px 14px 14px",borderTop:"1px solid #f0f0f5"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Av name={currentUser.full_name} uid={currentUser.id} size={30} />
                <div style={{position:"absolute",bottom:0,right:0,width:8,height:8,borderRadius:"50%",background:"#10b981",border:"2px solid #fff"}} />
              </div>
              <div style={{overflow:"hidden"}}>
                <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.full_name}</p>
                <p style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{currentUser.role?.replace(/_/g," ")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Chat Area ──────────────────────────────────────────────── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Header */}
          <motion.div key={roomId} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.2}}
            style={{padding:"14px 24px",background:"#fff",borderBottom:"1px solid #f0f0f5",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {isGlobal
                ? <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#4338ca)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px rgba(99,102,241,.25)"}}>
                    <Hash size={18} color="#fff" strokeWidth={2.5} />
                  </div>
                : <Av name={curDm?.other_user.full_name??"?"} uid={curDm?.other_user.id??""} size={40} />
              }
              <div>
                <p style={{fontSize:16,fontWeight:700,color:"#111827",lineHeight:1}}>{roomName}</p>
                <p style={{fontSize:12,color:"#9ca3af",marginTop:4,display:"flex",alignItems:"center",gap:4}}>
                  {isGlobal && <Users size={11} />}
                  {roomSub}
                </p>
              </div>
            </div>

            {/* Stacked member avatars */}
            {isGlobal && (
              <div style={{display:"flex",alignItems:"center"}}>
                {[currentUser,...allUsers].slice(0,5).map((u,i)=>(
                  <motion.div key={u.id} initial={{scale:0}} animate={{scale:1}} transition={{delay:i*.05,type:"spring",stiffness:400}}
                    style={{marginLeft:i===0?0:-9,zIndex:5-i}} title={u.full_name}>
                    <div style={{border:"2.5px solid #fff",borderRadius:"50%"}}>
                      <Av name={u.full_name} uid={u.id} size={28} />
                    </div>
                  </motion.div>
                ))}
                {allUsers.length>=5&&<div style={{width:28,height:28,borderRadius:"50%",background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#6b7280",marginLeft:-9,border:"2.5px solid #fff"}}>+{allUsers.length-4}</div>}
              </div>
            )}
          </motion.div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"24px 28px 16px",display:"flex",flexDirection:"column",background:"#f8fafc"}}>
            {loading ? (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.9,ease:"linear"}}>
                  <Loader2 size={28} color="#c7d2fe" />
                </motion.div>
              </div>
            ) : msgs.length===0 ? (
              <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
                <motion.div animate={{y:[0,-6,0]}} transition={{repeat:Infinity,duration:2.8,ease:"easeInOut"}}
                  style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 12px 32px rgba(99,102,241,.25)"}}>
                  <MessageSquare size={28} color="#fff" />
                </motion.div>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:17,fontWeight:700,color:"#1f2937"}}>Belum ada pesan</p>
                  <p style={{fontSize:13,color:"#9ca3af",marginTop:6}}>{isGlobal?"Mulai diskusi tim di sini!":`Kirim pesan pertama ke ${roomName} 👋`}</p>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {items.map((it,idx)=>{
                  if(it.type==="sep") return (
                    <motion.div key={`s${it.label}${idx}`} initial={{opacity:0}} animate={{opacity:1}}
                      style={{display:"flex",alignItems:"center",gap:14,margin:"22px 0 16px"}}>
                      <div style={{flex:1,height:1,background:"#e9ecf1"}} />
                      <span style={{fontSize:11,fontWeight:600,color:"#9ca3af",whiteSpace:"nowrap",padding:"4px 14px",background:"#fff",borderRadius:20,border:"1px solid #e9ecf1"}}>{it.label}</span>
                      <div style={{flex:1,height:1,background:"#e9ecf1"}} />
                    </motion.div>
                  );

                  const {msg,isFirst,isOwn}=it;
                  const name=msg.sender?.full_name??"Unknown";
                  return (
                    <motion.div key={msg.id} layout
                      initial={{opacity:0,y:16,scale:.97}}
                      animate={{opacity:1,y:0,scale:1}}
                      transition={{type:"spring",stiffness:520,damping:30}}
                      style={{display:"flex",flexDirection:isOwn?"row-reverse":"row",alignItems:"flex-end",gap:10,marginTop:isFirst?16:3}}
                    >
                      {!isOwn&&(
                        <div style={{width:32,flexShrink:0}}>
                          {isFirst&&<Av name={name} uid={msg.sender_id} size={32} />}
                        </div>
                      )}
                      <div style={{maxWidth:"58%",display:"flex",flexDirection:"column",alignItems:isOwn?"flex-end":"flex-start"}}>
                        {isFirst&&!isOwn&&(
                          <span style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:5,marginLeft:4}}>{name}</span>
                        )}
                        <div style={{
                          padding:"10px 16px",
                          background:isOwn?"linear-gradient(135deg,#6366f1 0%,#4338ca 100%)":"#fff",
                          borderRadius:isOwn
                            ?(isFirst?"20px 20px 5px 20px":"20px 5px 5px 20px")
                            :(isFirst?"5px 20px 20px 20px":"5px 20px 20px 5px"),
                          boxShadow:isOwn
                            ?"0 4px 18px rgba(99,102,241,.28)"
                            :"0 1px 4px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.04)",
                          color:isOwn?"#fff":"#111827",
                          fontSize:14,lineHeight:1.6,
                          whiteSpace:"pre-wrap",wordBreak:"break-word",
                        }}>
                          {msg.content}
                        </div>
                        <span style={{fontSize:10,color:"#a0aab4",marginTop:5,[isOwn?"marginRight":"marginLeft"]:4}}>
                          {fmtTime(msg.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{padding:"14px 24px 18px",background:"#fff",borderTop:"1px solid #f0f0f5",flexShrink:0}}>
            <motion.div
              animate={{boxShadow:focused?"0 0 0 3px rgba(99,102,241,.15)":"0 0 0 0px transparent",borderColor:focused?"#a5b4fc":"#e5e7eb"}}
              transition={{duration:.15}}
              style={{display:"flex",alignItems:"flex-end",gap:10,background:focused?"#fff":"#f8fafc",borderRadius:16,border:"1.5px solid #e5e7eb",padding:"10px 10px 10px 18px"}}
            >
              <textarea ref={taRef} value={input}
                onChange={e=>{
                  setInput(e.target.value);
                  e.target.style.height="auto";
                  e.target.style.height=`${Math.min(e.target.scrollHeight,120)}px`;
                }}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                placeholder={`Pesan ke ${isGlobal?"#grcc-team":roomName}…`}
                rows={1}
                style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:14,color:"#111827",resize:"none",fontFamily:"inherit",lineHeight:1.6,maxHeight:120,overflowY:"auto",paddingTop:1}}
              />
              <motion.button
                whileHover={input.trim()?{scale:1.07}:{}}
                whileTap={input.trim()?{scale:.92}:{}}
                onClick={send} disabled={!input.trim()||sending}
                style={{width:38,height:38,borderRadius:12,border:"none",flexShrink:0,cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",
                  background:input.trim()?"linear-gradient(135deg,#6366f1,#4338ca)":"#f0f0f5",
                  transition:"background .15s",boxShadow:input.trim()?"0 4px 12px rgba(99,102,241,.3)":"none",
                }}
              >
                {sending
                  ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.7,ease:"linear"}}><Loader2 size={15} color={input.trim()?"#fff":"#9ca3af"} /></motion.div>
                  : <Send size={15} color={input.trim()?"#fff":"#9ca3af"} strokeWidth={2.2} style={{transform:"translateX(1px)"}} />
                }
              </motion.button>
            </motion.div>
            <p style={{fontSize:11,color:"#c8cdd8",marginTop:8,textAlign:"right"}}>
              <span style={{fontWeight:600}}>Enter</span> kirim · <span style={{fontWeight:600}}>Shift+Enter</span> baris baru
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

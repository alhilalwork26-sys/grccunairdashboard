"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Send, Loader2, MessageSquare, Users, Trash2, SquarePen, Search, X } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction } from "./actions";
import StatusDot from "@/components/ui/StatusDot";
import { usePresence } from "@/context/PresenceContext";

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string; room_id: string; sender_id: string; content: string; created_at: string;
  deleted_at?: string | null;
  sender?: { full_name: string; role: string; avatar_url?: string } | null;
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
function lsKey(uid: string, rid: string) { return `chatLR_${uid}_${rid}`; }
function getLastRead(uid: string, rid: string) {
  if (typeof window === "undefined") return "2000-01-01T00:00:00Z";
  return localStorage.getItem(lsKey(uid, rid)) ?? "2000-01-01T00:00:00Z";
}
function saveLastRead(uid: string, rid: string) {
  if (typeof window !== "undefined") localStorage.setItem(lsKey(uid, rid), new Date().toISOString());
}

type Item = {type:"sep";label:string}|{type:"msg";msg:ChatMessage;isFirst:boolean;isOwn:boolean};
function buildItems(msgs: ChatMessage[], myId: string): Item[] {
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
function Av({name,uid,size=32,url}:{name:string;uid:string;size?:number;url?:string|null}) {
  if(url) return (
    <img src={url} alt={name}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,display:"block"}}
      onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:uColor(uid),display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*.36),fontWeight:700,color:"#fff",flexShrink:0,userSelect:"none"}}>
      {uInit(name)}
    </div>
  );
}

// ─── Unread badge ─────────────────────────────────────────────────────────────
function Badge({count}:{count:number}) {
  if(!count) return null;
  return (
    <motion.span initial={{scale:0}} animate={{scale:1}} exit={{scale:0}}
      style={{minWidth:18,height:18,borderRadius:9,background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",padding:"0 5px",flexShrink:0}}>
      {count>9?"9+":count}
    </motion.span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChatBoard({currentUser,allUsers,dmRooms:initDms}:Props) {
  const supabase = useMemo(()=>createClient(),[]);
  const { statusOf } = usePresence();

  const [roomId,setRoomId]     = useState(GLOBAL_ROOM_ID);
  const [msgs,setMsgs]         = useState<ChatMessage[]>([]);
  const [dms,setDms]           = useState<DmRoom[]>(initDms);
  const [input,setInput]       = useState("");
  const [sending,setSending]   = useState(false);
  const [loading,setLoading]   = useState(true);
  const [making,setMaking]     = useState<string|null>(null);
  const [focused,setFocused]   = useState(false);
  const [unreads,setUnreads]   = useState<Record<string,number>>({});
  const [hoveredMsg,setHoveredMsg]   = useState<string|null>(null);
  const [deleting,setDeleting]       = useState<string|null>(null);
  const [lastMsgAt,setLastMsgAt]     = useState<Record<string,string>>({});
  const [showCompose,setShowCompose] = useState(false);
  const [composeQ,setComposeQ]       = useState("");

  const endRef        = useRef<HTMLDivElement>(null);
  const taRef         = useRef<HTMLTextAreaElement>(null);
  const activeRoomRef = useRef(GLOBAL_ROOM_ID);

  const isGlobal = roomId===GLOBAL_ROOM_ID;
  const curDm    = dms.find(d=>d.room_id===roomId);
  const roomName = isGlobal ? "GRCC Team" : (curDm?.other_user.full_name??"DM");
  const roomSub  = isGlobal ? `${allUsers.length+1} anggota` : (curDm?.other_user.role?.replace(/_/g," ")??"");

  const items = useMemo(()=>buildItems(msgs,currentUser.id),[msgs,currentUser.id]);

  // Sort existing DMs by most-recent message
  const sortedDms = useMemo(()=>[...dms].sort((a,b)=>{
    const ta=lastMsgAt[a.room_id]??"";
    const tb=lastMsgAt[b.room_id]??"";
    if(ta&&tb) return tb.localeCompare(ta);
    if(ta) return -1;
    if(tb) return 1;
    return a.other_user.full_name.localeCompare(b.other_user.full_name);
  }),[dms,lastMsgAt]);

  // Users available to start a new DM (exclude those already in dms)
  const composeResults = useMemo(()=>allUsers.filter(u=>{
    const q=composeQ.toLowerCase();
    return (!q||u.full_name.toLowerCase().includes(q)||u.role?.toLowerCase().includes(q));
  }),[allUsers,composeQ]);

  // ── Switch room (clears unread + saves last-read timestamp) ───────────────
  function switchRoom(rid: string) {
    // Save lastRead for the room we're leaving so it stays read on reload
    saveLastRead(currentUser.id, activeRoomRef.current);
    setRoomId(rid);
    activeRoomRef.current = rid;
    setUnreads(prev => ({ ...prev, [rid]: 0 }));
    saveLastRead(currentUser.id, rid);
  }

  // ── Soft-delete a message ─────────────────────────────────────────────────
  async function deleteMsg(id:string) {
    setDeleting(id);
    const now=new Date().toISOString();
    await supabase.from("chat_messages").update({deleted_at:now}).eq("id",id).eq("sender_id",currentUser.id);
    setMsgs(prev=>prev.map(m=>m.id===id?{...m,deleted_at:now}:m));
    setDeleting(null); setHoveredMsg(null);
  }

  // ── Load messages + realtime for active room ───────────────────────────────
  useEffect(()=>{
    let ok=true;
    const resetTimer = window.setTimeout(() => {
      if (!ok) return;
      setLoading(true);
      setMsgs([]);
    }, 0);
    supabase.from("chat_messages").select("*,sender:profiles(id,full_name,role,avatar_url)")
      .eq("room_id",roomId).order("created_at",{ascending:true}).limit(150)
      .then(({data})=>{ if(ok){setMsgs((data as ChatMessage[])??[]);setLoading(false);} });

    const ch=supabase.channel(`chat:${roomId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:`room_id=eq.${roomId}`},
        async(p)=>{
          if(!ok) return;
          const nm=p.new as{id:string;created_at:string};
          setLastMsgAt(prev=>({...prev,[roomId]:nm.created_at}));
          // Keep lastRead up-to-date while this room is open so reload doesn't re-show these messages
          saveLastRead(currentUser.id, roomId);
          const{data}=await supabase.from("chat_messages").select("*,sender:profiles(id,full_name,role,avatar_url)").eq("id",nm.id).single();
          if(data&&ok) setMsgs(prev=>prev.some(m=>m.id===(data as ChatMessage).id)?prev:[...prev,data as ChatMessage]);
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"chat_messages",filter:`room_id=eq.${roomId}`},
        (p)=>{
          if(!ok) return;
          const u=p.new as{id:string;deleted_at:string|null};
          setMsgs(prev=>prev.map(m=>m.id===u.id?{...m,deleted_at:u.deleted_at}:m));
        })
      .subscribe();
    return ()=>{ ok=false; window.clearTimeout(resetTimer); supabase.removeChannel(ch); };
  },[roomId,supabase]);  

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  // ── New DM rooms for current user in real-time ────────────────────────────
  useEffect(()=>{
    const ch=supabase.channel(`my-rooms:${currentUser.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_room_members",filter:`user_id=eq.${currentUser.id}`},
        async(p)=>{
          const rid=(p.new as {room_id:string}).room_id;
          if(rid===GLOBAL_ROOM_ID) return;
          setDms(prev=>{
            if(prev.some(d=>d.room_id===rid)) return prev;
            (async()=>{
              const{data:rm}=await supabase.from("chat_rooms").select("id,type").eq("id",rid).eq("type","direct").single();
              if(!rm) return;
              const{data:om}=await supabase.from("chat_room_members")
                .select("profile:profiles(id,full_name,role,email,created_at)").eq("room_id",rid).neq("user_id",currentUser.id).single();
              if(om?.profile) setDms(cur=>cur.some(d=>d.room_id===rid)?cur:[...cur,{room_id:rid,other_user:om.profile as unknown as UserProfile}]);
            })();
            return prev;
          });
        }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[currentUser.id,supabase]);  

  // ── Load last-message timestamps for all DM rooms (for sort order) ──────
  useEffect(()=>{
    if(!initDms.length) return;
    Promise.all(initDms.map(async({room_id})=>{
      const{data}=await supabase.from("chat_messages").select("created_at")
        .eq("room_id",room_id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      return [room_id, data?.created_at??""] as [string,string];
    })).then(entries=>setLastMsgAt(Object.fromEntries(entries.filter(([,t])=>t))));
  },[supabase]); // eslint-disable-line

  // ── Load initial unread counts for all rooms ──────────────────────────────
  useEffect(()=>{
    const allRooms=[GLOBAL_ROOM_ID,...dms.map(d=>d.room_id)];
    Promise.all(allRooms.map(async rid=>{
      if(rid===activeRoomRef.current) return [rid,0] as [string,number];
      const lr=getLastRead(currentUser.id,rid);
      const{count}=await supabase.from("chat_messages").select("*",{count:"exact",head:true})
        .eq("room_id",rid).neq("sender_id",currentUser.id).gt("created_at",lr);
      return [rid, count??0] as [string,number];
    })).then(entries=>setUnreads(Object.fromEntries(entries.filter(([,c])=>c>0))));
  },[dms,currentUser.id,supabase]);  

  // ── Global subscription: track unreads in non-active rooms ────────────────
  useEffect(()=>{
    const ch=supabase.channel("chat-unreads-global")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},p=>{
        const m=p.new as{room_id:string;sender_id:string;created_at:string};
        setLastMsgAt(prev=>({...prev,[m.room_id]:m.created_at}));
        if(m.sender_id===currentUser.id||m.room_id===activeRoomRef.current) return;
        setUnreads(prev=>({...prev,[m.room_id]:(prev[m.room_id]??0)+1}));
      }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[currentUser.id,supabase]);  

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send() {
    const text=input.trim(); if(!text||sending) return;
    setSending(true); setInput("");
    if(taRef.current) taRef.current.style.height="auto";
    const now=new Date().toISOString();
    const{data:inserted,error}=await sendChatMessageAction(roomId,text);
    if(error){ setInput(text); setSending(false); return; }
    // Immediately add to UI without waiting for realtime (dedup handles double-fire)
    if(inserted) setMsgs(prev=>prev.some(m=>m.id===(inserted as unknown as ChatMessage).id)?prev:[...prev,inserted as unknown as ChatMessage]);
    setLastMsgAt(prev=>({...prev,[roomId]:now}));
    setSending(false); taRef.current?.focus();
  }

  // ── Open / create DM ──────────────────────────────────────────────────────
  async function openDM(u:UserProfile) {
    // Check client state first
    const ex=dms.find(d=>d.other_user.id===u.id);
    if(ex){switchRoom(ex.room_id);setShowCompose(false);return;}
    setMaking(u.id);
    // Check DB for existing direct room between the two users
    const{data:myRooms}=await supabase.from("chat_room_members").select("room_id").eq("user_id",currentUser.id);
    const{data:theirRooms}=await supabase.from("chat_room_members").select("room_id").eq("user_id",u.id);
    const myIds=new Set((myRooms??[]).map(r=>r.room_id));
    const sharedId=(theirRooms??[]).map(r=>r.room_id).find(id=>myIds.has(id));
    if(sharedId){
      const{data:rm}=await supabase.from("chat_rooms").select("id").eq("id",sharedId).eq("type","direct").maybeSingle();
      if(rm){
        setDms(prev=>prev.some(d=>d.room_id===rm.id)?prev:[...prev,{room_id:rm.id,other_user:u}]);
        switchRoom(rm.id); setMaking(null); setShowCompose(false); return;
      }
    }
    const newRoomId=crypto.randomUUID();
    const{error}=await supabase.from("chat_rooms").insert({id:newRoomId,type:"direct"});
    if(error){setMaking(null);return;}
    const{error:memErr}=await supabase.from("chat_room_members").insert([
      {room_id:newRoomId,user_id:currentUser.id},
      {room_id:newRoomId,user_id:u.id},
    ]);
    if(memErr){setMaking(null);return;}
    setDms(prev=>prev.some(d=>d.other_user.id===u.id)?prev:[...prev,{room_id:newRoomId,other_user:u}]);
    switchRoom(newRoomId); setMaking(null); setShowCompose(false);
  }

  // ── Total unread across all rooms (for Topbar badge display) ─────────────
  const totalUnread = Object.values(unreads).reduce((s,c)=>s+c,0);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="board-root" style={{display:"flex",flexDirection:"column",height:"100vh",background:"#f8fafc"}}>
      <Topbar user={currentUser} title={`Chat${totalUnread>0?` (${totalUnread>9?"9+":totalUnread})`:"" }`} />

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ─── Left Panel ─────────────────────────────────────────────── */}
        <div style={{width:224,flexShrink:0,background:"#fff",borderRight:"1px solid #f0f0f5",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
          <div style={{flex:1,overflowY:"auto",padding:"18px 10px 10px"}}>

            {/* Channel */}
            <p style={{fontSize:10,fontWeight:700,color:"#b0b7c3",textTransform:"uppercase",letterSpacing:"0.09em",padding:"0 8px",marginBottom:6}}>Channel</p>
            <motion.button onClick={()=>switchRoom(GLOBAL_ROOM_ID)} whileTap={{scale:.98}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",marginBottom:16,
                background:isGlobal?"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))":"transparent",transition:"background 0.15s"}}>
              <div style={{width:28,height:28,borderRadius:8,background:isGlobal?"linear-gradient(135deg,#6366f1,#4f46e5)":"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}>
                <Hash size={13} color={isGlobal?"#fff":"#9ca3af"} strokeWidth={2.5} />
              </div>
              <span style={{fontSize:13,fontWeight:isGlobal?700:500,color:isGlobal?"#4f46e5":"#374151",flex:1}}>grcc-team</span>
              <AnimatePresence>
                {unreads[GLOBAL_ROOM_ID]>0 && <Badge count={unreads[GLOBAL_ROOM_ID]} />}
              </AnimatePresence>
            </motion.button>

            {/* Direct Messages header + compose button */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px",marginBottom:6}}>
              <p style={{fontSize:10,fontWeight:700,color:"#b0b7c3",textTransform:"uppercase",letterSpacing:"0.09em",margin:0}}>Pesan Langsung</p>
              <motion.button
                whileHover={{scale:1.15,backgroundColor:"#ede9fe"}} whileTap={{scale:.88}}
                onClick={()=>{setShowCompose(true);setComposeQ("");}}
                title="Pesan baru"
                style={{width:22,height:22,borderRadius:7,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"background 0.12s"}}>
                <SquarePen size={13} color="#6366f1" />
              </motion.button>
            </div>

            {/* Existing DMs */}
            {sortedDms.length===0&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}}
                style={{padding:"18px 8px",textAlign:"center"}}>
                <p style={{fontSize:11,color:"#c4c9d4",lineHeight:1.6}}>Belum ada percakapan.<br/>Tekan ✏️ untuk mulai chat.</p>
              </motion.div>
            )}
            {sortedDms.map((dm,i)=>{
              const u=dm.other_user;
              const active=dm.room_id===roomId;
              const unread=unreads[dm.room_id]??0;
              return (
                <motion.button key={dm.room_id}
                  layout
                  initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*.04,duration:.2}}
                  onClick={()=>switchRoom(dm.room_id)} whileTap={{scale:.97}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",marginBottom:2,
                    background:active?"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))":"transparent",transition:"background 0.15s"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <Av name={u.full_name} uid={u.id} size={28} url={u.avatar_url} />
                    <div style={{position:"absolute",bottom:0,right:0}}><StatusDot status={statusOf(u.id)} size={9} borderColor="#fff" /></div>
                  </div>
                  <span style={{fontSize:13,fontWeight:active||unread>0?600:400,color:active?"#4f46e5":unread>0?"#111827":"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {u.full_name}
                  </span>
                  <AnimatePresence>{unread>0&&<Badge count={unread}/>}</AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Current user footer */}
          <div style={{padding:"10px 14px 14px",borderTop:"1px solid #f0f0f5"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Av name={currentUser.full_name} uid={currentUser.id} size={30} url={currentUser.avatar_url} />
                <div style={{position:"absolute",bottom:0,right:0}}><StatusDot status={statusOf(currentUser.id)} size={10} borderColor="#fff" /></div>
              </div>
              <div style={{overflow:"hidden"}}>
                <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.full_name}</p>
                <p style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{currentUser.role?.replace(/_/g," ")}</p>
              </div>
            </div>
          </div>

          {/* ── Compose Panel (slides up over sidebar) ──────────────── */}
          <AnimatePresence>
            {showCompose&&(
              <motion.div
                initial={{y:"100%",opacity:0}} animate={{y:0,opacity:1}} exit={{y:"100%",opacity:0}}
                transition={{type:"spring",stiffness:420,damping:36}}
                style={{position:"absolute",inset:0,background:"#fff",zIndex:20,display:"flex",flexDirection:"column"}}>

                {/* Compose header */}
                <div style={{padding:"18px 14px 12px",borderBottom:"1px solid #f0f0f5",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <p style={{fontSize:14,fontWeight:700,color:"#111827",margin:0}}>Pesan Baru</p>
                    <motion.button whileHover={{scale:1.08}} whileTap={{scale:.88}}
                      onClick={()=>{setShowCompose(false);setComposeQ("");}}
                      style={{width:26,height:26,borderRadius:8,border:"none",background:"#f3f4f6",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                      <X size={14} color="#6b7280" />
                    </motion.button>
                  </div>
                  {/* Search bar */}
                  <motion.div
                    animate={{borderColor:composeQ?"#a5b4fc":"#e5e7eb"}}
                    style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:10,padding:"8px 12px",border:"1.5px solid #e5e7eb",transition:"border-color 0.15s"}}>
                    <Search size={13} color="#9ca3af" />
                    <input autoFocus value={composeQ} onChange={e=>setComposeQ(e.target.value)}
                      placeholder="Cari nama atau role…"
                      style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:"#111827",fontFamily:"inherit"}} />
                    <AnimatePresence>
                      {composeQ&&(
                        <motion.button initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0,opacity:0}}
                          whileTap={{scale:.8}} onClick={()=>setComposeQ("")}
                          style={{border:"none",background:"none",cursor:"pointer",padding:0,display:"flex"}}>
                          <X size={12} color="#9ca3af" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* User list */}
                <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
                  {composeResults.length===0&&(
                    <motion.div initial={{opacity:0}} animate={{opacity:1}}
                      style={{padding:"28px 8px",textAlign:"center"}}>
                      <p style={{fontSize:12,color:"#c4c9d4"}}>Pengguna tidak ditemukan</p>
                    </motion.div>
                  )}
                  {composeResults.map((u,i)=>(
                    <motion.button key={u.id}
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.035,duration:.18,type:"spring",stiffness:400,damping:28}}
                      onClick={async()=>{ if(making) return; setShowCompose(false);setComposeQ("");await openDM(u);}}
                      whileHover={{backgroundColor:"#f5f3ff",x:2}} whileTap={{scale:.97}}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left",marginBottom:3,background:"transparent",transition:"background 0.1s"}}>
                      <div style={{position:"relative",flexShrink:0}}>
                        <Av name={u.full_name} uid={u.id} size={34} url={u.avatar_url} />
                        <div style={{position:"absolute",bottom:0,right:0}}><StatusDot status={statusOf(u.id)} size={10} borderColor="#fff" /></div>
                      </div>
                      <div style={{flex:1,overflow:"hidden"}}>
                        <p style={{fontSize:13,fontWeight:600,color:"#111827",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name}</p>
                        <p style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{u.role?.replace(/_/g," ")}</p>
                      </div>
                      {making===u.id
                        ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.7,ease:"linear"}}><Loader2 size={14} color="#6366f1"/></motion.div>
                        : <div style={{width:24,height:24,borderRadius:8,background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <SquarePen size={11} color="#6366f1"/>
                          </div>
                      }
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                : <Av name={curDm?.other_user.full_name??"?"} uid={curDm?.other_user.id??""} size={40} url={curDm?.other_user.avatar_url} />
              }
              <div>
                <p style={{fontSize:16,fontWeight:700,color:"#111827",lineHeight:1}}>{roomName}</p>
                <p style={{fontSize:12,color:"#9ca3af",marginTop:4,display:"flex",alignItems:"center",gap:4}}>
                  {isGlobal && <Users size={11} />}{roomSub}
                </p>
              </div>
            </div>
            {isGlobal && (
              <div style={{display:"flex",alignItems:"center"}}>
                {[currentUser,...allUsers].slice(0,5).map((u,i)=>(
                  <motion.div key={u.id} initial={{scale:0}} animate={{scale:1}} transition={{delay:i*.05,type:"spring",stiffness:400}}
                    style={{marginLeft:i===0?0:-9,zIndex:5-i}} title={u.full_name}>
                    <div style={{border:"2.5px solid #fff",borderRadius:"50%"}}><Av name={u.full_name} uid={u.id} size={28} url={u.avatar_url} /></div>
                  </motion.div>
                ))}
                {allUsers.length>=5&&<div style={{width:28,height:28,borderRadius:"50%",background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#6b7280",marginLeft:-9,border:"2.5px solid #fff"}}>+{allUsers.length-4}</div>}
              </div>
            )}
          </motion.div>

          {/* Messages */}
          <div className="board-main" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",background:"#f8fafc"}}>
            {loading ? (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.9,ease:"linear"}}><Loader2 size={28} color="#c7d2fe" /></motion.div>
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
                  const{msg,isFirst,isOwn}=it;
                  const name=msg.sender?.full_name??"Unknown";
                  const isDeleted=!!msg.deleted_at;
                  const isHov=hoveredMsg===msg.id;
                  return (
                    <motion.div key={msg.id} layout
                      initial={{opacity:0,y:16,scale:.97}} animate={{opacity:1,y:0,scale:1}}
                      transition={{type:"spring",stiffness:520,damping:30}}
                      onMouseEnter={()=>!isDeleted&&setHoveredMsg(msg.id)}
                      onMouseLeave={()=>setHoveredMsg(null)}
                      style={{display:"flex",flexDirection:isOwn?"row-reverse":"row",alignItems:"flex-end",gap:10,marginTop:isFirst?16:3,position:"relative"}}>
                      {!isOwn&&<div style={{width:32,flexShrink:0}}>{isFirst&&<Av name={name} uid={msg.sender_id} size={32} url={msg.sender?.avatar_url} />}</div>}
                      <div style={{maxWidth:"58%",display:"flex",flexDirection:"column",alignItems:isOwn?"flex-end":"flex-start"}}>
                        {isFirst&&!isOwn&&<span style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:5,marginLeft:4}}>{name}</span>}

                        {/* Bubble wrapper — holds bubble + delete button together */}
                        <div style={{display:"flex",alignItems:"center",gap:6,flexDirection:isOwn?"row":"row-reverse"}}>
                          {/* Delete button — only own, non-deleted, on hover */}
                          <AnimatePresence>
                            {isOwn&&!isDeleted&&isHov&&(
                              <motion.button
                                initial={{opacity:0,scale:.7}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.7}}
                                transition={{duration:.12}}
                                onClick={()=>deleteMsg(msg.id)}
                                disabled={deleting===msg.id}
                                title="Hapus pesan"
                                style={{width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:"#fee2e2",flexShrink:0}}>
                                {deleting===msg.id
                                  ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:.6,ease:"linear"}}><Loader2 size={12} color="#ef4444"/></motion.div>
                                  : <Trash2 size={12} color="#ef4444"/>
                                }
                              </motion.button>
                            )}
                          </AnimatePresence>

                          {/* Bubble */}
                          {isDeleted ? (
                            <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",
                              background:"#f3f4f6",borderRadius:20,
                              border:"1px dashed #d1d5db"}}>
                              <Trash2 size={11} color="#9ca3af"/>
                              <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>Pesan telah dihapus</span>
                            </div>
                          ) : (
                            <div style={{padding:"10px 16px",
                              background:isOwn?"linear-gradient(135deg,#6366f1 0%,#4338ca 100%)":"#fff",
                              borderRadius:isOwn?(isFirst?"20px 20px 5px 20px":"20px 5px 5px 20px"):(isFirst?"5px 20px 20px 20px":"5px 20px 20px 5px"),
                              boxShadow:isOwn?"0 4px 18px rgba(99,102,241,.28)":"0 1px 4px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.04)",
                              color:isOwn?"#fff":"#111827",fontSize:14,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                              {msg.content}
                            </div>
                          )}
                        </div>

                        <span style={{fontSize:10,color:"#a0aab4",marginTop:5,[isOwn?"marginRight":"marginLeft"]:4}}>{fmtTime(msg.created_at)}</span>
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
              style={{display:"flex",alignItems:"flex-end",gap:10,background:focused?"#fff":"#f8fafc",borderRadius:16,border:"1.5px solid #e5e7eb",padding:"10px 10px 10px 18px"}}>
              <textarea ref={taRef} value={input}
                onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=`${Math.min(e.target.scrollHeight,120)}px`;}}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                placeholder={`Pesan ke ${isGlobal?"#grcc-team":roomName}…`} rows={1}
                style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:14,color:"#111827",resize:"none",fontFamily:"inherit",lineHeight:1.6,maxHeight:120,overflowY:"auto",paddingTop:1}} />
              <motion.button whileHover={input.trim()?{scale:1.07}:{}} whileTap={input.trim()?{scale:.92}:{}}
                onClick={send} disabled={!input.trim()||sending}
                style={{width:38,height:38,borderRadius:12,border:"none",flexShrink:0,cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",
                  background:input.trim()?"linear-gradient(135deg,#6366f1,#4338ca)":"#f0f0f5",transition:"background .15s",
                  boxShadow:input.trim()?"0 4px 12px rgba(99,102,241,.3)":"none"}}>
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

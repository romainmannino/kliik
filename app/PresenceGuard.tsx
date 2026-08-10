'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type LeftPlayer={id:string;nickname:string;left_at:string|null};

export default function PresenceGuard(){
  const[notice,setNotice]=useState<string|null>(null);
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    const room=params.get('room');
    if(!room)return;
    const selfId=localStorage.getItem(`kliik-player-${room}`);
    if(!selfId)return;
    const sb=getSupabase();
    if(!sb)return;
    let active=true;
    let roomId:string|null=null;

    const markBack=async()=>{
      await sb.from('players').update({left_at:null}).eq('id',selfId);
    };
    const markLeft=()=>{
      const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!base||!key)return;
      fetch(`${base}/rest/v1/players?id=eq.${encodeURIComponent(selfId)}`,{
        method:'PATCH',keepalive:true,
        headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify({left_at:new Date().toISOString()})
      }).catch(()=>{});
    };
    const check=async()=>{
      const{data:r}=await sb.from('rooms').select('id,status').eq('code',room).single();
      if(!active||!r||r.status==='finished'){setNotice(null);return}
      roomId=r.id;
      const{data}=await sb.from('players').select('id,nickname,left_at').eq('room_id',r.id);
      if(!active)return;
      const left=((data||[]) as LeftPlayer[]).find(p=>p.id!==selfId&&p.left_at);
      setNotice(left?`${left.nickname} a quitté la partie.`:null);
    };

    markBack();check();
    const timer=window.setInterval(check,1500);
    const onPageShow=()=>{markBack();setNotice(null)};
    window.addEventListener('pageshow',onPageShow);
    window.addEventListener('pagehide',markLeft);
    window.addEventListener('beforeunload',markLeft);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('pageshow',onPageShow);window.removeEventListener('pagehide',markLeft);window.removeEventListener('beforeunload',markLeft)};
  },[]);

  if(!notice)return null;
  return <div className="presenceAlert"><strong>PARTIE INTERROMPUE</strong>{notice}<br/>Tu n’as plus besoin d’attendre.<button onClick={()=>setNotice(null)}>OK</button></div>;
}

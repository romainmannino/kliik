'use client';

import { useEffect, useState } from 'react';

const games = [
  { id:'ten', name:'10.000' },
  { id:'f1', name:'F1 START' },
  { id:'tap', name:'TAP 30' },
  { id:'memory', name:'MÉMOIRE' },
];

export default function AdminPage(){
  const [enabled,setEnabled]=useState<Record<string,boolean>>({ten:true,f1:true,tap:true,memory:true});
  useEffect(()=>{
    const raw=localStorage.getItem('kliik-enabled-games');
    if(raw) setEnabled(JSON.parse(raw));
  },[]);
  const toggle=(id:string)=>{
    setEnabled(prev=>{
      const next={...prev,[id]:!prev[id]};
      localStorage.setItem('kliik-enabled-games',JSON.stringify(next));
      return next;
    });
  };
  return <main style={{minHeight:'100dvh',background:'#1d16f5',padding:24,color:'white',fontFamily:'Arial'}}>
    <a href="/" style={{color:'#fff500',fontWeight:900,textDecoration:'none'}}>← KLIIK</a>
    <h1 style={{fontSize:46,marginBottom:6}}>Admin KLIIK</h1>
    <p style={{opacity:.8,maxWidth:620}}>Active ou masque les jeux de l’accueil. Cette page n’est accessible que via <b>/admin</b>.</p>
    <section style={{maxWidth:700,background:'white',color:'#111118',borderRadius:28,padding:20,marginTop:24}}>
      {games.map(g=><div key={g.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 0',borderBottom:'1px solid #eee'}}>
        <strong>{g.name}</strong>
        <button onClick={()=>toggle(g.id)} style={{border:0,borderRadius:999,padding:'10px 16px',fontWeight:900,background:enabled[g.id]?'#1d16f5':'#ddd',color:enabled[g.id]?'white':'#555'}}>{enabled[g.id]?'ACTIF':'MASQUÉ'}</button>
      </div>)}
    </section>
  </main>;
}

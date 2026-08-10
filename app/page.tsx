'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type GameId='ten'|'f1'|'tap'|'memory';
type Mode='solo'|'duo'|'event';
const GAMES:[GameId,string,string][]=[
  ['ten','10.000','Arrête le chrono au plus près de 10.000 s'],
  ['f1','F1 START','Attends l’extinction des 5 feux puis frappe'],
  ['tap','TAP 30','Fais le plus de KLIK possible en 30 s'],
  ['memory','MÉMOIRE','Mémorise 10 couleurs et replace-les'],
];

function share(text:string,url?:string){
  const target=url||location.href;
  if(navigator.share) navigator.share({title:'KLIIK',text,url:target}).catch(()=>{});
  else navigator.clipboard.writeText(`${text}\n${target}`).then(()=>alert('Lien copié !'));
}

export default function Home(){
  const [mode,setMode]=useState<Mode>('solo');
  const [game,setGame]=useState<GameId|null>(null);
  const [enabled,setEnabled]=useState<Record<GameId,boolean>>({ten:true,f1:true,tap:true,memory:true});
  const [setup,setSetup]=useState(false);
  const [selected,setSelected]=useState<GameId[]>(['ten','f1','tap','memory']);
  const [room,setRoom]=useState<string|null>(null);
  const [players,setPlayers]=useState<string[]>([]);
  const [nick,setNick]=useState('');
  const [host,setHost]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const raw=localStorage.getItem('kliik-enabled-games'); if(raw) setEnabled(JSON.parse(raw));
    const p=new URLSearchParams(location.search); const g=p.get('game') as GameId|null; if(g) setGame(g);
    const r=p.get('room'); if(r){setRoom(r);setMode((p.get('mode') as Mode)||'event');}
  },[]);

  useEffect(()=>{
    if(!room) return; const sb=getSupabase(); if(!sb) return;
    let roomId:string|undefined;
    sb.from('rooms').select('id').eq('code',room).single().then(({data})=>{roomId=data?.id; if(roomId) sb.from('players').select('nickname').eq('room_id',roomId).then(({data})=>setPlayers((data||[]).map(x=>x.nickname)));});
    const channel=sb.channel(`room-${room}`).on('postgres_changes',{event:'*',schema:'public',table:'players'},()=>{
      if(roomId) sb.from('players').select('nickname').eq('room_id',roomId).then(({data})=>setPlayers((data||[]).map(x=>x.nickname)));
    }).subscribe();
    return()=>{sb.removeChannel(channel)};
  },[room]);

  async function createRoom(){
    setBusy(true); const code=Math.random().toString(36).slice(2,8).toUpperCase(); const sb=getSupabase();
    if(sb){
      const {data,error}=await sb.from('rooms').insert({code,mode,games:selected}).select('id').single();
      if(!error&&data){ await sb.from('players').insert({room_id:data.id,nickname:'Organisateur',is_host:true}); }
    }
    setRoom(code); setHost(true); setPlayers(['Organisateur']); setSetup(false); setBusy(false);
    history.replaceState({},'',`/?room=${code}&mode=${mode}&host=1`);
  }

  async function joinRoom(){
    if(!room||!nick.trim()) return; const sb=getSupabase();
    if(sb){ const {data:r}=await sb.from('rooms').select('id').eq('code',room).single(); if(r) await sb.from('players').insert({room_id:r.id,nickname:nick.trim(),is_host:false}); }
    setPlayers(p=>p.includes(nick.trim())?p:[...p,nick.trim()]); setNick('');
  }

  if(game) return <GameScreen id={game} onBack={()=>{setGame(null);history.replaceState({},'','/')}}/>;
  if(room) return <Lobby room={room} mode={mode} host={host} players={players} nick={nick} setNick={setNick} join={joinRoom} selected={selected} onBack={()=>{setRoom(null);history.replaceState({},'','/')}}/>;
  if(setup) return <Setup mode={mode} selected={selected} setSelected={setSelected} create={createRoom} busy={busy} onBack={()=>setSetup(false)}/>;

  return <main className="appShell">
    <header className="homeHeader"><div className="logo">KL<span>II</span>K</div></header>
    <section className="homeHero"><h1>MINI JEUX.<br/>MAXI DÉFIS.</h1><p>Choisis ton mode, joue tout de suite, défie tes potes.</p></section>
    <nav className="modeTabs">
      {(['solo','duo','event'] as Mode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m==='solo'?'SOLO':m==='duo'?'DUO':'MULTI'}</button>)}
    </nav>
    <section className="gameGrid">
      {GAMES.filter(g=>enabled[g[0]]).map(([id,title,sub])=><button key={id} className={`liveCard card-${id}`} onClick={()=>mode==='solo'?setGame(id):(setSelected([id]),setSetup(true))}>
        <div className="cardVisual">{id==='ten'?<div className="miniTimer">9.98</div>:id==='f1'?<div className="miniLights">{[1,2,3,4,5].map(i=><i key={i}/>)}</div>:id==='tap'?<div className="tapPulse"><b>KLIK!</b></div>:<div className="memoDots">{[0,1,2,3].map(i=><i key={i}/>)}</div>}</div>
        <div className="cardCopy"><strong>{title}</strong><span>{sub}</span></div>
      </button>)}
    </section>
    {mode!=='solo'&&<button className="createRoomBtn" onClick={()=>setSetup(true)}>{mode==='duo'?'CRÉER UN DUEL':'CRÉER UNE ROOM'}</button>}
    <ScoreTicker/>
  </main>;
}

function Setup({mode,selected,setSelected,create,busy,onBack}:{mode:Mode;selected:GameId[];setSelected:(v:GameId[])=>void;create:()=>void;busy:boolean;onBack:()=>void}){
  return <main className="fullPanel"><button className="backBtn" onClick={onBack}>← Retour</button><h1>{mode==='duo'?'DUEL':'MULTIJOUEURS'}</h1><p>Choisis les jeux de la partie.</p><div className="setupGames">{GAMES.map(([id,title])=><button key={id} className={selected.includes(id)?'sel':''} onClick={()=>setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}>{title}</button>)}</div><button className="bigAction" disabled={!selected.length||busy} onClick={create}>{busy?'CRÉATION…':mode==='duo'?'CRÉER LE DUEL':'CRÉER LA ROOM'}</button></main>
}

function Lobby({room,mode,host,players,nick,setNick,join,selected,onBack}:{room:string;mode:Mode;host:boolean;players:string[];nick:string;setNick:(s:string)=>void;join:()=>void;selected:GameId[];onBack:()=>void}){
  const url=typeof window==='undefined'?'':`${location.origin}/?room=${room}&mode=${mode}`;
  return <main className="fullPanel lobby"><button className="backBtn" onClick={onBack}>← Accueil</button><div className="roomCode">ROOM <b>{room}</b></div><h1>{mode==='duo'?'DUEL':'MULTI'}</h1><p>{selected.length} jeu(x) sélectionné(s)</p>{host?<><div className="players"><strong>{players.length} joueur(s)</strong>{players.map((p,i)=><span key={i}>{p}</span>)}</div><button className="bigAction" onClick={()=>share(`Rejoins ma partie KLIIK : ${room}`,url)}>INVITER</button><button className="secondaryAction" disabled={mode==='duo'?players.length<2:players.length<2}>LANCER LA PARTIE</button></>:<><input className="nickInput" value={nick} onChange={e=>setNick(e.target.value)} placeholder="Ton prénom / pseudo"/><button className="bigAction" onClick={join}>REJOINDRE</button><div className="players">{players.map((p,i)=><span key={i}>{p}</span>)}</div></>}</main>
}

function ScoreTicker(){return <div className="ticker"><div className="tickerTrack"><span>🏆 10.000 — Léa 10.001</span><span>🏁 F1 — Tom 184 ms</span><span>⚡ TAP 30 — Noa 247</span><span>🧠 MÉMOIRE — Emma 10/10</span></div></div>}

function GameScreen({id,onBack}:{id:GameId;onBack:()=>void}){
  return <main className={`gamePage game-${id}`}><button className="backBtn gameBack" onClick={onBack}>← Jeux</button>{id==='ten'?<Ten/>:id==='f1'?<F1/>:id==='tap'?<Tap/>:<Memory/>}</main>
}

function EndActions({onReplay,onShare}:{onReplay:()=>void;onShare:()=>void}){return <div className="endActions"><button onClick={onShare}>DÉFIER UN AMI</button><button onClick={onReplay}>REJOUER</button></div>}

function Ten(){const[r,setR]=useState(false),[ms,setMs]=useState(0),[done,setDone]=useState(false);const st=useRef(0),raf=useRef(0);useEffect(()=>{if(!r)return;const f=()=>{setMs(performance.now()-st.current);raf.current=requestAnimationFrame(f)};raf.current=requestAnimationFrame(f);return()=>cancelAnimationFrame(raf.current)},[r]);const start=()=>{setDone(false);setMs(0);st.current=performance.now();setR(true)};const stop=()=>{setMs(performance.now()-st.current);setR(false);setDone(true)};return <section className="gameCore"><h1>10.000</h1><p>Arrête le chrono au plus près de 10.000 secondes.</p><div className="scoreDisplay">{(ms/1000).toFixed(3)}</div>{!done&&<button className="mainPlay" onClick={r?stop:start}>{r?'STOP':'START'}</button>}{done&&<><div className="resultPill">Écart {(Math.abs(ms-10000)/1000).toFixed(3)} s</div><EndActions onReplay={start} onShare={()=>share(`J’ai fait ${(ms/1000).toFixed(3)} s sur KLIIK. Tu peux me battre ?`,`${location.origin}/?game=ten&score=${(ms/1000).toFixed(3)}`)}/></>}</section>}

function F1(){const[p,setP]=useState<'idle'|'lights'|'go'|'done'|'false'>('idle'),[n,setN]=useState(0),[reaction,setReaction]=useState(0);const go=useRef(0),timers=useRef<number[]>([]);const clear=()=>timers.current.forEach(clearTimeout);const start=()=>{clear();setP('lights');setN(0);for(let i=1;i<=5;i++)timers.current.push(window.setTimeout(()=>setN(i),i*950));timers.current.push(window.setTimeout(()=>{setN(0);setP('go');go.current=performance.now()},5*950+900+Math.random()*1800))};const hit=()=>{if(p==='lights'){clear();setP('false')}else if(p==='go'){setReaction(performance.now()-go.current);setP('done')}};return <section className="gameCore f1Core" onPointerDown={(p==='lights'||p==='go')?hit:undefined}><h1>F1 START</h1><p>Les 5 feux rouges s’allument lentement. Appuie dès qu’ils s’éteignent tous.</p><div className="f1Lights">{[1,2,3,4,5].map(i=><i key={i} className={n>=i?'on':''}/>)}</div>{p==='idle'&&<button className="mainPlay" onPointerDown={e=>e.stopPropagation()} onClick={start}>LANCER</button>}{p==='lights'&&<b className="statusTxt">ATTENDS…</b>}{p==='go'&&<b className="statusTxt good">MAINTENANT !</b>}{(p==='done'||p==='false')&&<>{p==='done'?<div className="bigResult">{reaction.toFixed(0)} ms</div>:<div className="bigResult bad">FAUX DÉPART</div>}<EndActions onReplay={start} onShare={()=>share(p==='done'?`J’ai fait ${reaction.toFixed(0)} ms au F1 Start KLIIK. Tu peux me battre ?`:'Je te défie au F1 Start KLIIK.',`${location.origin}/?game=f1`)}/></>}</section>}

function Tap(){const[count,setCount]=useState(0),[time,setTime]=useState(30),[phase,setPhase]=useState<'idle'|'run'|'done'>('idle');useEffect(()=>{if(phase!=='run')return;const i=setInterval(()=>setTime(t=>{if(t<=1){clearInterval(i);setPhase('done');return 0}return t-1}),1000);return()=>clearInterval(i)},[phase]);const start=()=>{setCount(0);setTime(30);setPhase('run')};return <section className="gameCore"><h1>TAP 30</h1><p>Fais le plus de KLIK possible en 30 secondes.</p>{phase==='idle'&&<button className="mainPlay" onClick={start}>START</button>}{phase==='run'&&<><div className="tapHud2">{time}s · {count} KLIK</div><button className="tapBig" onPointerDown={()=>setCount(c=>c+1)}>KLIK!</button></>}{phase==='done'&&<><div className="bigResult">{count} KLIK</div><EndActions onReplay={start} onShare={()=>share(`J’ai fait ${count} KLIK en 30 secondes. Tu peux me battre ?`,`${location.origin}/?game=tap&score=${count}`)}/></>}</section>}

const MC=['#1d16f5','#fff500','#ff1694','#fff'];
function Memory(){const[seq,setSeq]=useState<number[]>([]),[ans,setAns]=useState<(number|null)[]>(Array(10).fill(null)),[phase,setPhase]=useState<'idle'|'memorize'|'answer'|'reveal'|'done'>('idle'),[active,setActive]=useState<number|null>(null),[revealed,setRevealed]=useState(0),[msg,setMsg]=useState(''),[score,setScore]=useState(0),[lost,setLost]=useState(false);const timers=useRef<number[]>([]);const start=()=>{timers.current.forEach(clearTimeout);setSeq(Array.from({length:10},()=>Math.floor(Math.random()*4)));setAns(Array(10).fill(null));setRevealed(0);setScore(0);setLost(false);setMsg('Mémorise de gauche à droite →');setPhase('memorize');setTimeout(()=>{setPhase('answer');setMsg('Clique chaque bille grise puis choisis sa couleur')},5000)};const validate=()=>{setPhase('reveal');let pts=0,bad=false;seq.forEach((c,i)=>timers.current.push(window.setTimeout(()=>{const ok=ans[i]===c;if(ok)pts++;else bad=true;setScore(pts);setLost(bad);setRevealed(i+1);setMsg(ok?'✓ BONNE RÉPONSE':'✕ MAUVAISE RÉPONSE — partie perdue');if(i===9)setPhase('done')},(i+1)*1500)))};return <section className="gameCore memoryCore"><h1>MÉMOIRE</h1><p>Mémorise les 10 couleurs de gauche à droite → puis reproduis-les.</p>{phase==='idle'&&<button className="mainPlay" onClick={start}>START</button>}{phase!=='idle'&&<><b className={`memoryMsg ${msg.startsWith('✕')?'badMsg':msg.startsWith('✓')?'goodMsg':''}`}>{msg}</b><div className="memRows"><div className="memRow">{seq.map((c,i)=><div key={i} className="memTarget" style={(phase==='memorize'||i<revealed)?{background:MC[c]}:undefined}><span className={(phase==='memorize'||i<revealed)?'cap open':'cap'}/></div>)}</div><div className="memRow">{ans.map((c,i)=><button key={i} onClick={()=>phase==='answer'&&setActive(i)} className={`memAns ${active===i?'active':''}`} style={c===null?undefined:{background:MC[c]}}/>)}</div></div>{phase==='answer'&&active!==null&&<div className="palette">{MC.map((c,i)=><button key={c} style={{background:c}} onClick={()=>{setAns(a=>{const n=[...a];n[active]=i;return n});setActive(null)}}/>)}</div>}{phase==='answer'&&<button className="mainPlay" disabled={ans.some(x=>x===null)} onClick={validate}>VALIDER</button>}{phase==='done'&&<><div className={`bigResult ${lost?'bad':''}`}>{lost?'PERDU':'PARFAIT'} · {score}/10</div><EndActions onReplay={start} onShare={()=>share(`J’ai fait ${score}/10 au jeu Mémoire KLIIK. Tu peux me battre ?`,`${location.origin}/?game=memory&score=${score}`)}/></>}</>}</section>}

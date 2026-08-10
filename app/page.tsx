'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase';

type GameId = 'ten' | 'f1' | 'tap' | 'memory';
type Mode = 'solo' | 'duo' | 'event';
type RoomStatus = 'lobby' | 'playing' | 'finished';
type Player = { id: string; nickname: string; is_host: boolean };
type RoomData = { id: string; code: string; mode: 'duo' | 'event'; games: GameId[]; status: RoomStatus; current_game: number };
type ScoreRow = { id: string; room_id: string; player_id: string; game_id: GameId; attempt: number; raw_score: number; display_score: string; points: number };
type GameResult = { raw: number; display: string };

const GAMES: { id: GameId; title: string; subtitle: string }[] = [
  { id: 'ten', title: '10.000', subtitle: 'Arrête le chrono au plus près de 10.000 s' },
  { id: 'f1', title: 'F1 START', subtitle: 'Attends l’extinction des 5 feux puis frappe' },
  { id: 'tap', title: 'TAP 30', subtitle: 'Fais le plus de KLIIK possible en 30 s' },
  { id: 'memory', title: 'MÉMOIRE', subtitle: 'Mémorise 10 couleurs et replace-les' },
];

function gameTitle(id: GameId) { return GAMES.find(g => g.id === id)?.title ?? id; }
function gameIsLowerBetter(id: GameId) { return id === 'ten' || id === 'f1'; }
function share(text: string, url?: string) {
  const target = url || location.href;
  if (navigator.share) navigator.share({ title: 'KLIIK', text, url: target }).catch(() => {});
  else navigator.clipboard.writeText(`${text}\n${target}`).then(() => alert('Lien copié !'));
}
function pointsForRank(rank: number) { return [10, 8, 6, 5, 4, 3, 2, 1][rank] ?? 0; }

export default function Home() {
  const [mode, setMode] = useState<Mode>('solo');
  const [game, setGame] = useState<GameId | null>(null);
  const [enabled, setEnabled] = useState<Record<GameId, boolean>>({ ten: true, f1: true, tap: true, memory: true });
  const [setup, setSetup] = useState(false);
  const [selected, setSelected] = useState<GameId[]>(['ten', 'f1', 'tap', 'memory']);
  const [hostNick, setHostNick] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [nick, setNick] = useState('');
  const [host, setHost] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('kliik-enabled-games');
    if (raw) { try { setEnabled(JSON.parse(raw)); } catch {} }
    const p = new URLSearchParams(location.search);
    const g = p.get('game') as GameId | null;
    if (g && GAMES.some(x => x.id === g)) setGame(g);
    const r = p.get('room');
    if (r) {
      setRoomCode(r);
      setMode((p.get('mode') as Mode) || 'event');
      const isHost = p.get('host') === '1';
      setHost(isHost);
      const saved = localStorage.getItem(`kliik-player-${r}`);
      if (saved) setPlayerId(saved);
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const sb = getSupabase();
    if (!sb) return;
    const refresh = async () => {
      const { data: room } = await sb.from('rooms').select('id,code,mode,games,status,current_game').eq('code', roomCode).single();
      if (!room) return;
      const normalized = { ...room, games: (room.games || []) as GameId[] } as RoomData;
      setRoomData(normalized);
      setSelected(normalized.games);
      const [{ data: ps }, { data: sc }] = await Promise.all([
        sb.from('players').select('id,nickname,is_host').eq('room_id', room.id).order('created_at'),
        sb.from('scores').select('id,room_id,player_id,game_id,attempt,raw_score,display_score,points').eq('room_id', room.id),
      ]);
      setPlayers((ps || []) as Player[]);
      setScores((sc || []) as ScoreRow[]);
    };
    refresh();
    const roomChannel = sb.channel(`kliik-room-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, refresh)
      .subscribe();
    return () => { sb.removeChannel(roomChannel); };
  }, [roomCode]);

  async function createRoom() {
    if (!hostNick.trim() || !selected.length) return;
    setBusy(true);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const sb = getSupabase();
    if (!sb) { setBusy(false); alert('Supabase non configuré.'); return; }
    const dbMode = mode === 'duo' ? 'duo' : 'event';
    const { data: room, error } = await sb.from('rooms').insert({ code, mode: dbMode, games: selected, status: 'lobby', current_game: 0 }).select('id,code,mode,games,status,current_game').single();
    if (error || !room) { setBusy(false); alert(error?.message || 'Impossible de créer la room'); return; }
    const { data: p, error: pErr } = await sb.from('players').insert({ room_id: room.id, nickname: hostNick.trim(), is_host: true }).select('id,nickname,is_host').single();
    if (pErr || !p) { setBusy(false); alert(pErr?.message || 'Impossible de créer le joueur'); return; }
    localStorage.setItem(`kliik-player-${code}`, p.id);
    setPlayerId(p.id); setHost(true); setRoomCode(code); setRoomData({ ...room, games: selected } as RoomData); setPlayers([p as Player]); setSetup(false); setBusy(false);
    history.replaceState({}, '', `/?room=${code}&mode=${mode}&host=1`);
  }

  async function joinRoom() {
    if (!roomCode || !nick.trim()) return;
    const sb = getSupabase(); if (!sb) return;
    const { data: r } = await sb.from('rooms').select('id').eq('code', roomCode).single();
    if (!r) return;
    const { data: p, error } = await sb.from('players').insert({ room_id: r.id, nickname: nick.trim(), is_host: false }).select('id,nickname,is_host').single();
    if (error || !p) { alert(error?.message || 'Impossible de rejoindre'); return; }
    localStorage.setItem(`kliik-player-${roomCode}`, p.id); setPlayerId(p.id); setNick('');
  }

  async function launchRoom() {
    if (!roomData || !host) return;
    const sb = getSupabase(); if (!sb) return;
    await sb.from('rooms').update({ status: 'playing', current_game: 0 }).eq('id', roomData.id);
  }

  async function submitRoomScore(result: GameResult) {
    if (!roomData || !playerId) return;
    const sb = getSupabase(); if (!sb) return;
    const currentGame = roomData.games[roomData.current_game];
    const attempt = roomData.current_game + 1;
    if (scores.some(s => s.player_id === playerId && s.attempt === attempt)) return;
    await sb.from('scores').insert({ room_id: roomData.id, player_id: playerId, game_id: currentGame, attempt, raw_score: result.raw, display_score: result.display, points: 0 });
  }

  async function advanceRoom() {
    if (!roomData || !host) return;
    const sb = getSupabase(); if (!sb) return;
    const attempt = roomData.current_game + 1;
    const currentGame = roomData.games[roomData.current_game];
    const ordered = scores.filter(s => s.attempt === attempt).sort((a, b) => gameIsLowerBetter(currentGame) ? a.raw_score - b.raw_score : b.raw_score - a.raw_score);
    for (let i = 0; i < ordered.length; i++) await sb.from('scores').update({ points: pointsForRank(i) }).eq('id', ordered[i].id);
    if (roomData.current_game >= roomData.games.length - 1) await sb.from('rooms').update({ status: 'finished' }).eq('id', roomData.id);
    else await sb.from('rooms').update({ current_game: roomData.current_game + 1 }).eq('id', roomData.id);
  }

  function goHome() {
    setGame(null); setSetup(false); setRoomCode(null); setRoomData(null); setHost(false); setPlayerId(null); setScores([]); setPlayers([]);
    history.replaceState({}, '', '/');
  }

  if (game) return <GameScreen id={game} onBack={goHome} />;
  if (roomCode) {
    if (roomData?.status === 'playing' || roomData?.status === 'finished') return <MatchRoom room={roomData} players={players} scores={scores} playerId={playerId} host={host} onSubmit={submitRoomScore} onAdvance={advanceRoom} onHome={goHome} />;
    return <Lobby room={roomCode} mode={mode} host={host} players={players} nick={nick} setNick={setNick} join={joinRoom} selected={roomData?.games || selected} onBack={goHome} onLaunch={launchRoom} />;
  }
  if (setup) return <Setup mode={mode} selected={selected} setSelected={setSelected} hostNick={hostNick} setHostNick={setHostNick} create={createRoom} busy={busy} onBack={() => setSetup(false)} />;
  return <HomeScreen mode={mode} setMode={setMode} enabled={enabled} setGame={setGame} selected={selected} setSelected={setSelected} setSetup={setSetup} />;
}

function HomeScreen({ mode, setMode, enabled, setGame, selected, setSelected, setSetup }:{ mode:Mode; setMode:(m:Mode)=>void; enabled:Record<GameId,boolean>; setGame:(g:GameId)=>void; selected:GameId[]; setSelected:(g:GameId[])=>void; setSetup:(v:boolean)=>void }) {
  return <main className="appShell"><header className="homeHeader"><div className="logo">KL<span>II</span>K</div></header><section className="homeHero"><h1>MINI JEUX.<br/>MAXI DÉFIS.</h1><p>Choisis ton mode, joue tout de suite, défie tes potes.</p></section><nav className="modeTabs">{(['solo','duo','event'] as Mode[]).map(m => <button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m==='solo'?'SOLO':m==='duo'?'DUO':'MULTI'}</button>)}</nav><section className="gameGrid">{GAMES.filter(g => enabled[g.id]).map(g => <button key={g.id} className={`liveCard card-${g.id}`} onClick={()=>{ if(mode==='solo') setGame(g.id); else { setSelected(selected.includes(g.id) ? selected : [...selected,g.id]); setSetup(true); } }}><CardVisual id={g.id}/><div className="cardCopy"><strong>{g.title}</strong><span>{g.subtitle}</span></div></button>)}</section>{mode!=='solo' && <button className="createRoomBtn" onClick={()=>setSetup(true)}>{mode==='duo'?'CRÉER UN DUEL':'CRÉER UNE ROOM'}</button>}<ScoreTicker/></main>;
}

function CardVisual({id}:{id:GameId}) {
  const [timer,setTimer]=useState(0); const [tap,setTap]=useState(0);
  useEffect(()=>{ if(id==='ten'){let t0=performance.now();const t=setInterval(()=>{let p=(performance.now()-t0)/3200;if(p>=1){p=1;setTimeout(()=>{t0=performance.now();setTimer(0)},650)}setTimer(9.987*p)},45);return()=>clearInterval(t)} if(id==='tap'){const t=setInterval(()=>setTap(v=>v>=223?0:Math.min(223,v+7)),80);return()=>clearInterval(t)} },[id]);
  if(id==='ten') return <div className="cardVisual"><div className="miniTimer">{timer.toFixed(3)}</div></div>;
  if(id==='f1') return <div className="cardVisual"><div className="miniLights">{[1,2,3,4,5].map(i=><i key={i}/>)}</div></div>;
  if(id==='tap') return <div className="cardVisual tapCardVisual"><div className="miniTapCount">{tap}</div><div className="tapPulse"><b>KLIIK!</b></div></div>;
  return <div className="cardVisual"><div className="memoDemo"><div className="memoDemoDots">{[2,1,3,0,2,3,1,0,1,2].map((c,i)=><i key={i} style={{background:['#1d16f5','#fff500','#ff1694','#fff'][c]}}/>)}</div><div className="memoSlider"/></div></div>;
}

function Setup({mode,selected,setSelected,hostNick,setHostNick,create,busy,onBack}:{mode:Mode;selected:GameId[];setSelected:(v:GameId[])=>void;hostNick:string;setHostNick:(s:string)=>void;create:()=>void;busy:boolean;onBack:()=>void}) {
  return <main className="fullPanel setupPanel"><button className="backBtn" onClick={onBack}>← Retour</button><h1>{mode==='duo'?'DUEL':'MULTIJOUEURS'}</h1><p>Jaune ✓ = sélectionné. Bleu = désélectionné.</p><div className="setupGames">{GAMES.map(g=><button key={g.id} className={selected.includes(g.id)?'sel':''} onClick={()=>setSelected(selected.includes(g.id)?selected.filter(x=>x!==g.id):[...selected,g.id])}>{selected.includes(g.id)?'✓ ':''}{g.title}</button>)}</div><input className="nickInput" value={hostNick} onChange={e=>setHostNick(e.target.value)} placeholder="Ton prénom / pseudo (organisateur)"/><button className="bigAction" disabled={!selected.length||!hostNick.trim()||busy} onClick={create}>{busy?'CRÉATION…':mode==='duo'?'CRÉER LE DUEL':'CRÉER LA ROOM'}</button></main>;
}

function Lobby({room,mode,host,players,nick,setNick,join,selected,onBack,onLaunch}:{room:string;mode:Mode;host:boolean;players:Player[];nick:string;setNick:(s:string)=>void;join:()=>void;selected:GameId[];onBack:()=>void;onLaunch:()=>void}) {
  const [qr,setQr]=useState(''); const [showQr,setShowQr]=useState(false); const url=typeof window==='undefined'?'':`${location.origin}/?room=${room}&mode=${mode}`;
  useEffect(()=>{ if(url) QRCode.toDataURL(url,{width:420,margin:1}).then(setQr).catch(()=>{}); },[url]);
  const inviteText = `${mode==='duo'?'Je te défie':'Je vous invite'} sur ${selected.length} mini-jeux KLIIK via le lien suivant :`;
  return <main className="fullPanel lobby"><button className="backBtn" onClick={onBack}>← Accueil</button><div className="roomCode">ROOM <b>{room}</b></div><h1>{mode==='duo'?'DUEL':'MULTI'}</h1><p>{selected.length} jeu(x) : {selected.map(gameTitle).join(' · ')}</p>{host?<><div className="players"><strong>{players.length} joueur(s)</strong>{players.map(p=><span key={p.id}>{p.is_host?'★ ':''}{p.nickname}</span>)}</div><div className="lobbyActions"><button className="bigAction" onClick={()=>share(inviteText,url)}>INVITER PAR LIEN</button><button className="qrAction" onClick={()=>setShowQr(v=>!v)}>{showQr?'MASQUER LE QR':'AFFICHER LE QR CODE'}</button></div>{showQr&&qr&&<div className="qrCard"><img src={qr} alt="QR code pour rejoindre la room"/><b>Scanne pour rejoindre</b></div>}<button className="secondaryAction" disabled={players.length<2} onClick={onLaunch}>LANCER LA PARTIE</button></>:<><input className="nickInput" value={nick} onChange={e=>setNick(e.target.value)} placeholder="Ton prénom / pseudo"/><button className="bigAction" disabled={!nick.trim()} onClick={join}>REJOINDRE</button><div className="players">{players.map(p=><span key={p.id}>{p.is_host?'★ ':''}{p.nickname}</span>)}</div><p className="waitHint">Après avoir rejoint, attends que l’organisateur lance la partie.</p></>}</main>;
}

function MatchRoom({room,players,scores,playerId,host,onSubmit,onAdvance,onHome}:{room:RoomData;players:Player[];scores:ScoreRow[];playerId:string|null;host:boolean;onSubmit:(r:GameResult)=>void;onAdvance:()=>void;onHome:()=>void}) {
  if(room.status==='finished') return <FinalRanking players={players} scores={scores} onHome={onHome}/>;
  const currentGame=room.games[room.current_game]; const attempt=room.current_game+1; const roundScores=scores.filter(s=>s.attempt===attempt); const mine=roundScores.find(s=>s.player_id===playerId); const allDone=players.length>0&&roundScores.length>=players.length;
  if(mine||allDone) return <RoundResults game={currentGame} round={room.current_game+1} total={room.games.length} players={players} roundScores={roundScores} allScores={scores} host={host} allDone={allDone} onAdvance={onAdvance}/>;
  if(!playerId) return <main className="fullPanel"><h1>ROOM</h1><p>Rejoins d’abord la partie avec ton prénom.</p><button className="bigAction" onClick={onHome}>RETOUR</button></main>;
  return <main className={`gamePage game-${currentGame}`}><div className="roundBadge">ÉPREUVE {room.current_game+1}/{room.games.length}</div><GameById id={currentGame} multiplayer onFinish={onSubmit}/></main>;
}

function RoundResults({game,round,total,players,roundScores,allScores,host,allDone,onAdvance}:{game:GameId;round:number;total:number;players:Player[];roundScores:ScoreRow[];allScores:ScoreRow[];host:boolean;allDone:boolean;onAdvance:()=>void}) {
  const ordered=[...roundScores].sort((a,b)=>gameIsLowerBetter(game)?a.raw_score-b.raw_score:b.raw_score-a.raw_score);
  return <main className="fullPanel resultsPanel"><div className="roundBadge">RÉSULTATS {round}/{total}</div><h1>{gameTitle(game)}</h1><div className="leaderboard">{ordered.map((s,i)=><div key={s.id} className={i<3?'podiumRow':''}><b>{i+1}</b><span>{players.find(p=>p.id===s.player_id)?.nickname||'Joueur'}</span><strong>{s.display_score}</strong></div>)}</div>{!allDone?<div className="waitingBox">⏳ {roundScores.length}/{players.length} ont joué<br/><small>On attend les autres…</small></div>:host?<button className="secondaryAction" onClick={onAdvance}>{round===total?'VOIR LE PODIUM FINAL':'ÉPREUVE SUIVANTE →'}</button>:<div className="waitingBox">✓ Tout le monde a joué<br/><small>L’organisateur lance la suite.</small></div>}<MiniOverall players={players} scores={allScores}/></main>;
}
function MiniOverall({players,scores}:{players:Player[];scores:ScoreRow[]}){const totals=players.map(p=>({p,pts:scores.filter(s=>s.player_id===p.id).reduce((a,s)=>a+s.points,0)})).sort((a,b)=>b.pts-a.pts);return <div className="miniOverall"><b>CLASSEMENT CUMULÉ</b>{totals.slice(0,3).map((x,i)=><span key={x.p.id}>{i+1}. {x.p.nickname} · {x.pts} pts</span>)}</div>}
function FinalRanking({players,scores,onHome}:{players:Player[];scores:ScoreRow[];onHome:()=>void}){const totals=players.map(p=>({p,pts:scores.filter(s=>s.player_id===p.id).reduce((a,s)=>a+s.points,0)})).sort((a,b)=>b.pts-a.pts);return <main className="fullPanel finalPanel"><div className="confetti">✦ ✧ ✦</div><h1>PODIUM</h1><div className="finalPodium">{totals.map((x,i)=><div key={x.p.id} className={`finalRank rank-${i+1}`}><b>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</b><span>{x.p.nickname}</span><strong>{x.pts} pts</strong></div>)}</div><button className="bigAction" onClick={onHome}>RETOUR À L’ACCUEIL</button></main>}
function ScoreTicker(){return <div className="ticker"><div className="tickerTrack"><span>🏆 10.000 — Léa 10.001</span><span>🏁 F1 — Tom 184 ms</span><span>⚡ TAP 30 — Noa 247</span><span>🧠 MÉMOIRE — Emma 10/10</span></div></div>}
function GameScreen({id,onBack}:{id:GameId;onBack:()=>void}){return <main className={`gamePage game-${id}`}><button className="backBtn gameBack" onClick={onBack}>← Jeux</button><GameById id={id}/></main>}
function GameById({id,multiplayer=false,onFinish}:{id:GameId;multiplayer?:boolean;onFinish?:(r:GameResult)=>void}){return id==='ten'?<Ten multiplayer={multiplayer} onFinish={onFinish}/>:id==='f1'?<F1 multiplayer={multiplayer} onFinish={onFinish}/>:id==='tap'?<Tap multiplayer={multiplayer} onFinish={onFinish}/>:<Memory multiplayer={multiplayer} onFinish={onFinish}/>}
function EndActions({onReplay,onShare}:{onReplay:()=>void;onShare:()=>void}){return <div className="endActions"><button onClick={onShare}>DÉFIER UN AMI</button><button onClick={onReplay}>REJOUER</button></div>}

function Ten({multiplayer,onFinish}:{multiplayer?:boolean;onFinish?:(r:GameResult)=>void}){const[r,setR]=useState(false),[ms,setMs]=useState(0),[done,setDone]=useState(false);const st=useRef(0),raf=useRef(0);useEffect(()=>{if(!r)return;const f=()=>{setMs(performance.now()-st.current);raf.current=requestAnimationFrame(f)};raf.current=requestAnimationFrame(f);return()=>cancelAnimationFrame(raf.current)},[r]);const start=()=>{setDone(false);setMs(0);st.current=performance.now();setR(true)};const stop=()=>{const value=performance.now()-st.current;setMs(value);setR(false);setDone(true);if(multiplayer)onFinish?.({raw:Math.abs(value-10000),display:`${(value/1000).toFixed(3)} s`})};return <section className="gameCore"><h1>10.000</h1><p>Arrête le chrono au plus près de 10.000 secondes.</p><div className="scoreDisplay">{(ms/1000).toFixed(3)}</div>{!done&&<button className="mainPlay" onClick={r?stop:start}>{r?'STOP':'START'}</button>}{done&&!multiplayer&&<><div className="resultPill">Écart {(Math.abs(ms-10000)/1000).toFixed(3)} s</div><EndActions onReplay={start} onShare={()=>share(`J’ai fait ${(ms/1000).toFixed(3)} s sur KLIIK. Tu peux me battre ?`,`${location.origin}/?game=ten&score=${(ms/1000).toFixed(3)}`)}/></>}{done&&multiplayer&&<div className="resultPill">Score envoyé ✓</div>}</section>}

function F1({multiplayer,onFinish}:{multiplayer?:boolean;onFinish?:(r:GameResult)=>void}){const[p,setP]=useState<'idle'|'lights'|'go'|'done'|'false'>('idle'),[n,setN]=useState(0),[reaction,setReaction]=useState(0);const go=useRef(0),timers=useRef<number[]>([]);const clear=()=>timers.current.forEach(clearTimeout);const start=()=>{clear();setP('lights');setN(0);timers.current=[];for(let i=1;i<=5;i++)timers.current.push(window.setTimeout(()=>setN(i),i*950));timers.current.push(window.setTimeout(()=>{setN(0);setP('go');go.current=performance.now()},5*950+900+Math.random()*1800))};const hit=()=>{if(p==='lights'){clear();setP('false');if(multiplayer)onFinish?.({raw:999999,display:'FAUX DÉPART'})}else if(p==='go'){const r=performance.now()-go.current;setReaction(r);setP('done');if(multiplayer)onFinish?.({raw:r,display:`${r.toFixed(0)} ms`})}};return <section className="gameCore f1Core" onPointerDown={(p==='lights'||p==='go')?hit:undefined}><h1>F1 START</h1><p>Les 5 feux rouges s’allument lentement. Appuie dès qu’ils s’éteignent tous.</p><div className="f1Lights">{[1,2,3,4,5].map(i=><i key={i} className={n>=i?'on':''}/>)}</div>{p==='idle'&&<button className="mainPlay" onPointerDown={e=>e.stopPropagation()} onClick={start}>LANCER</button>}{p==='lights'&&<b className="statusTxt">ATTENDS…</b>}{p==='go'&&<b className="statusTxt good">MAINTENANT !</b>}{(p==='done'||p==='false')&&<>{p==='done'?<div className="bigResult">{reaction.toFixed(0)} ms</div>:<div className="bigResult bad">FAUX DÉPART</div>}{multiplayer?<div className="resultPill">Score envoyé ✓</div>:<EndActions onReplay={start} onShare={()=>share(p==='done'?`J’ai fait ${reaction.toFixed(0)} ms au F1 Start KLIIK. Tu peux me battre ?`:'Je te défie au F1 Start KLIIK.',`${location.origin}/?game=f1`)}/>}</>}</section>}

function Tap({multiplayer,onFinish}:{multiplayer?:boolean;onFinish?:(r:GameResult)=>void}){const[count,setCount]=useState(0),[time,setTime]=useState(30),[phase,setPhase]=useState<'idle'|'run'|'done'>('idle');const countRef=useRef(0);useEffect(()=>{countRef.current=count},[count]);useEffect(()=>{if(phase!=='run')return;const i=setInterval(()=>setTime(t=>{if(t<=1){clearInterval(i);setPhase('done');setTimeout(()=>onFinish?.({raw:countRef.current,display:`${countRef.current} KLIIK`}),0);return 0}return t-1}),1000);return()=>clearInterval(i)},[phase,onFinish]);const start=()=>{setCount(0);setTime(30);setPhase('run')};return <section className="gameCore"><h1>TAP 30</h1><p>Fais le plus de KLIIK possible en 30 secondes.</p>{phase==='idle'&&<button className="mainPlay" onClick={start}>START</button>}{phase==='run'&&<><div className="tapHud2">{time}s · {count} KLIIK</div><button className="tapBig" onPointerDown={()=>setCount(c=>c+1)}>KLIIK!</button></>}{phase==='done'&&<><div className="bigResult">{count} KLIIK</div>{multiplayer?<div className="resultPill">Score envoyé ✓</div>:<EndActions onReplay={start} onShare={()=>share(`J’ai fait ${count} KLIIK en 30 secondes. Tu peux me battre ?`,`${location.origin}/?game=tap&score=${count}`)}/>}</>}</section>}

const MC=['#1d16f5','#fff500','#ff1694','#fff'];
function Memory({multiplayer,onFinish}:{multiplayer?:boolean;onFinish?:(r:GameResult)=>void}){const[seq,setSeq]=useState<number[]>([]),[ans,setAns]=useState<(number|null)[]>(Array(10).fill(null)),[phase,setPhase]=useState<'idle'|'memorize'|'answer'|'reveal'|'done'>('idle'),[active,setActive]=useState(0),[revealed,setRevealed]=useState(0),[msg,setMsg]=useState(''),[score,setScore]=useState(0),[lost,setLost]=useState(false);const timers=useRef<number[]>([]);const start=()=>{timers.current.forEach(clearTimeout);timers.current=[];setSeq(Array.from({length:10},()=>Math.floor(Math.random()*4)));setAns(Array(10).fill(null));setRevealed(0);setScore(0);setLost(false);setActive(0);setMsg('Mémorise de gauche à droite →');setPhase('memorize');window.setTimeout(()=>{setPhase('answer');setMsg('Choisis la couleur de la bille 1')},5000)};const choose=(color:number)=>{setAns(prev=>{const next=[...prev];next[active]=color;return next});setActive(Math.min(9,active+1));setMsg(active<9?`Choisis la couleur de la bille ${active+2}`:'Tu peux corriger une bille ou valider')};const validate=()=>{if(ans.some(a=>a===null))return;setPhase('reveal');let pts=0,bad=false;seq.forEach((c,i)=>timers.current.push(window.setTimeout(()=>{const ok=ans[i]===c;if(ok)pts++;else bad=true;setScore(pts);setLost(bad);setRevealed(i+1);setMsg(ok?'✓ BONNE RÉPONSE':'✕ MAUVAISE RÉPONSE — partie perdue');if(i===9){setPhase('done');if(multiplayer)onFinish?.({raw:pts,display:`${pts}/10${bad?' · perdu':''}`})}},(i+1)*1500)))};return <section className="gameCore memoryCore"><h1>MÉMOIRE</h1><p>Mémorise les 10 couleurs de gauche à droite → puis reproduis-les.</p>{phase==='idle'&&<button className="mainPlay" onClick={start}>START</button>}{phase!=='idle'&&<><b className={`memoryMsg ${msg.startsWith('✕')?'badMsg':msg.startsWith('✓')?'goodMsg':''}`}>{msg}</b><div className="memRows"><div className="memRow">{seq.map((c,i)=><div className="memTarget" key={i} style={{background:MC[c]}}><span className={`cap ${phase==='memorize'||i<revealed?'open':''}`}/></div>)}</div><div className="memRow">{ans.map((c,i)=><button key={i} className={`memAns ${active===i&&phase==='answer'?'active':''}`} style={{background:c===null?'#777':MC[c]}} onClick={()=>phase==='answer'&&setActive(i)}/>)}</div></div>{phase==='answer'&&<><div className="palette">{MC.map((c,i)=><button key={c} style={{background:c}} onClick={()=>choose(i)}/>)}</div><button className="mainPlay" disabled={ans.some(a=>a===null)} onClick={validate}>VALIDER</button></>}{phase==='done'&&<><div className={`resultPill ${lost?'lossPill':''}`}>{lost?'PERDU':'PARFAIT'} · {score}/10</div>{multiplayer?<div className="resultPill">Score envoyé ✓</div>:<EndActions onReplay={start} onShare={()=>share(`J’ai fait ${score}/10 au jeu Mémoire KLIIK. Tu peux faire mieux ?`,`${location.origin}/?game=memory&score=${score}`)}/>}</>}</>}</section>}

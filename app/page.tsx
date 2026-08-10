'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type GameId = 'ten' | 'f1' | 'tap' | 'memory';

type GameMeta = {
  id: GameId;
  title: string;
  subtitle: string;
  icon: string;
  tone: 'yellow' | 'white' | 'pink' | 'blue';
};

const GAMES: GameMeta[] = [
  { id: 'ten', title: '10.000', subtitle: 'Arrête le chrono pile à 10 secondes.', icon: '⏱️', tone: 'yellow' },
  { id: 'f1', title: 'F1 START', subtitle: 'Attends l’extinction des 5 feux. Puis frappe.', icon: '🏎️', tone: 'white' },
  { id: 'tap', title: 'TAP 30', subtitle: 'Le plus de clics en 30 secondes.', icon: '👆', tone: 'pink' },
  { id: 'memory', title: 'MÉMO', subtitle: 'Mémorise les couleurs et reproduis la suite.', icon: '🧠', tone: 'blue' },
];

export default function Home() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<GameId, boolean>>({ ten: true, f1: true, tap: true, memory: true });

  const visibleGames = GAMES.filter((g) => enabled[g.id]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">KL<span>II</span>K</div>
        <button className="adminBtn" onClick={() => { setAdminOpen((v) => !v); setActiveGame(null); }}>
          {adminOpen ? 'Fermer admin' : 'Admin'}
        </button>
      </header>

      {adminOpen ? (
        <Admin enabled={enabled} setEnabled={setEnabled} />
      ) : activeGame ? (
        <GameRouter id={activeGame} onBack={() => setActiveGame(null)} />
      ) : (
        <>
          <section className="hero">
            <div className="heroCard">
              <h1>MINI JEUX.<br />MAXI DÉFIS.</h1>
              <p>Joue maintenant. Défie tes potes. Bientôt : crée ta room, choisis tes jeux et lance la compétition.</p>
              <div className="heroDots"><i /><i /><i /></div>
            </div>
            <div className="scoreCard">
              <span className="eyebrow">KLIIK du jour</span>
              <strong>4</strong>
              <small>jeux instantanés · zéro compte</small>
            </div>
          </section>

          <div className="sectionHead">
            <div><h2>Choisis ton défi</h2><p>Une règle. Un écran. Un score.</p></div>
          </div>

          <section className="games">
            {visibleGames.map((game) => (
              <button key={game.id} className={`gameCard ${game.tone}`} onClick={() => setActiveGame(game.id)}>
                <span className="gameIcon">{game.icon}</span>
                <div>
                  <h3>{game.title}</h3>
                  <p>{game.subtitle}</p>
                  <div className="go">JOUER →</div>
                </div>
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function Admin({ enabled, setEnabled }: { enabled: Record<GameId, boolean>; setEnabled: React.Dispatch<React.SetStateAction<Record<GameId, boolean>>> }) {
  return (
    <section className="adminPanel">
      <h2>Admin KLIIK</h2>
      <p className="subtle">Active ou désactive les jeux visibles. Les règles détaillées viendront ensuite ici.</p>
      {GAMES.map((g) => (
        <div className="adminRow" key={g.id}>
          <div><strong>{g.icon} {g.title}</strong><div className="subtle">Solo · défi · room bientôt</div></div>
          <button className={`switch ${enabled[g.id] ? 'on' : ''}`} onClick={() => setEnabled((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}><span /></button>
        </div>
      ))}
    </section>
  );
}

function GameRouter({ id, onBack }: { id: GameId; onBack: () => void }) {
  return (
    <section className="playArea">
      <div className="playTop"><button className="back" onClick={onBack}>← Jeux</button><div className="brand" style={{fontSize:28}}>KL<span>II</span>K</div></div>
      {id === 'ten' && <TenSeconds />}
      {id === 'f1' && <F1Start />}
      {id === 'tap' && <Tap30 />}
      {id === 'memory' && <Memory />}
    </section>
  );
}

function TenSeconds() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      setElapsed(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const start = () => { setResult(null); setElapsed(0); startRef.current = performance.now(); setRunning(true); };
  const stop = () => { const ms = performance.now() - startRef.current; setRunning(false); setElapsed(ms); setResult(ms); };
  const diff = result === null ? null : Math.abs(result - 10000);

  return (
    <div className="gameStage">
      <h2>⏱️ Arrête à 10.000</h2>
      <div className="bigTime">{(elapsed / 1000).toFixed(3)}</div>
      {!running ? <button className="primary" onClick={start}>{result === null ? 'START' : 'REJOUER'}</button> : <button className="primary" onClick={stop}>STOP</button>}
      {diff !== null && <div className="result">Écart : {(diff / 1000).toFixed(3)} s {diff <= 20 ? '🔥' : diff <= 100 ? '👏' : ''}</div>}
      {result !== null && <button className="secondary" onClick={() => navigator.share?.({ title: 'KLIIK', text: `J’ai fait ${(result / 1000).toFixed(3)} s sur KLIIK. Tu peux me battre ?` })}>Défier un ami</button>}
    </div>
  );
}

function F1Start() {
  const [phase, setPhase] = useState<'idle'|'lights'|'go'|'done'|'false'>('idle');
  const [count, setCount] = useState(0);
  const [reaction, setReaction] = useState<number | null>(null);
  const goAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const start = () => {
    clearTimers(); setReaction(null); setCount(0); setPhase('lights');
    for (let i = 1; i <= 5; i++) timers.current.push(window.setTimeout(() => setCount(i), i * 650));
    const offDelay = 5 * 650 + 700 + Math.random() * 2200;
    timers.current.push(window.setTimeout(() => { setCount(0); setPhase('go'); goAt.current = performance.now(); }, offDelay));
  };

  const hit = () => {
    if (phase === 'lights') { clearTimers(); setPhase('false'); return; }
    if (phase === 'go') { setReaction(performance.now() - goAt.current); setPhase('done'); }
  };

  return (
    <div className="gameStage" onPointerDown={phase === 'lights' || phase === 'go' ? hit : undefined}>
      <h2>🏎️ F1 Start</h2>
      <div className="lights">{[1,2,3,4,5].map((n) => <div key={n} className={`light ${count >= n ? 'on' : ''}`} />)}</div>
      {phase === 'idle' && <button className="primary" onClick={start}>LANCER</button>}
      {phase === 'lights' && <div className="result">Attends…</div>}
      {phase === 'go' && <div className="result">MAINTENANT !</div>}
      {phase === 'done' && <><div className="bigTime" style={{fontSize:'clamp(64px,15vw,120px)'}}>{reaction?.toFixed(0)} ms</div><button className="primary" onClick={start}>REJOUER</button></>}
      {phase === 'false' && <><div className="bigTime" style={{fontSize:'clamp(48px,12vw,90px)'}}>FAUX DÉPART</div><button className="primary" onClick={start}>REJOUER</button></>}
    </div>
  );
}

function Tap30() {
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTime((t) => {
      if (t <= 1) { clearInterval(id); setRunning(false); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => { setCount(0); setTime(30); setRunning(true); };
  return (
    <div className="gameStage">
      <h2>👆 Tap 30</h2>
      <div className="result">{time}s · {count} clics</div>
      {running ? <button className="tapZone" onPointerDown={() => setCount((c) => c + 1)}>KLIK!</button> : <button className="primary" onClick={start}>{time === 0 ? 'REJOUER' : 'START'}</button>}
      {!running && time === 0 && <div className="result">Score final : {count}</div>}
    </div>
  );
}

const COLORS = ['#ff1694', '#fff500', '#1d16f5', '#27d9a1', '#ff6b35', '#7a4cff'];

function Memory() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [input, setInput] = useState<number[]>([]);
  const [show, setShow] = useState(false);
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState('Prêt ?');

  const newRound = (nextRound = round + 1) => {
    const len = Math.min(3 + nextRound, 9);
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * COLORS.length));
    setRound(nextRound); setSequence(seq); setInput([]); setShow(true); setStatus('Mémorise…');
    window.setTimeout(() => { setShow(false); setStatus('À toi !'); }, 2200);
  };

  const choose = (color: number) => {
    if (show || sequence.length === 0) return;
    const next = [...input, color];
    setInput(next);
    const idx = next.length - 1;
    if (sequence[idx] !== color) { setStatus(`Perdu — niveau ${round}`); setSequence([]); return; }
    if (next.length === sequence.length) { setStatus('Parfait ! Niveau suivant…'); window.setTimeout(() => newRound(round + 1), 850); }
  };

  const palette = useMemo(() => COLORS.map((color, i) => ({ color, i })), []);

  return (
    <div className="gameStage">
      <h2>🧠 Mémoire couleurs</h2>
      <div className="result">Niveau {round || 1} · {status}</div>
      {show && <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',maxWidth:520}}>{sequence.map((c, i) => <div key={i} style={{width:54,height:54,borderRadius:18,background:COLORS[c]}} />)}</div>}
      {!show && sequence.length > 0 && <div className="memoryGrid">{palette.map(({color,i}) => <button key={i} className="memoryCell" style={{background:color}} onClick={() => choose(i)} />)}</div>}
      {sequence.length === 0 && <button className="primary" onClick={() => newRound(1)}>START</button>}
    </div>
  );
}

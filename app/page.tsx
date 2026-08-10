'use client';

import { useEffect, useRef, useState } from 'react';

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
  { id: 'memory', title: 'MÉMO', subtitle: 'Mémorise 10 couleurs et replace-les.', icon: '🧠', tone: 'blue' },
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
          <section className="heroSimple">
            <h1>MINI JEUX.<br />MAXI DÉFIS.</h1>
            <p>Joue maintenant. Défie tes potes. Bientôt : crée ta room, choisis tes jeux et lance la compétition.</p>
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
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [replayReady, setReplayReady] = useState(false);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setTime((t) => {
      if (t <= 1) {
        clearInterval(id);
        setPhase('done');
        setReplayReady(false);
        window.setTimeout(() => setReplayReady(true), 1000);
        return 0;
      }
      return t - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => { setCount(0); setTime(30); setReplayReady(false); setPhase('running'); };

  return (
    <div className="gameStage tapStage">
      <h2>👆 Tap 30</h2>
      {phase === 'idle' && <><div className="result">30 secondes. Clique le plus vite possible.</div><button className="primary" onClick={start}>START</button></>}
      {phase === 'running' && <>
        <div className="result">{time}s · {count} clics</div>
        <button className="tapZone" onPointerDown={() => setCount((c) => c + 1)}>KLIK!</button>
      </>}
      {phase === 'done' && <div className="tapResultScreen">
        <div className="tapScoreLabel">SCORE FINAL</div>
        <div className="tapScore">{count}</div>
        <div className="tapScoreUnit">clics en 30 secondes</div>
        <button className="primary replaySeparated" disabled={!replayReady} onClick={start}>{replayReady ? 'REJOUER' : '...'}</button>
      </div>}
    </div>
  );
}

const MEMORY_COLORS = ['#1d16f5', '#fff500', '#ff1694', '#ffffff'];

function Memory() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [phase, setPhase] = useState<'idle' | 'memorize' | 'answer' | 'reveal' | 'done'>('idle');
  const [selectedColor, setSelectedColor] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState(0);
  const revealTimers = useRef<number[]>([]);

  useEffect(() => () => revealTimers.current.forEach(clearTimeout), []);

  const start = () => {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
    const seq = Array.from({ length: 10 }, () => Math.floor(Math.random() * MEMORY_COLORS.length));
    setSequence(seq);
    setAnswers(Array(10).fill(null));
    setSelectedColor(0);
    setRevealed(0);
    setScore(0);
    setPhase('memorize');
    window.setTimeout(() => setPhase('answer'), 5000);
  };

  const setSlot = (index: number) => {
    if (phase !== 'answer') return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = selectedColor;
      return next;
    });
  };

  const validate = () => {
    if (phase !== 'answer' || answers.some((a) => a === null)) return;
    setPhase('reveal');
    setRevealed(0);
    let points = 0;
    sequence.forEach((color, index) => {
      revealTimers.current.push(window.setTimeout(() => {
        if (answers[index] === color) points += 1;
        setScore(points);
        setRevealed(index + 1);
        if (index === 9) setPhase('done');
      }, (index + 1) * 500));
    });
  };

  const canValidate = answers.every((a) => a !== null);

  return (
    <div className="gameStage memoryStage">
      <h2>🧠 Mémoire couleurs</h2>
      {phase === 'idle' && <><div className="result">Mémorise les 10 couleurs en 5 secondes.</div><button className="primary" onClick={start}>START</button></>}

      {phase !== 'idle' && <>
        <div className="memoryStatus">
          {phase === 'memorize' && 'Mémorise… 5 secondes'}
          {phase === 'answer' && 'Reproduis la combinaison'}
          {phase === 'reveal' && `Vérification… ${revealed}/10`}
          {phase === 'done' && `Résultat : ${score}/10`}
        </div>

        <div className="memoryBoard">
          <div className="memoryRow targetRow">
            {sequence.map((color, index) => {
              const visible = phase === 'memorize' || (phase !== 'answer' && index < revealed);
              return <div key={index} className={`memoryDot target ${visible ? 'visible' : 'covered'}`} style={visible ? { background: MEMORY_COLORS[color] } : undefined} />;
            })}
          </div>

          <div className="memoryRow answerRow">
            {answers.map((color, index) => {
              const checked = phase === 'reveal' || phase === 'done';
              const isCorrect = checked && index < revealed ? color === sequence[index] : false;
              const isWrong = checked && index < revealed ? color !== sequence[index] : false;
              return (
                <button
                  key={index}
                  className={`memoryDot answer ${color === null ? 'empty' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                  style={color === null ? undefined : { background: MEMORY_COLORS[color] }}
                  onClick={() => setSlot(index)}
                  disabled={phase !== 'answer'}
                  aria-label={`Pastille ${index + 1}`}
                />
              );
            })}
          </div>
        </div>

        {phase === 'answer' && <>
          <div className="memoryPalette">
            {MEMORY_COLORS.map((color, index) => <button key={color} className={`paletteColor ${selectedColor === index ? 'selected' : ''}`} style={{background: color}} onClick={() => setSelectedColor(index)} aria-label={`Couleur ${index + 1}`} />)}
          </div>
          <button className="primary" disabled={!canValidate} onClick={validate}>VALIDER</button>
        </>}

        {phase === 'done' && <button className="primary" onClick={start}>REJOUER</button>}
      </>}
    </div>
  );
}

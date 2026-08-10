'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

type GameId = 'ten' | 'f1' | 'tap' | 'memory';
type Tone = 'yellow' | 'white' | 'pink' | 'blue';

type GameMeta = {
  id: GameId;
  title: string;
  subtitle: string;
  icon: string;
  tone: Tone;
};

const GAMES: GameMeta[] = [
  { id: 'ten', title: '10.000', subtitle: 'Arrête le chrono pile à 10 secondes.', icon: '⏱️', tone: 'yellow' },
  { id: 'f1', title: 'F1 START', subtitle: 'Attends l’extinction des 5 feux. Puis frappe.', icon: '🏎️', tone: 'white' },
  { id: 'tap', title: 'TAP 30', subtitle: 'Le plus de KLIK possible en 30 secondes.', icon: '👆', tone: 'pink' },
  { id: 'memory', title: 'MÉMOIRE', subtitle: 'Mémorise 10 couleurs et replace-les.', icon: '🧠', tone: 'blue' },
];

function challengeUrl(game: GameId, result?: string) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('game', game);
  if (result) url.searchParams.set('score', result);
  return url.toString();
}

async function shareChallenge(game: GameId, text: string, result?: string) {
  const url = challengeUrl(game, result);
  const payload = { title: 'KLIIK', text, url };
  try {
    if (navigator.share) await navigator.share(payload);
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      window.alert('Défi copié ! Envoie-le à ton ami.');
    }
  } catch {
    // partage annulé
  }
}

export default function Home() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<GameId, boolean>>({ ten: true, f1: true, tap: true, memory: true });

  useEffect(() => {
    const game = new URLSearchParams(window.location.search).get('game') as GameId | null;
    if (game && GAMES.some((g) => g.id === game)) setActiveGame(game);
  }, []);

  const visibleGames = GAMES.filter((g) => enabled[g.id]);

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand brandButton" onClick={() => { setAdminOpen(false); setActiveGame(null); }}>KL<span>II</span>K</button>
        <button className="adminBtn" onClick={() => { setAdminOpen((v) => !v); setActiveGame(null); }}>
          {adminOpen ? 'Fermer admin' : 'Admin'}
        </button>
      </header>

      {adminOpen ? <Admin enabled={enabled} setEnabled={setEnabled} /> : activeGame ? (
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

function Admin({ enabled, setEnabled }: { enabled: Record<GameId, boolean>; setEnabled: Dispatch<SetStateAction<Record<GameId, boolean>>> }) {
  return (
    <section className="adminPanel">
      <h2>Admin KLIIK</h2>
      <p className="subtle">Active ou désactive les jeux visibles.</p>
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
  const game = GAMES.find((g) => g.id === id)!;
  return (
    <section className={`playArea map map-${id}`}>
      <div className="mapDecor" aria-hidden="true" />
      <div className="playTop">
        <button className="back" onClick={onBack}>← Jeux</button>
        <div className="gameMiniTitle">{game.title}</div>
      </div>
      {id === 'ten' && <TenSeconds />}
      {id === 'f1' && <F1Start />}
      {id === 'tap' && <Tap30 />}
      {id === 'memory' && <Memory />}
    </section>
  );
}

function GameIntro({ children }: { children: ReactNode }) {
  return <p className="gameIntro">{children}</p>;
}

function ChallengeButton({ onClick }: { onClick: () => void }) {
  return <button className="challengeBtn" onClick={onClick}><span>↗</span> DÉFIER UN AMI</button>;
}

function EndActions({ replay, challenge, replayDisabled = false }: { replay: () => void; challenge: () => void; replayDisabled?: boolean }) {
  return (
    <div className="endActions">
      <ChallengeButton onClick={challenge} />
      <button className="primary" disabled={replayDisabled} onClick={replay}>{replayDisabled ? 'RÉSULTAT…' : 'REJOUER'}</button>
    </div>
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
    <div className="gameStage tenStage">
      <h2>10.000</h2>
      <GameIntro>Lance le chrono puis arrête-le au plus près de <strong>10.000 secondes</strong>.</GameIntro>
      <div className="timerMachine"><div className="bigTime">{(elapsed / 1000).toFixed(3)}</div></div>
      {result === null && (!running ? <button className="primary" onClick={start}>START</button> : <button className="primary stopBtn" onClick={stop}>STOP</button>)}
      {diff !== null && <>
        <div className="result resultCard">Écart : {(diff / 1000).toFixed(3)} s {diff <= 20 ? '🔥' : diff <= 100 ? '👏' : ''}</div>
        <EndActions replay={start} challenge={() => shareChallenge('ten', `J’ai fait ${(result! / 1000).toFixed(3)} s sur KLIIK. Tu peux me battre ?`, (result! / 1000).toFixed(3))} />
      </>}
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
    const step = 950;
    for (let i = 1; i <= 5; i++) timers.current.push(window.setTimeout(() => setCount(i), i * step));
    const offDelay = 5 * step + 900 + Math.random() * 2200;
    timers.current.push(window.setTimeout(() => { setCount(0); setPhase('go'); goAt.current = performance.now(); }, offDelay));
  };

  const hit = () => {
    if (phase === 'lights') { clearTimers(); setPhase('false'); return; }
    if (phase === 'go') { setReaction(performance.now() - goAt.current); setPhase('done'); }
  };

  const finished = phase === 'done' || phase === 'false';

  return (
    <div className="gameStage f1Stage" onPointerDown={phase === 'lights' || phase === 'go' ? hit : undefined}>
      <h2>F1 START</h2>
      <GameIntro>Les 5 feux rouges s’allument <strong>un par un</strong>. Appuie dès qu’ils s’éteignent tous. Trop tôt = faux départ.</GameIntro>
      <div className="startingGantry">
        <div className="lights">{[1,2,3,4,5].map((n) => <div key={n} className={`light ${count >= n ? 'on' : ''}`} />)}</div>
      </div>
      <div className="trackLine"><span>🏎️</span></div>
      {phase === 'idle' && <button className="primary" onPointerDown={(e) => e.stopPropagation()} onClick={start}>LANCER</button>}
      {phase === 'lights' && <div className="result f1Message">ATTENDS…</div>}
      {phase === 'go' && <div className="result goMessage">MAINTENANT !</div>}
      {phase === 'done' && <div className="reactionScore">{reaction?.toFixed(0)} <small>ms</small></div>}
      {phase === 'false' && <div className="falseStart">FAUX<br />DÉPART</div>}
      {finished && <EndActions replay={start} challenge={() => shareChallenge('f1', phase === 'false' ? 'J’ai fait un faux départ au F1 Start de KLIIK 😅 Tu fais mieux ?' : `Mon temps de réaction : ${reaction!.toFixed(0)} ms sur KLIIK. Tu fais mieux ?`, reaction === null ? 'false-start' : reaction.toFixed(0))} />}
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
        window.setTimeout(() => setReplayReady(true), 1200);
        return 0;
      }
      return t - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => { setCount(0); setTime(30); setReplayReady(false); setPhase('running'); };

  return (
    <div className="gameStage tapStage">
      <h2>TAP 30</h2>
      <GameIntro>Tu as <strong>30 secondes</strong> pour faire le plus de KLIK possible.</GameIntro>
      {phase === 'idle' && <>
        <div className="countdownDisc"><strong>30</strong><span>SECONDES</span></div>
        <button className="primary" onClick={start}>START</button>
      </>}
      {phase === 'running' && <>
        <div className="tapHud"><strong>{time}</strong><span>sec</span><b>{count} KLIK</b></div>
        <button className="tapZone" onPointerDown={() => setCount((c) => c + 1)}>KLIK!</button>
      </>}
      {phase === 'done' && <div className="tapResultScreen">
        <div className="tapScoreLabel">TON SCORE</div>
        <div className="tapScore">{count}</div>
        <div className="tapScoreUnit">KLIK en 30 secondes</div>
        <EndActions replay={start} replayDisabled={!replayReady} challenge={() => shareChallenge('tap', `J’ai fait ${count} KLIK en 30 secondes. Tu peux me battre ?`, String(count))} />
      </div>}
    </div>
  );
}

const MEMORY_COLORS = ['#1d16f5', '#fff500', '#ff1694', '#ffffff'];

function Memory() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [phase, setPhase] = useState<'idle' | 'memorize' | 'answer' | 'reveal' | 'done'>('idle');
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState(0);
  const [firstError, setFirstError] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(5);
  const revealTimers = useRef<number[]>([]);
  const memorizeTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  const clearMemoryTimers = () => {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
    if (memorizeTimer.current) clearTimeout(memorizeTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  };

  useEffect(() => clearMemoryTimers, []);

  const start = () => {
    clearMemoryTimers();
    const seq = Array.from({ length: 10 }, () => Math.floor(Math.random() * MEMORY_COLORS.length));
    setSequence(seq);
    setAnswers(Array(10).fill(null));
    setActiveSlot(null);
    setRevealed(0);
    setScore(0);
    setFirstError(null);
    setSeconds(5);
    setPhase('memorize');

    countdownTimer.current = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    memorizeTimer.current = window.setTimeout(() => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setSeconds(0);
      setPhase('answer');
    }, 5000);
  };

  const chooseColor = (color: number) => {
    if (phase !== 'answer' || activeSlot === null) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[activeSlot] = color;
      return next;
    });
    setActiveSlot((slot) => slot === null ? null : slot < 9 ? slot + 1 : null);
  };

  const validate = () => {
    if (phase !== 'answer' || answers.some((a) => a === null)) return;
    setPhase('reveal');
    setActiveSlot(null);
    setRevealed(0);
    setScore(0);
    setFirstError(null);

    let points = 0;
    let error: number | null = null;
    sequence.forEach((color, index) => {
      revealTimers.current.push(window.setTimeout(() => {
        const ok = answers[index] === color;
        if (ok) points += 1;
        else if (error === null) { error = index; setFirstError(index); }
        setScore(points);
        setRevealed(index + 1);
        if (index === 9) setPhase('done');
      }, (index + 1) * 1250));
    });
  };

  const canValidate = answers.every((a) => a !== null);
  const currentIndex = Math.max(0, revealed - 1);
  const currentCorrect = revealed > 0 ? answers[currentIndex] === sequence[currentIndex] : null;

  return (
    <div className="gameStage memoryStage">
      <h2>MÉMOIRE</h2>
      <GameIntro>Mémorise les 10 couleurs pendant <strong>5 secondes</strong>, puis reproduis-les. La vérification se fait <strong>de gauche à droite →</strong>. Une seule erreur = partie perdue, mais toutes les bonnes réponses comptent pour départager les égalités.</GameIntro>

      {phase === 'idle' && <button className="primary" onClick={start}>START</button>}

      {phase !== 'idle' && <>
        <div className="memoryStatus">
          {phase === 'memorize' && `MÉMORISE… ${seconds}s`}
          {phase === 'answer' && 'CLIQUE UNE BILLE GRISE, PUIS CHOISIS SA COULEUR'}
          {phase === 'reveal' && `DÉCOUVERTE → ${revealed}/10`}
          {phase === 'done' && (firstError === null ? 'PARFAIT ! 10/10' : `PARTIE PERDUE · ${score}/10 BONNES`)}
        </div>

        <div className="memoryBoard">
          <div className="memoryDirection"><span>DÉPART</span><b>→</b><span>FIN</span></div>
          <div className="memoryRow targetRow">
            {sequence.map((color, index) => {
              const visible = phase === 'memorize' || ((phase === 'reveal' || phase === 'done') && index < revealed);
              return (
                <div key={index} className="memoryTargetWrap">
                  <div className="memoryDot target" style={{ background: MEMORY_COLORS[color] }} />
                  {!visible && <div className="memoryCap"><span>{index + 1}</span></div>}
                </div>
              );
            })}
          </div>

          <div className="memoryRow answerRow">
            {answers.map((color, index) => {
              const checked = (phase === 'reveal' || phase === 'done') && index < revealed;
              const ok = checked && color === sequence[index];
              const wrong = checked && color !== sequence[index];
              return (
                <button
                  key={index}
                  className={`memoryDot answer ${color === null ? 'empty' : ''} ${activeSlot === index ? 'active' : ''} ${ok ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                  style={color === null ? undefined : { background: MEMORY_COLORS[color] }}
                  onClick={() => phase === 'answer' && setActiveSlot(index)}
                  disabled={phase !== 'answer'}
                  aria-label={`Bille ${index + 1}`}
                >{checked && <span className="answerMark">{ok ? '✓' : '✕'}</span>}</button>
              );
            })}
          </div>
        </div>

        {phase === 'answer' && activeSlot !== null && <div className="memoryPicker">
          <div className="pickerLabel">Bille {activeSlot + 1} : choisis la couleur</div>
          <div className="memoryPalette">
            {MEMORY_COLORS.map((color, index) => <button key={color} className="paletteColor" style={{background: color}} onClick={() => chooseColor(index)} aria-label={`Couleur ${index + 1}`} />)}
          </div>
        </div>}

        {phase === 'answer' && <button className="primary" disabled={!canValidate} onClick={validate}>VALIDER</button>}

        {phase === 'reveal' && revealed > 0 && <div className={`memoryVerdict ${currentCorrect ? 'good' : 'bad'}`}>
          <strong>{currentCorrect ? '✓ BONNE RÉPONSE' : '✕ MAUVAISE RÉPONSE'}</strong>
          <span>Bille {revealed} · score provisoire {score}/10</span>
        </div>}

        {phase === 'done' && <>
          <div className={`memoryFinal ${firstError === null ? 'win' : 'lose'}`}>
            <strong>{firstError === null ? 'VICTOIRE' : `PERDU À LA BILLE ${firstError + 1}`}</strong>
            <span>{score}/10 bonnes réponses au total</span>
          </div>
          <EndActions replay={start} challenge={() => shareChallenge('memory', firstError === null ? 'J’ai fait un sans-faute 10/10 à Mémoire sur KLIIK. Tu peux faire pareil ?' : `J’ai trouvé ${score}/10 couleurs à Mémoire sur KLIIK. Tu peux me battre ?`, String(score))} />
        </>}
      </>}
    </div>
  );
}

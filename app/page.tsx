'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
  { id: 'tap', title: 'TAP 30', subtitle: 'Le plus de clics possible en 30 secondes.', icon: '👆', tone: 'pink' },
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
    if (navigator.share) {
      await navigator.share(payload);
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      window.alert('Défi copié ! Envoie-le à ton ami.');
    }
  } catch {
    // Partage annulé : aucune action nécessaire.
  }
}

export default function Home() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<GameId, boolean>>({ ten: true, f1: true, tap: true, memory: true });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game') as GameId | null;
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

function Admin({ enabled, setEnabled }: { enabled: Record<GameId, boolean>; setEnabled: Dispatch<SetStateAction<Record<GameId, boolean>>> }) {
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

function GameIntro({ children }: { children: React.ReactNode }) {
  return <p className="gameIntro">{children}</p>;
}

function ChallengeButton({ onClick }: { onClick: () => void }) {
  return <button className="challengeBtn" onClick={onClick}><span>↗</span> DÉFIER UN AMI</button>;
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
      <h2>10.000</h2>
      <GameIntro>Lance le chrono et arrête-le au plus près de <strong>10.000 secondes</strong>.</GameIntro>
      <div className="timerMachine"><div className="bigTime">{(elapsed / 1000).toFixed(3)}</div></div>
      {!running ? <button className="primary" onClick={start}>{result === null ? 'START' : 'REJOUER'}</button> : <button className="primary stopBtn" onClick={stop}>STOP</button>}
      {diff !== null && <div className="result resultCard">Écart : {(diff / 1000).toFixed(3)} s {diff <= 20 ? '🔥' : diff <= 100 ? '👏' : ''}</div>}
      <ChallengeButton onClick={() => shareChallenge('ten', result === null ? 'Je te défie sur le 10.000 de KLIIK. Tu peux faire mieux ?' : `J’ai fait ${(result / 1000).toFixed(3)} s sur KLIIK. Tu peux me battre ?`, result === null ? undefined : (result / 1000).toFixed(3))} />
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
    <div className="gameStage f1Stage" onPointerDown={phase === 'lights' || phase === 'go' ? hit : undefined}>
      <h2>F1 START</h2>
      <GameIntro>Les 5 feux s’allument. Appuie <strong>dès qu’ils s’éteignent</strong>. Trop tôt = faux départ.</GameIntro>
      <div className="startingGantrY">
        <div className="lights">{[1,2,3,4,5].map((n) => <div key={n} className={`light ${count >= n ? 'on' : ''}`} />)}</div>
      </div>
      <div className="trackLine"><span>🏎️</span></div>
      {phase === 'idle' && <button className="primary" onPointerDown={(e) => e.stopPropagation()} onClick={start}>LANCER</button>}
      {phase === 'lights' && <div className="result f1Message">ATTENDS…</div>}
      {phase === 'go' && <div className="result goMessage">MAINTENANT !</div>}
      {phase === 'done' && <><div className="reactionScore">{reaction?.toFixed(0)} <small>ms</small></div><button className="primary" onPointerDown={(e) => e.stopPropagation()} onClick={start}>REJOUER</button></>}
      {phase === 'false' && <><div className="falseStart">FAUX<br />DÉPART</div><button className="primary" onPointerDown={(e) => e.stopPropagation()} onClick={start}>REJOUER</button></>}
      <ChallengeButton onClick={() => shareChallenge('f1', reaction === null ? 'Je te défie au F1 Start de KLIIK. Qui a le meilleur réflexe ?' : `Mon temps de réaction : ${reaction.toFixed(0)} ms sur KLIIK. Tu fais mieux ?`, reaction === null ? undefined : reaction.toFixed(0))} />
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
        <ChallengeButton onClick={() => shareChallenge('tap', `J’ai fait ${count} KLIK en 30 secondes. Tu peux me battre ?`, String(count))} />
        <button className="primary replaySeparated" disabled={!replayReady} onClick={start}>{replayReady ? 'REJOUER' : 'RÉSULTAT…'}</button>
      </div>}
      {phase !== 'done' && <ChallengeButton onClick={() => shareChallenge('tap', 'Je te défie au TAP 30 de KLIIK. Combien de KLIK peux-tu faire ?')} />}
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
    setSeconds(5);
    setPhase('memorize');
    countdownTimer.current = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    memorizeTimer.current = window.setTimeout(() => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setPhase('answer');
      setActiveSlot(0);
    }, 5000);
  };

  const chooseColor = (color: number) => {
    if (phase !== 'answer' || activeSlot === null) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[activeSlot] = color;
      return next;
    });
    const nextEmpty = answers.findIndex((answer, index) => index > activeSlot && answer === null);
    setActiveSlot(nextEmpty >= 0 ? nextEmpty : null);
  };

  const validate = () => {
    if (phase !== 'answer' || answers.some((a) => a === null)) return;
    setActiveSlot(null);
    setPhase('reveal');
    setRevealed(0);
    let points = 0;
    sequence.forEach((color, index) => {
      revealTimers.current.push(window.setTimeout(() => {
        if (answers[index] === color) points += 1;
        setScore(points);
        setRevealed(index + 1);
        if (index === 9) setPhase('done');
      }, 600 + index * 650));
    });
  };

  const canValidate = answers.every((a) => a !== null);

  return (
    <div className="gameStage memoryStage">
      <h2>MÉMOIRE</h2>
      <GameIntro>Mémorise les <strong>10 couleurs pendant 5 secondes</strong>, puis reconstruis la ligne.</GameIntro>

      {phase === 'idle' && <>
        <div className="memoryPreview">
          {MEMORY_COLORS.map((color) => <i key={color} style={{background:color}} />)}
        </div>
        <button className="primary" onClick={start}>START</button>
        <ChallengeButton onClick={() => shareChallenge('memory', 'Je te défie au jeu Mémoire de KLIIK. Combien de couleurs vas-tu retrouver ?')} />
      </>}

      {phase !== 'idle' && <>
        <div className="memoryStatus">
          {phase === 'memorize' && <>MÉMORISE · <strong>{seconds}s</strong></>}
          {phase === 'answer' && <>RECONSTRUIS LA LIGNE</>}
          {phase === 'reveal' && <>DÉCOUVERTE · {revealed}/10</>}
          {phase === 'done' && <>TERMINÉ · <strong>{score}/10</strong></>}
        </div>

        <div className="memoryBoard">
          <div className="memoryLabel">MODÈLE</div>
          <div className="memoryRow targetRow">
            {sequence.map((color, index) => {
              const visible = phase === 'memorize' || ((phase === 'reveal' || phase === 'done') && index < revealed);
              return (
                <div key={index} className="memoryTargetWrap">
                  <div className="memoryDot target" style={{ background: MEMORY_COLORS[color] }} />
                  <div className={`memoryCap ${visible ? 'open' : ''} ${(phase === 'reveal' || phase === 'done') && index < revealed ? 'slideAway' : ''}`}>
                    <span />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="memoryDivider" />
          <div className="memoryLabel">TA RÉPONSE</div>
          <div className="memoryRow answerRow">
            {answers.map((color, index) => {
              const checked = phase === 'reveal' || phase === 'done';
              const isRevealed = checked && index < revealed;
              const isCorrect = isRevealed ? color === sequence[index] : false;
              const isWrong = isRevealed ? color !== sequence[index] : false;
              return (
                <button
                  key={index}
                  className={`memoryDot answer ${color === null ? 'empty' : ''} ${activeSlot === index ? 'activeSlot' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                  style={color === null ? undefined : { background: MEMORY_COLORS[color] }}
                  onClick={() => phase === 'answer' && setActiveSlot(index)}
                  disabled={phase !== 'answer'}
                  aria-label={`Pastille ${index + 1}`}
                />
              );
            })}
          </div>

          {phase === 'answer' && activeSlot !== null && <div className="slotPicker">
            <span>Pastille {activeSlot + 1}</span>
            <div className="slotColors">
              {MEMORY_COLORS.map((color, index) => (
                <button key={color} className="paletteColor" style={{ background: color }} onClick={() => chooseColor(index)} aria-label={`Choisir couleur ${index + 1}`} />
              ))}
            </div>
          </div>}
        </div>

        {phase === 'answer' && <button className="primary validateMemory" disabled={!canValidate} onClick={validate}>VALIDER</button>}

        {(phase === 'reveal' || phase === 'done') && <div className="memoryScoreCard"><span>TON SCORE</span><strong>{score}<small>/10</small></strong></div>}
        {phase === 'done' && <button className="primary" onClick={start}>REJOUER</button>}
        <ChallengeButton onClick={() => shareChallenge('memory', phase === 'done' ? `J’ai retrouvé ${score}/10 couleurs sur KLIIK. Tu fais mieux ?` : 'Je te défie au jeu Mémoire de KLIIK. Combien de couleurs vas-tu retrouver ?', phase === 'done' ? String(score) : undefined)} />
      </>}
    </div>
  );
}

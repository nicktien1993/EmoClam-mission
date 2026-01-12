
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Rocket, Home, School, Settings, History, RefreshCw, CheckCircle2, AlertCircle, Play, 
  ArrowRight, ShieldAlert, Wind, MessageSquare, Trophy, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music, Trash2, ShieldCheck, Loader2, Gauge, Cpu, Wifi, ZapOff, 
  LogOut, Sliders, ToggleLeft, ToggleRight, Check, X, Scan, Hexagon, Hash, ShieldQuestion, 
  ChevronRight, Terminal, Info, LayoutPanelLeft, Sparkles, AlertCircle as Warning, Lock, MapPin
} from 'lucide-react';
import { GameState, Card, LogEntry, MissionConfig, EmotionZone } from './types';
import { SCHOOL_CARDS, HOME_CARDS, PLAYGROUND_CARDS, BOSS_CARDS, EMOTIONS, NEEDS } from './constants';

const ICON_MAP: Record<string, any> = {
  Rocket, Home, School, Settings, History, RefreshCw, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music, ZapOff, CheckCircle2, Trophy, Trash2, MapPin
};

// --- 進階音訊合成引擎 ---
let sharedAudioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx?.state === 'suspended') sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch (e) { return null; }
};

const playSfx = (type: string, customDuration?: number) => {
  const ctx = getAudioCtx();
  if (!ctx || ctx.state === 'closed') return;

  // 顯著提升全局音量比例
  const playComplex = (freqs: number[], type: OscillatorType, duration: number, vol: number = 0.2) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    });
    gain.connect(ctx.destination);
  };

  const playNoise = (duration: number, volume: number = 0.1) => {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(g); g.connect(ctx.destination);
    source.start();
  };

  switch (type) {
    case 'click': playComplex([880, 1760], 'sine', 0.1, 0.15); break;
    case 'draw': playComplex([200, 300, 400], 'sawtooth', 0.6, 0.1); break;
    case 'scan': 
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(40, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + (customDuration || 2.2));
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + (customDuration || 2.2));
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + (customDuration || 2.2));
      break;
    case 'correct': playComplex([600, 800, 1200], 'sine', 0.6, 0.2); break;
    case 'wrong': playComplex([150, 100], 'square', 0.5, 0.15); break;
    case 'hiss': playNoise(1.5, 0.2); break;
    case 'pressure': 
      const pOsc = ctx.createOscillator();
      const pG = ctx.createGain();
      pOsc.type = 'triangle';
      pOsc.frequency.setValueAtTime(40, ctx.currentTime);
      pOsc.frequency.linearRampToValueAtTime(330, ctx.currentTime + (customDuration || 5));
      pG.gain.setValueAtTime(0.15, ctx.currentTime);
      pOsc.connect(pG); pG.connect(ctx.destination);
      pOsc.start(); pOsc.stop(ctx.currentTime + (customDuration || 5));
      break;
    case 'inhale': playComplex([300, 310], 'sine', customDuration || 3, 0.1); break;
    case 'exhale': playComplex([200, 210], 'sine', customDuration || 3, 0.1); break;
  }
};

const DEFAULT_MISSION_CONFIG: MissionConfig = {
  cardCount: 4, 
  enablePressure: true,
  enableBreath: true,
  enableReport: true,
  pressureDuration: 5,
  breathCycles: 3,
  inhaleTime: 4,
  holdTime: 4,
  exhaleTime: 8
};

const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => ({
    score: 0,
    xp: Number(localStorage.getItem('emotionPilotXP')) || 0,
    round: 0,
    totalRounds: 0,
    streak: 0,
    history: [],
    currentRoute: null,
    deck: [],
    currentCard: null,
    status: 'splash',
    sopStep: 1,
    missionConfig: DEFAULT_MISSION_CONFIG
  }));
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [sopSelection, setSopSelection] = useState({ emotion: '', need: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const timers = useRef<number[]>([]);
  const pressureIntervalRef = useRef<number | null>(null);
  
  const [pressure, setPressure] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [isDecompressing, setIsDecompressing] = useState(false);

  const [breathPhase, setBreathPhase] = useState<'ready' | 'inhale' | 'hold' | 'exhale' | 'done'>('ready');
  const [breathCount, setBreathCount] = useState(0);

  const clearAllTimers = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current.forEach(t => clearInterval(t));
    timers.current = [];
    if (pressureIntervalRef.current) {
      clearInterval(pressureIntervalRef.current);
      pressureIntervalRef.current = null;
    }
  }, []);

  useEffect(() => { return () => clearAllTimers(); }, [clearAllTimers]);

  useEffect(() => {
    localStorage.setItem('emotionPilotXP', (state.xp || 0).toString());
  }, [state.xp]);

  const addLog = useCallback((type: LogEntry['type'], content: string) => {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), type, content };
    setState(prev => ({ ...prev, history: [entry, ...prev.history].slice(0, 50) }));
  }, []);

  const updateConfig = useCallback((key: keyof MissionConfig, value: any) => {
    setState(prev => ({ ...prev, missionConfig: { ...prev.missionConfig, [key]: value } }));
  }, []);

  const resetGame = useCallback(() => {
    playSfx('click');
    if (window.confirm("⚠️ 系統重置確認：確定要抹除核心數據並歸零 XP 嗎？")) {
      clearAllTimers();
      localStorage.removeItem('emotionPilotXP');
      setState({
        score: 0, xp: 0, round: 0, totalRounds: 0, streak: 0, history: [],
        currentRoute: null, deck: [], currentCard: null, status: 'splash', sopStep: 1,
        missionConfig: { ...DEFAULT_MISSION_CONFIG }
      });
      setShowSettings(false);
      playSfx('wrong');
    }
  }, [clearAllTimers]);

  const startNewMission = useCallback(() => {
    playSfx('click');
    clearAllTimers();
    setState(prev => ({ ...prev, score: 0, round: 0, streak: 0, history: [], currentRoute: null, deck: [], currentCard: null, status: 'routing', sopStep: 1 }));
  }, [clearAllTimers]);

  const applyConfigAndStart = useCallback(() => {
    playSfx('click');
    setState(prev => {
      let pool: Card[] = [];
      if (prev.currentRoute === 'school') pool = SCHOOL_CARDS;
      else if (prev.currentRoute === 'home') pool = HOME_CARDS;
      else if (prev.currentRoute === 'playground') pool = PLAYGROUND_CARDS;

      const happyPool = pool.filter(c => c.type === '開心').sort(() => Math.random() - 0.5);
      const unhappyPool = pool.filter(c => c.type === '不開心').sort(() => Math.random() - 0.5);
      
      const totalCount = Math.min(12, Math.max(1, prev.missionConfig.cardCount));
      const happyCount = Math.max(1, Math.floor(totalCount / 4));
      const unhappyCount = totalCount - happyCount;

      const finalDeck: Card[] = [];
      finalDeck.push(...happyPool.slice(0, happyCount));
      const boss = BOSS_CARDS[Math.floor(Math.random() * BOSS_CARDS.length)];
      finalDeck.push(boss);
      finalDeck.push(...unhappyPool.slice(0, unhappyCount - 1));

      return { 
        ...prev, 
        deck: finalDeck.sort(() => Math.random() - 0.5), 
        totalRounds: finalDeck.length, 
        status: 'picking' 
      };
    });
  }, []);

  const pickCard = useCallback((cardIndex: number) => {
    if (isDrawing || state.status !== 'picking') return;
    
    const targetCard = state.deck[cardIndex];
    if (!targetCard) return;

    playSfx('draw');
    setIsDrawing(true);
    setSelectedCardIdx(cardIndex);
    setIsFlipped(false);
    setIsScanning(false);

    const moveTimer = window.setTimeout(() => {
      setIsScanning(true);
      playSfx('scan', 2.2);

      const scanTimer = window.setTimeout(() => {
        setIsScanning(false);
        setIsFlipped(true);
        playSfx('correct');

        const transitionTimer = window.setTimeout(() => {
          setState(prev => {
            const finalCard = prev.deck[cardIndex];
            if (!finalCard) return { ...prev, status: 'routing' };
            const newDeck = prev.deck.filter((_, i) => i !== cardIndex);
            return { 
              ...prev, 
              currentCard: finalCard, 
              deck: newDeck, 
              round: prev.round + 1, 
              status: 'playing' 
            };
          });
          setIsDrawing(false);
          setSelectedCardIdx(null);
        }, 800);
        timers.current.push(transitionTimer);
      }, 2200);
      timers.current.push(scanTimer);
    }, 1200);
    timers.current.push(moveTimer);
  }, [isDrawing, state.deck, state.status]);

  const nextTurn = useCallback(() => {
    clearAllTimers();
    setState(prev => {
      if (prev.deck.length === 0) return { ...prev, status: 'result' };
      return { ...prev, status: 'picking' };
    });
    setIsFlipped(false);
    setIsScanning(false);
    setIsDrawing(false);
    setSelectedCardIdx(null);
  }, [clearAllTimers]);

  const triggerSOP = useCallback(() => {
    let startStep = 1;
    if (!state.missionConfig.enablePressure) {
      startStep = 2;
      if (!state.missionConfig.enableBreath) {
        startStep = 3;
        if (!state.missionConfig.enableReport) { nextTurn(); return; }
      }
    }
    setState(prev => ({ ...prev, status: 'sop', sopStep: startStep }));
    setPressure(0); setBreathCount(0); setBreathPhase('ready');
  }, [state.missionConfig, nextTurn]);

  const handleDecision = useCallback((choice: EmotionZone) => {
    if (!state.currentCard) return;
    const isCorrect = state.currentCard.type === choice;
    if (isCorrect) {
      playSfx('correct');
      setState(prev => ({ ...prev, score: prev.score + (prev.currentCard?.isBoss ? 50 : 20), xp: (prev.xp || 0) + 5 }));
      addLog('decision', `核心判斷：對準 ${choice}`);
      if (choice === '不開心') triggerSOP();
      else nextTurn();
    } else {
      playSfx('wrong');
      setState(prev => ({ ...prev, score: Math.max(0, prev.score - 10) }));
      addLog('decision', `核心失準：偵測到 ${choice}`);
      if (state.currentCard.type === '不開心') triggerSOP();
      else nextTurn();
    }
  }, [state.currentCard, addLog, triggerSOP, nextTurn]);

  const handleSopSelection = useCallback((type: 'emotion' | 'need', id: string) => {
    if (!state.currentCard) return;
    const suggest = state.currentCard.suggest;
    let isCorrect = true;
    if (suggest) {
      if (type === 'emotion' && suggest.emo) isCorrect = (suggest.emo === id);
      else if (type === 'need' && suggest.need) isCorrect = (suggest.need === id);
    }
    if (isCorrect) playSfx('correct'); else playSfx('wrong');
    setSopSelection(prev => ({ ...prev, [type]: id }));
  }, [state.currentCard]);

  const startPressure = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (pressure >= 100 || isDecompressing) return;
    setIsPressing(true);
    if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
    const increment = 100 / (state.missionConfig.pressureDuration * 25);
    playSfx('pressure', state.missionConfig.pressureDuration);
    pressureIntervalRef.current = window.setInterval(() => {
      setPressure(p => {
        if (p >= 100) {
          if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
          pressureIntervalRef.current = null;
          playSfx('correct');
          return 100;
        }
        return p + increment;
      });
    }, 40);
  };

  const stopPressure = () => {
    setIsPressing(false);
    if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
    if (pressure > 0 && pressure < 100) {
      pressureIntervalRef.current = window.setInterval(() => {
        setPressure(p => {
          if (p <= 0) {
            if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
            pressureIntervalRef.current = null;
            return 0;
          }
          return p - 3;
        });
      }, 40);
    }
  };

  const handlePressureDone = () => {
    if (pressure >= 100) {
      playSfx('click');
      setIsDecompressing(true); 
      playSfx('hiss');
      const decompressionTimer = window.setTimeout(() => {
        setIsDecompressing(false);
        let nextStep = 2;
        if (!state.missionConfig.enableBreath) {
          nextStep = 3;
          if (!state.missionConfig.enableReport) { nextTurn(); return; }
        }
        setState(prev => ({ ...prev, sopStep: nextStep }));
        setPressure(0); setBreathCount(0); setBreathPhase('ready');
      }, 2000);
      timers.current.push(decompressionTimer);
    }
  };

  useEffect(() => {
    if (state.status === 'sop' && state.sopStep === 2 && breathCount < state.missionConfig.breathCycles) {
      const config = state.missionConfig;
      if (breathPhase === 'ready') {
         const t = window.setTimeout(() => { setBreathPhase('inhale'); playSfx('inhale', config.inhaleTime); }, 800);
         timers.current.push(t);
         return;
      }
      const durations = { ready: 800, inhale: config.inhaleTime * 1000, hold: config.holdTime * 1000, exhale: config.exhaleTime * 1000, done: 0 };
      const bt = window.setTimeout(() => {
        setBreathPhase(current => {
          if (current === 'inhale') return 'hold';
          if (current === 'hold') { playSfx('exhale', config.exhaleTime); return 'exhale'; }
          if (current === 'exhale') {
            const nextCount = breathCount + 1;
            setBreathCount(nextCount);
            if (nextCount < config.breathCycles) { playSfx('inhale', config.inhaleTime); return 'inhale'; }
            return 'done';
          }
          return current;
        });
      }, durations[breathPhase as keyof typeof durations] || 1000);
      timers.current.push(bt);
      return () => { clearTimeout(bt); };
    }
  }, [state.status, state.sopStep, breathPhase, breathCount, state.missionConfig]);

  const handleSopCompletion = () => {
    playSfx('correct');
    addLog('sop', `穩定協議已執行完畢：核心同步中`);
    setState(prev => ({ ...prev, xp: (prev.xp || 0) + 10 }));
    setSopSelection({ emotion: '', need: '' });
    nextTurn();
  };

  const getBreathSize = () => {
    if (breathPhase === 'inhale') return 'w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] bg-cyan-300 shadow-[0_0_100px_rgba(34,211,238,0.9)]';
    if (breathPhase === 'hold') return 'w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] bg-white shadow-[0_0_120px_rgba(255,255,255,1)] scale-110';
    if (breathPhase === 'exhale') return 'w-[40px] h-[40px] bg-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]';
    return 'w-[40px] h-[40px] bg-cyan-400/10';
  };

  const getBreathDuration = () => {
    const config = state.missionConfig;
    if (breathPhase === 'inhale') return `${config.inhaleTime}s`;
    if (breathPhase === 'hold') return `${config.holdTime}s`;
    if (breathPhase === 'exhale') return `${config.exhaleTime}s`;
    return '0.8s';
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-2 bg-zinc-950 scanlines overflow-hidden font-sans select-none transition-all ${isPressing ? 'shake-screen' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      <div className="w-full max-w-5xl h-full bg-zinc-900 md:border-[8px] border-zinc-800 md:rounded-[48px] shadow-2xl relative flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center bg-zinc-900/95 border-b-2 border-zinc-800 p-3 relative z-50 h-14 sm:h-16 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/10 border border-cyan-400 flex items-center justify-center glow-cyan">
              <LayoutPanelLeft className="text-cyan-400 w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-header text-xs sm:text-sm tracking-widest text-white uppercase leading-none">CORE NAVIGATOR</h1>
              <p className="text-[8px] text-zinc-500 font-mono-tech tracking-tighter uppercase mt-0.5">V9.2.1 STABLE</p>
            </div>
          </div>
          <div className="flex gap-4 font-mono-tech">
            <div className="text-center px-3 border-r border-zinc-800">
              <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">Score</span>
              <span className="text-sm sm:text-lg text-emerald-400 font-black tracking-widest leading-none">{state.score.toString().padStart(4, '0')}</span>
            </div>
            <div className="text-center px-3">
              <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">XP</span>
              <span className="text-sm sm:text-lg text-amber-400 font-black tracking-widest leading-none">{state.xp || 0}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { playSfx('click'); setShowHistory(true); }} className="p-1.5 sm:p-2 bg-zinc-800 rounded-lg active:translate-y-0.5"><History size={18} className="text-zinc-400" /></button>
            <button onClick={() => { playSfx('click'); setShowSettings(true); }} className="p-1.5 sm:p-2 bg-zinc-800 rounded-lg active:translate-y-0.5"><Settings size={18} className="text-zinc-400" /></button>
          </div>
        </div>

        <main className="flex-1 p-2 sm:p-4 relative flex flex-col min-h-0 overflow-visible">
          {state.status === 'splash' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 overflow-hidden">
              <div className="relative mb-8">
                 <div className="absolute -inset-10 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
                 <div className="relative w-28 h-28 sm:w-32 sm:h-32 bg-zinc-800 rounded-3xl border-4 border-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    <Rocket className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-400" />
                 </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-header text-white mb-4 tracking-tighter">核心領航員</h2>
              <div className="text-cyan-500 text-[10px] sm:text-sm font-mono-tech tracking-[0.5em] mb-10 uppercase">Holographic System</div>
              <button onClick={startNewMission} className="w-full max-w-xs py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-2xl border-b-8 border-cyan-950 shadow-xl active:scale-95 transition-transform">同步啟動</button>
            </div>
          )}

          {state.status === 'routing' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in h-full overflow-y-auto py-4">
              <h2 className="text-xl sm:text-2xl font-header text-cyan-400 uppercase tracking-widest mb-4 text-center">目標磁區 / Target Sector</h2>
              <div className="mb-6 flex flex-col items-center shrink-0">
                 <div className="w-full max-w-[200px] sm:max-w-xs bg-zinc-800/50 h-1.5 sm:h-2 rounded-full overflow-hidden border border-zinc-700">
                    <div className="h-full bg-amber-500 shadow-[0_0_10px_amber]" style={{ width: `${Math.min(100, ((state.xp || 0) / 300) * 100)}%` }} />
                 </div>
                 <span className="text-[10px] font-mono-tech text-zinc-500 mt-2 uppercase">XP Progress: {state.xp || 0}/300</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl px-4">
                <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, currentRoute: 'school', status: 'ready' })); }} className="p-5 sm:p-6 bg-zinc-800/40 border-2 border-emerald-500/30 hover:border-emerald-400 rounded-3xl transition-all text-center border-b-6 border-emerald-950">
                  <School className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-emerald-400" />
                  <h3 className="text-md sm:text-lg font-black text-white uppercase">學校區</h3>
                </button>
                <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, currentRoute: 'home', status: 'ready' })); }} className="p-5 sm:p-6 bg-zinc-800/40 border-2 border-amber-500/30 hover:border-amber-400 rounded-3xl transition-all text-center border-b-6 border-amber-950">
                  <Home className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-amber-400" />
                  <h3 className="text-md sm:text-lg font-black text-white uppercase">家裡區</h3>
                </button>
                <button 
                  disabled={(state.xp || 0) < 300}
                  onClick={() => { playSfx('click'); setState(prev => ({ ...prev, currentRoute: 'playground', status: 'ready' })); }} 
                  className={`p-5 sm:p-6 bg-zinc-800/40 border-2 rounded-3xl transition-all text-center border-b-6 relative overflow-hidden ${(state.xp || 0) >= 300 ? 'border-cyan-500/30 hover:border-cyan-400 border-b-cyan-950' : 'border-zinc-800 border-b-black opacity-40'}`}
                >
                  {(state.xp || 0) < 300 && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[1px] z-10">
                      <Lock className="text-zinc-500 mb-1" size={20} />
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">300 XP REQUIRED</span>
                    </div>
                  )}
                  <MapPin className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 ${(state.xp || 0) >= 300 ? 'text-cyan-400' : 'text-zinc-700'}`} />
                  <h3 className="text-md sm:text-lg font-black text-white uppercase">操場區</h3>
                </button>
              </div>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in py-6 overflow-hidden">
              <div className="w-full max-w-xl bg-zinc-800/40 border-2 sm:border-4 border-zinc-700 rounded-[40px] sm:rounded-[48px] p-6 sm:p-8 text-center shadow-2xl relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zinc-900 px-4 sm:px-6 py-1 border-2 border-zinc-700 rounded-full text-[10px] text-zinc-500 font-mono-tech font-black uppercase">Briefing</div>
                <h2 className="text-2xl sm:text-3xl font-header text-white mb-2 uppercase tracking-widest mt-4">任務準備 / Ready</h2>
                <div className="grid grid-cols-2 gap-4 my-8">
                   <div className="p-5 sm:p-6 bg-black/40 rounded-3xl border border-zinc-800"><span className="block text-[10px] text-zinc-500 font-black mb-1">單位</span><span className="text-2xl sm:text-3xl font-black text-cyan-400">{state.missionConfig.cardCount}</span></div>
                   <div className="p-5 sm:p-6 bg-black/40 rounded-3xl border border-zinc-800"><span className="block text-[10px] text-zinc-500 font-black mb-1">層級</span><span className="text-2xl sm:text-3xl font-black text-amber-400">LV.3</span></div>
                </div>
                <button onClick={applyConfigAndStart} className="w-full py-5 sm:py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-xl sm:text-2xl border-b-8 border-emerald-950 active:translate-y-1">核心啟動</button>
              </div>
            </div>
          )}

          {(state.status === 'picking' || state.status === 'playing') && (
            <div className="flex-1 flex flex-col items-center animate-in fade-in relative pb-4 overflow-visible">
              {state.status === 'picking' && (
                <div className={`absolute top-0 w-full text-center transition-opacity duration-500 ${selectedCardIdx !== null ? 'opacity-0 pointer-events-none' : 'opacity-100'} pt-8`}>
                  <h2 className="text-xl sm:text-2xl font-header text-white mb-1 uppercase tracking-[0.3em] animate-pulse">單元提取 / Pull</h2>
                  <div className="text-[10px] font-mono-tech text-cyan-500 uppercase tracking-widest">Select an encrypted data packet</div>
                </div>
              )}

              <div className="relative w-full max-w-4xl flex-1 flex flex-col items-center justify-center perspective-1000 min-h-0 overflow-visible">
                {(state.status === 'picking' || isDrawing) && state.deck.map((card, idx) => {
                  const isSelected = selectedCardIdx === idx;
                  const isAnySelected = selectedCardIdx !== null;
                  const fanAngle = (idx - (state.deck.length - 1) / 2) * 8;
                  const fanX = (idx - (state.deck.length - 1) / 2) * (window.innerWidth < 640 ? 30 : 45);
                  let cardTransform = `translateX(${fanX}px) rotate(${fanAngle}deg)`;
                  let cardZIndex = idx;
                  let cardOpacity = 1;
                  
                  if (isSelected) {
                    const centerScale = window.innerWidth < 640 ? 1.5 : 2.2;
                    const translateY = window.innerWidth < 640 ? '-140px' : '-220px';
                    cardTransform = `translate(0, ${translateY}) scale(${centerScale}) rotate(${isFlipped ? '180deg' : '0deg'})`;
                    cardZIndex = 1000;
                  } else if (isAnySelected) {
                    cardOpacity = 0;
                    cardTransform = `translateX(${fanX}px) translateY(200px) rotate(${fanAngle}deg)`;
                  }

                  return (
                    <div 
                      key={card.id || idx} onClick={() => pickCard(idx)} 
                      style={{ transform: cardTransform, zIndex: cardZIndex, opacity: cardOpacity, transformStyle: 'preserve-3d' }}
                      className={`absolute bottom-0 w-28 h-40 sm:w-32 sm:h-48 transition-all duration-[1200ms] ease-in-out shadow-[0_10px_40px_rgba(0,0,0,0.6)] cursor-pointer rounded-2xl overflow-hidden ${isSelected ? 'ring-2 ring-cyan-400' : 'bg-zinc-900 border-2 border-cyan-500/20'}`}
                    >
                      <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center backface-hidden border-2 border-zinc-800 rounded-2xl">
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                         <Scan className={`w-10 h-10 sm:w-12 sm:h-12 ${isSelected && isScanning ? 'text-cyan-400 animate-pulse' : 'text-zinc-800'}`} />
                         {isSelected && isScanning && (
                           <>
                             <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-scan-line shadow-[0_0_15px_cyan]" />
                           </>
                         )}
                      </div>
                      {isSelected && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.type === '開心' ? 'from-emerald-950 to-zinc-950' : 'from-rose-950 to-zinc-950'} flex flex-col p-4 [transform:rotateY(180deg)] backface-hidden rounded-2xl border-2 ${card.type === '開心' ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                           <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                              <div className={`p-3 bg-zinc-900/60 rounded-full border ${card.type === '開心' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
                                 {React.createElement(ICON_MAP[card.icon] || Rocket, { className: `w-7 h-7 ${card.type === '開心' ? 'text-emerald-400' : 'text-rose-400'}` })}
                              </div>
                              <h3 className="text-[9px] sm:text-[10px] font-black text-white leading-tight px-0.5 line-clamp-4">{card.cn}</h3>
                           </div>
                           <div className={`text-center font-mono-tech text-[6px] ${card.type === '開心' ? 'text-emerald-500' : 'text-rose-500'} tracking-[0.2em] uppercase mt-auto`}>{card.type === '開心' ? 'POSITIVE' : 'STRESS'}</div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {state.status === 'playing' && state.currentCard && !isDrawing && (
                  <div className="flex flex-col items-center justify-center gap-4 animate-in zoom-in w-full h-full py-4 overflow-visible">
                    <div className="flex-1 w-full flex items-center justify-center min-h-0 py-2">
                      <div className={`relative w-[210px] h-[300px] sm:w-[280px] sm:h-[400px] transition-all duration-700 preserve-3d [transform:rotateY(180deg)] shadow-2xl`}>
                        <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center backface-hidden border-4 border-zinc-800 rounded-[32px]">
                           <Scan className="w-14 h-14 text-zinc-700" />
                        </div>
                        <div className={`absolute inset-0 bg-gradient-to-br ${state.currentCard.type === '開心' ? 'from-emerald-950 to-zinc-950' : 'from-rose-950 to-zinc-950'} border-4 ${state.currentCard.type === '開心' ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-rose-500/50 shadow-rose-500/20'} rounded-[32px] flex flex-col p-6 [transform:rotateY(180deg)] backface-hidden`}>
                           <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-3 min-h-0">
                              <div className={`p-5 sm:p-8 bg-zinc-900/80 rounded-full border-2 ${state.currentCard.type === '開心' ? 'border-emerald-500/30' : 'border-rose-500/30'} backdrop-blur-sm shadow-inner shrink-0`}>
                                 {React.createElement(ICON_MAP[state.currentCard.icon] || Rocket, { className: `w-9 h-9 sm:w-14 sm:h-14 ${state.currentCard.type === '開心' ? 'text-emerald-400' : 'text-rose-400'}` })}
                              </div>
                              <h3 className="text-sm sm:text-xl font-black text-white leading-relaxed line-clamp-4 overflow-hidden">{state.currentCard.cn}</h3>
                           </div>
                           <div className={`relative z-10 text-center font-mono-tech text-[8px] sm:text-[9px] ${state.currentCard.type === '開心' ? 'text-emerald-500' : 'text-rose-500'} tracking-[0.3em] uppercase mt-4 shrink-0`}>{state.currentCard.type === '開心' ? 'EMOTION: POSITIVE' : 'EMOTION: STRESS'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 w-full max-w-[280px] sm:max-w-md px-2 animate-in slide-in-from-bottom duration-500 shrink-0 pb-6">
                      <button onClick={() => handleDecision('開心')} className="flex-1 py-4 bg-emerald-600/10 border-2 border-emerald-500 text-emerald-400 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-lg">開心</button>
                      <button onClick={() => handleDecision('不開心')} className="flex-1 py-4 bg-rose-600/10 border-2 border-rose-500 text-rose-400 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-lg">不開心</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {state.status === 'sop' && (
            <div className="flex-1 flex flex-col bg-zinc-950 rounded-[32px] sm:rounded-[40px] border-2 border-rose-500/30 overflow-hidden shadow-2xl relative max-h-full">
               <div className="bg-rose-700 text-white p-2.5 sm:p-3 flex justify-between items-center z-20 shrink-0">
                 <div className="flex items-center gap-2 font-header text-[10px] sm:text-sm tracking-widest animate-pulse uppercase"><ShieldAlert size={14} className="sm:w-4 sm:h-4" /> Stabilization Protocol</div>
                 <div className="bg-black/30 px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase">PHASE 0{state.sopStep}</div>
               </div>
               <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
                 {isDecompressing && (
                   <div className="absolute inset-0 z-50 bg-cyan-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-white">
                      <Wind className="w-16 h-16 sm:w-20 sm:h-20 text-cyan-300 animate-spin-slow opacity-80" />
                      <h3 className="text-xl sm:text-2xl font-header mt-6 tracking-widest uppercase italic">核心散熱中...</h3>
                   </div>
                 )}
                 <div className="flex-1 w-full flex flex-col items-center justify-center overflow-y-auto px-4 py-4 min-h-0">
                   {state.sopStep === 1 && (
                     <div className="text-center animate-in zoom-in w-full max-w-xs shrink-0 relative">
                       {/* 加壓背景光暈效果 */}
                       <div className={`absolute inset-0 -z-10 rounded-full blur-[100px] transition-all duration-300 ${isPressing ? 'bg-rose-500/30 opacity-100' : 'bg-rose-500/0 opacity-0'}`} />
                       
                       <h3 className="text-lg sm:text-xl font-black text-white mb-1 uppercase tracking-widest">核心加壓</h3>
                       <p className="text-zinc-500 text-[9px] sm:text-[10px] mb-4 italic uppercase">Stabilization Power: {Math.round(pressure)}%</p>
                       
                       <div className="relative w-44 h-44 sm:w-60 sm:h-60 mx-auto shrink-0 flex items-center justify-center my-6">
                          {/* 加壓時的多重外環動畫 */}
                          <div className={`absolute inset-0 rounded-full border-4 border-rose-500/20 transition-all duration-300 ${isPressing ? 'scale-125 opacity-100 animate-ping' : 'scale-100 opacity-0'}`} />
                          <div className={`absolute -inset-4 rounded-full border-2 border-rose-500/10 transition-all duration-500 ${isPressing ? 'scale-150 opacity-100 animate-pulse' : 'scale-100 opacity-0'}`} />
                          
                          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                             <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-900" />
                             <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - pressure / 100)} className="text-rose-500 transition-all duration-75 ease-linear" strokeLinecap="round" />
                          </svg>
                          <button 
                            onMouseDown={startPressure} onMouseUp={stopPressure} onMouseLeave={stopPressure} onTouchStart={startPressure} onTouchEnd={stopPressure} 
                            onClick={pressure >= 100 ? handlePressureDone : undefined}
                            className={`z-10 w-32 h-32 sm:w-44 sm:h-44 rounded-full border-4 transition-all flex flex-col items-center justify-center ${pressure >= 100 ? 'bg-emerald-600 border-emerald-400 scale-105 shadow-[0_0_50px_rgba(16,185,129,0.8)]' : isPressing ? 'bg-rose-500 border-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.5)]' : 'bg-rose-800 border-rose-400 active:scale-95'}`}>
                            <span className="text-white font-black text-sm sm:text-lg uppercase tracking-tighter leading-none">{pressure >= 100 ? '指令執行' : isPressing ? '壓縮中...' : '持續按住'}</span>
                            {pressure < 100 && <span className="text-white/50 text-[10px] mt-2 font-mono-tech">{Math.round(pressure)}%</span>}
                            {pressure >= 100 && <ShieldCheck className="text-white mt-2 animate-bounce" />}
                          </button>
                       </div>
                     </div>
                   )}

                   {state.sopStep === 2 && (
                     <div className="text-center w-full max-w-sm animate-in slide-in-from-right flex flex-col items-center shrink-0">
                       <h3 className="text-lg sm:text-xl font-black text-white mb-1 tracking-widest uppercase">熱能冷卻</h3>
                       <p className="text-zinc-500 text-[9px] sm:text-[10px] mb-4 sm:mb-6 italic uppercase">Phase Synchronization: {breathCount}/{state.missionConfig.breathCycles}</p>
                       
                       <div className="relative w-48 h-48 sm:w-64 sm:h-64 border-2 sm:border-4 border-cyan-500/10 rounded-full flex items-center justify-center mb-10 shrink-0">
                          {/* 呼吸動畫的多重光圈 */}
                          <div className={`absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-pulse-aura transition-all duration-1000 ${breathPhase === 'inhale' ? 'scale-125 opacity-100' : 'scale-100 opacity-0'}`} />
                          
                          <div 
                            className={`rounded-full transition-all ease-in-out z-10 shrink-0 ${getBreathSize()}`} 
                            style={{ transitionDuration: getBreathDuration() }} 
                          />
                          <div className="absolute inset-4 border border-cyan-500/5 rounded-full animate-spin-slow" />
                       </div>
                       
                       {/* 呼吸進度燈 - 恢復顯示 */}
                       <div className="flex justify-center gap-2 mb-8 shrink-0">
                         {Array.from({ length: state.missionConfig.breathCycles }).map((_, i) => (
                           <div key={i} className={`w-8 sm:w-12 h-1.5 rounded-full transition-all duration-500 shadow-lg ${breathCount > i ? 'bg-cyan-400 shadow-[0_0_15px_cyan]' : 'bg-zinc-800'}`} />
                         ))}
                       </div>
                       
                       <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, sopStep: 3 })); }} disabled={breathCount < state.missionConfig.breathCycles} className="w-full py-4 bg-cyan-600 disabled:opacity-20 text-white rounded-2xl font-black text-lg border-b-6 border-cyan-950 active:scale-95 transition-all shadow-xl">確認穩定 / OK</button>
                     </div>
                   )}

                   {state.sopStep === 3 && (
                     <div className="w-full h-full flex flex-col animate-in slide-in-from-right py-1">
                        {state.currentCard && (
                          <div className="bg-zinc-900/80 border border-zinc-800 p-2 sm:p-3 rounded-xl mb-3 flex items-center gap-3 shrink-0">
                            <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/30">
                              {React.createElement(ICON_MAP[state.currentCard.icon] || HelpCircle, { className: 'text-rose-400 w-4 h-4' })}
                            </div>
                            <span className="text-[10px] sm:text-xs text-white font-black truncate flex-1">{state.currentCard.cn}</span>
                          </div>
                        )}
                        <div className="flex-1 bg-black/50 rounded-2xl p-4 sm:p-5 border border-zinc-800 overflow-y-auto space-y-6 scrollbar-thin mb-4 min-h-0">
                           <div>
                              <label className="text-[9px] text-zinc-500 font-black block mb-3 pl-2 border-l-2 border-amber-500 uppercase">目前情緒 / Mood</label>
                              <div className="grid grid-cols-3 gap-2">
                                {EMOTIONS.map(e => (
                                  <button key={e.id} onClick={() => handleSopSelection('emotion', e.id)} 
                                    className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all active:scale-95 ${sopSelection.emotion === e.id ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-bounce-select scale-110 z-10' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}>
                                    {React.createElement(ICON_MAP[e.icon] || HelpCircle, { size: 18 })}
                                    <span className="text-[9px] font-bold">{e.cn}</span>
                                  </button>
                                ))}
                              </div>
                           </div>
                           <div>
                              <label className="text-[9px] text-zinc-500 font-black block mb-3 pl-2 border-l-2 border-cyan-500 uppercase">行動方針 / Action</label>
                              <div className="grid grid-cols-3 gap-2">
                                {NEEDS.map(n => (
                                  <button key={n.id} onClick={() => handleSopSelection('need', n.id)} 
                                    className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all active:scale-95 ${sopSelection.need === n.id ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 animate-bounce-select scale-110 z-10' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}>
                                    {React.createElement(ICON_MAP[n.icon] || LifeBuoy, { size: 18 })}
                                    <span className="text-[9px] font-bold">{n.cn}</span>
                                  </button>
                                ))}
                              </div>
                           </div>
                        </div>
                        <button disabled={!sopSelection.emotion || !sopSelection.need} onClick={handleSopCompletion} className="shrink-0 w-full py-4 bg-emerald-600 disabled:opacity-20 text-white rounded-2xl font-black text-lg border-b-6 border-emerald-950 active:translate-y-1 transition-all">執行修復指令</button>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          )}

          {state.status === 'result' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in zoom-in overflow-y-auto py-6">
              <div className="w-full max-w-md bg-zinc-900 border-2 border-emerald-500/30 rounded-[40px] p-8 shadow-2xl shrink-0">
                <Trophy className="w-16 h-16 text-emerald-400 mx-auto mb-6 animate-bounce" />
                <h2 className="text-xl sm:text-2xl font-header text-white mb-2 uppercase tracking-widest">任務完成 / Success</h2>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800"><span className="block text-[8px] text-zinc-500 uppercase font-black mb-1">Score</span><span className="text-xl sm:text-2xl text-emerald-400 font-header leading-none">{state.score}</span></div>
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800"><span className="block text-[8px] text-zinc-500 uppercase font-black mb-1">XP Gain</span><span className="text-xl sm:text-2xl text-amber-400 font-header leading-none">+{state.xp || 0}</span></div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={startNewMission} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg border-b-6 border-emerald-950 active:translate-y-1">再次同步</button>
                  <button onClick={() => setState(prev => ({ ...prev, status: 'splash' }))} className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-2xl font-black text-xs hover:text-white transition-all">返回主介面</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {showSettings && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col p-6 animate-in fade-in backdrop-blur-3xl overflow-y-auto">
            <div className="w-full max-w-xl mx-auto space-y-8 pt-4 pb-12">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <h2 className="text-xl font-header text-white uppercase tracking-widest flex items-center gap-3"><Settings size={24} className="text-cyan-400" /> 系統設置</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-400"><X /></button>
              </div>
              <div className="space-y-8 bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800">
                <div className="space-y-4">
                   <div className="flex justify-between items-center"><label className="text-xs text-zinc-400 uppercase font-black">任務單元數量</label><span className="text-cyan-400 font-mono-tech font-bold text-lg">{state.missionConfig.cardCount}</span></div>
                   <input type="range" min="1" max="10" step="1" value={state.missionConfig.cardCount} onChange={e => updateConfig('cardCount', parseInt(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                </div>
                <button onClick={resetGame} className="w-full py-4 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:translate-y-1"><Trash2 size={16} /> 數據抹除歸零</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-zinc-800 text-zinc-500 rounded-2xl font-black tracking-widest hover:text-white transition-all uppercase text-xs">Close Settings</button>
            </div>
          </div>
        )}

        {showHistory && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b-2 border-zinc-800 flex justify-between items-center bg-zinc-900 shrink-0">
              <h2 className="text-lg font-header text-cyan-400 flex items-center gap-3 uppercase"><History size={20} /> 任務日誌</h2>
              <button onClick={() => setShowHistory(false)} className="px-4 py-2 bg-zinc-800 rounded-xl text-zinc-400 font-black text-xs uppercase">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-12">
              {state.history.length === 0 ? <div className="h-full flex items-center justify-center text-zinc-800 font-mono-tech uppercase italic tracking-widest text-xs">No Data Logged</div> :
                state.history.map((entry, i) => (
                  <div key={i} className="p-3 bg-zinc-900 border-l-2 border-cyan-500 rounded-r-xl border border-zinc-800">
                    <div className="flex justify-between items-start mb-1"><span className="text-[8px] font-mono-tech text-zinc-600">{entry.timestamp}</span><span className="text-[8px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full uppercase font-black">{entry.type}</span></div>
                    <div className="text-zinc-300 text-xs font-bold leading-relaxed">{entry.content}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes scan-line { 0% { top: -10%; } 100% { top: 110%; } }
        .animate-scan-line { animation: scan-line 1.1s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes bounce-select { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1.1); } }
        .animate-bounce-select { animation: bounce-select 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: currentColor; cursor: pointer; border: 3px solid #18181b; }
        .glow-cyan { animation: pulse-cyan 2s infinite; }
        @keyframes pulse-cyan { 0%, 100% { box-shadow: 0 0 5px rgba(34,211,238,0.2); } 50% { box-shadow: 0 0 15px rgba(34,211,238,0.4); } }
        
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .shake-screen { animation: shake 0.3s infinite; }

        @keyframes pulse-aura {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.6; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .animate-pulse-aura { animation: pulse-aura 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }

        * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
      `}</style>
    </div>
  );
};

export default App;

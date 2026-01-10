
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Rocket, Home, School, Settings, History, RefreshCw, CheckCircle2, AlertCircle, Play, 
  ArrowRight, ShieldAlert, Wind, MessageSquare, Trophy, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music, Trash2, ShieldCheck, Loader2, Gauge, Cpu, Wifi, ZapOff, 
  LogOut, Sliders, ToggleLeft, ToggleRight, Check, X, Scan, Hexagon, Hash, ShieldQuestion, 
  ChevronRight, Terminal, Info, LayoutPanelLeft
} from 'lucide-react';
import { GameState, Card, LogEntry, MissionConfig, EmotionZone } from './types';
import { SCHOOL_CARDS, HOME_CARDS, BOSS_CARDS, EMOTIONS, NEEDS } from './constants';

const ICON_MAP: Record<string, any> = {
  Rocket, Home, School, Settings, History, RefreshCw, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music
};

// --- 音訊系統優化 (防止崩潰) ---
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

  try {
    const playTone = (freq: number, oscType: OscillatorType, duration: number, volume: number = 0.05) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    };

    switch (type) {
      case 'click': playTone(800, 'sine', 0.1); break;
      case 'draw': playTone(300, 'sawtooth', 0.5, 0.02); break;
      case 'scan':
        const o1 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(100, ctx.currentTime);
        o1.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.5);
        g.gain.setValueAtTime(0.02, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        o1.connect(g); g.connect(ctx.destination);
        o1.start(); o1.stop(ctx.currentTime + 0.5);
        break;
      case 'correct': playTone(523.25, 'sine', 0.3, 0.05); setTimeout(() => playTone(659.25, 'sine', 0.3, 0.05), 100); break;
      case 'wrong': playTone(140, 'square', 0.3, 0.03); break;
      case 'pressure':
        const pOsc = ctx.createOscillator();
        const pGain = ctx.createGain();
        pOsc.type = 'triangle';
        pOsc.frequency.setValueAtTime(60, ctx.currentTime);
        pOsc.frequency.linearRampToValueAtTime(120, ctx.currentTime + (customDuration || 5));
        pGain.gain.setValueAtTime(0.03, ctx.currentTime);
        pGain.gain.linearRampToValueAtTime(0, ctx.currentTime + (customDuration || 5));
        pOsc.connect(pGain); pGain.connect(ctx.destination);
        pOsc.start(); pOsc.stop(ctx.currentTime + (customDuration || 5));
        break;
      case 'inhale': 
        playTone(200, 'sine', customDuration || 3, 0.02);
        break;
      case 'exhale':
        playTone(400, 'sine', customDuration || 3, 0.02);
        break;
      case 'hiss':
        playTone(100, 'square', 1.0, 0.01);
        break;
    }
  } catch (err) {}
};

const DEFAULT_MISSION_CONFIG: MissionConfig = {
  cardCount: 5,
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
  const [sopSelection, setSopSelection] = useState({ emotion: '', need: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // --- 資源管理 Refs (解決崩潰與邏輯卡死) ---
  const pressureTimerRef = useRef<number | null>(null);
  const decayTimerRef = useRef<number | null>(null);
  const breathTimerRef = useRef<number | null>(null);
  const [pressure, setPressure] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [isDecompressing, setIsDecompressing] = useState(false);

  const [breathPhase, setBreathPhase] = useState<'ready' | 'inhale' | 'hold' | 'exhale' | 'done'>('ready');
  const [breathCount, setBreathCount] = useState(0);

  const clearAllTimers = useCallback(() => {
    if (pressureTimerRef.current) { clearInterval(pressureTimerRef.current); pressureTimerRef.current = null; }
    if (decayTimerRef.current) { clearInterval(decayTimerRef.current); decayTimerRef.current = null; }
    if (breathTimerRef.current) { clearTimeout(breathTimerRef.current); breathTimerRef.current = null; }
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const addLog = useCallback((type: LogEntry['type'], content: string) => {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), type, content };
    setState(prev => ({ ...prev, history: [entry, ...prev.history].slice(0, 50) }));
  }, []);

  // --- 修復重置功能 (Reset) ---
  const resetGame = useCallback(() => {
    playSfx('click');
    if (window.confirm("⚠️ 系統重置確認：確定要抹除核心數據並歸零 XP 嗎？")) {
      clearAllTimers();
      localStorage.removeItem('emotionPilotXP');
      // 直接覆寫整個 State
      const newState: GameState = {
        score: 0,
        xp: 0,
        round: 0,
        totalRounds: 0,
        streak: 0,
        history: [],
        currentRoute: null,
        deck: [],
        currentCard: null,
        status: 'splash',
        sopStep: 1,
        missionConfig: { ...DEFAULT_MISSION_CONFIG }
      };
      setState(newState);
      setShowSettings(false);
      playSfx('wrong');
    }
  }, [clearAllTimers]);

  // --- 修復中止功能 (Abort) ---
  const abortMission = useCallback(() => {
    playSfx('click');
    if (window.confirm("⚠️ 終止確認：確定要放棄任務並返航嗎？")) {
      clearAllTimers();
      setState(prev => ({
        ...prev,
        status: 'splash',
        currentCard: null,
        deck: [],
        round: 0,
        totalRounds: 0,
        score: 0,
        sopStep: 1
      }));
      setShowSettings(false);
    }
  }, [clearAllTimers]);

  const returnToSplash = useCallback(() => {
    playSfx('click');
    if (window.confirm("確認返回總部系統首頁？當前任務進度將會丟失。")) {
      clearAllTimers();
      setState(prev => ({
        ...prev,
        status: 'splash',
        currentCard: null,
        deck: [],
        round: 0,
        totalRounds: 0,
        score: 0,
        sopStep: 1
      }));
    }
  }, [clearAllTimers]);

  const startNewMission = useCallback(() => {
    playSfx('click');
    clearAllTimers();
    setState(prev => ({ ...prev, score: 0, round: 0, streak: 0, history: [], currentRoute: null, deck: [], currentCard: null, status: 'routing', sopStep: 1 }));
  }, [clearAllTimers]);

  const selectRoute = useCallback((route: string) => {
    playSfx('click');
    setState(prev => ({ ...prev, currentRoute: route, status: 'ready' }));
  }, []);

  const applyConfigAndStart = useCallback(() => {
    playSfx('click');
    setState(prev => {
      const pool = prev.currentRoute === 'school' ? [...SCHOOL_CARDS] : [...HOME_CARDS];
      let baseDeck = [...pool].sort(() => Math.random() - 0.5);
      const count = Math.max(1, prev.missionConfig.cardCount);
      
      let finalDeck: Card[] = [];
      if (count === 1) {
         finalDeck = [BOSS_CARDS[Math.floor(Math.random() * BOSS_CARDS.length)]];
      } else {
         const selectedPool = baseDeck.slice(0, count - 1);
         const boss = BOSS_CARDS[Math.floor(Math.random() * BOSS_CARDS.length)];
         finalDeck = [...selectedPool, boss].sort(() => Math.random() - 0.5);
      }
      return { ...prev, deck: finalDeck, totalRounds: finalDeck.length, status: 'picking' };
    });
  }, []);

  const pickCard = useCallback((cardIndex: number) => {
    if (isDrawing) return;
    playSfx('draw');
    setIsDrawing(true);
    setTimeout(() => {
      setState(prev => {
        const nextCard = prev.deck[cardIndex];
        const newDeck = prev.deck.filter((_, i) => i !== cardIndex);
        return { ...prev, currentCard: nextCard, deck: newDeck, round: prev.round + 1, status: 'playing' };
      });
      setIsDrawing(false);
      setIsFlipped(false);
    }, 800);
  }, [isDrawing]);

  const nextTurn = useCallback(() => {
    setState(prev => {
      if (prev.deck.length === 0) return { ...prev, status: 'result' };
      return { ...prev, status: 'picking' };
    });
  }, []);

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
      setState(prev => ({ ...prev, score: prev.score + (prev.currentCard?.isBoss ? 50 : 20), xp: prev.xp + 5 }));
      addLog('decision', `核心判斷：對準 ${choice}`);
      if (choice === '危險') triggerSOP();
      else nextTurn();
    } else {
      playSfx('wrong');
      setState(prev => ({ ...prev, score: Math.max(0, prev.score - 10) }));
      addLog('decision', `核心失準：偵測到 ${choice}`);
      if (state.currentCard.type === '危險') triggerSOP();
      else nextTurn();
    }
  }, [state.currentCard, addLog, triggerSOP, nextTurn]);

  const startPressure = () => {
    if (pressure >= 100 || isDecompressing) return;
    setIsPressing(true);
    if (decayTimerRef.current) { clearInterval(decayTimerRef.current); decayTimerRef.current = null; }
    const increment = 100 / (state.missionConfig.pressureDuration * 25);
    playSfx('pressure', state.missionConfig.pressureDuration);
    pressureTimerRef.current = window.setInterval(() => {
      setPressure(p => {
        if (p >= 100) { if (pressureTimerRef.current) clearInterval(pressureTimerRef.current); pressureTimerRef.current = null; return 100; }
        return p + increment;
      });
    }, 40);
  };

  const stopPressure = () => {
    setIsPressing(false);
    if (pressureTimerRef.current) { clearInterval(pressureTimerRef.current); pressureTimerRef.current = null; }
    if (pressure > 0 && pressure < 100) {
      decayTimerRef.current = window.setInterval(() => {
        setPressure(p => {
          if (p <= 0) { if (decayTimerRef.current) clearInterval(decayTimerRef.current); decayTimerRef.current = null; return 0; }
          return p - 1.5;
        });
      }, 40);
    }
  };

  const handlePressureDone = () => {
    if (pressure >= 100) {
      playSfx('click');
      setIsDecompressing(true); playSfx('hiss');
      setTimeout(() => {
        setIsDecompressing(false);
        let nextStep = 2;
        if (!state.missionConfig.enableBreath) {
          nextStep = 3;
          if (!state.missionConfig.enableReport) { nextTurn(); return; }
        }
        setState(prev => ({ ...prev, sopStep: nextStep }));
        setPressure(0); setBreathCount(0); setBreathPhase('ready');
      }, 1500);
    }
  };

  const startScanningCard = () => {
    if (isFlipped || isScanning) return;
    setIsScanning(true); playSfx('scan');
    setTimeout(() => { setIsScanning(false); setIsFlipped(true); playSfx('correct'); }, 1200);
  };

  const handleNextStep = () => {
    playSfx('click');
    if (state.sopStep === 2 && breathCount >= state.missionConfig.breathCycles) {
      let nextStep = 3;
      if (!state.missionConfig.enableReport) { nextTurn(); return; }
      setState(prev => ({ ...prev, sopStep: nextStep }));
    }
  };

  const handleSopCompletion = () => {
    playSfx('correct');
    const emoLabel = EMOTIONS.find(e => e.id === sopSelection.emotion)?.cn || '';
    const needLabel = NEEDS.find(n => n.id === sopSelection.need)?.cn || '';
    addLog('sop', `穩定回報：偵測 ${emoLabel}，執行 ${needLabel}`);
    setState(prev => ({ ...prev, xp: prev.xp + 10 }));
    setSopSelection({ emotion: '', need: '' });
    nextTurn();
  };

  // --- 呼吸循環優化 (防死迴圈) ---
  useEffect(() => {
    if (state.status === 'sop' && state.sopStep === 2 && breathCount < state.missionConfig.breathCycles) {
      const config = state.missionConfig;
      if (breathPhase === 'ready') {
         breathTimerRef.current = window.setTimeout(() => { setBreathPhase('inhale'); playSfx('inhale', config.inhaleTime); }, 800);
         return;
      }
      
      const durations = { ready: 800, inhale: config.inhaleTime * 1000, hold: config.holdTime * 1000, exhale: config.exhaleTime * 1000, done: 0 };
      const currentDuration = durations[breathPhase as keyof typeof durations] || 1000;
      
      breathTimerRef.current = window.setTimeout(() => {
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
      }, currentDuration);
      
      return () => { if (breathTimerRef.current) window.clearTimeout(breathTimerRef.current); };
    }
  }, [state.status, state.sopStep, breathPhase, breathCount, state.missionConfig]);

  const updateConfig = (key: keyof MissionConfig, val: any) => {
    setState(prev => ({ ...prev, missionConfig: { ...prev.missionConfig, [key]: val } }));
  };

  useEffect(() => { localStorage.setItem('emotionPilotXP', state.xp.toString()); }, [state.xp]);

  const Header = () => (
    <div className="flex justify-between items-center bg-zinc-900/95 border-b-2 border-zinc-800 p-3 relative z-50 h-16">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-400 flex items-center justify-center glow-cyan">
          <LayoutPanelLeft className="text-cyan-400 w-5 h-5" />
        </div>
        <div className="hidden sm:block">
          <h1 className="font-header text-sm tracking-widest text-white uppercase leading-none">Core Pilot Protocol</h1>
          <p className="text-[8px] text-zinc-500 font-mono-tech tracking-tighter uppercase mt-0.5">V8.5 CORE STABILIZED</p>
        </div>
      </div>
      <div className="flex gap-4 font-mono-tech">
        <div className="text-center px-3 border-r border-zinc-800">
          <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">Score</span>
          <span className="text-lg text-emerald-400 font-black tracking-widest">{state.score.toString().padStart(4, '0')}</span>
        </div>
        <div className="text-center px-3">
          <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">Career XP</span>
          <span className="text-lg text-amber-400 font-black tracking-widest">{state.xp}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { playSfx('click'); setShowHistory(true); }} className="p-2 bg-zinc-800 rounded-lg border-b-2 border-black active:translate-y-0.5 transition-transform"><History className="w-5 h-5 text-zinc-400" /></button>
        <button onClick={() => { playSfx('click'); setShowSettings(true); }} className="p-2 bg-zinc-800 rounded-lg border-b-2 border-black active:translate-y-0.5 transition-transform"><Settings className="w-5 h-5 text-zinc-400" /></button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex items-center justify-center p-2 bg-zinc-950 scanlines relative overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      <div className="w-full max-w-5xl h-full max-h-[850px] bg-zinc-900 border-[8px] border-zinc-800 rounded-[48px] shadow-2xl relative flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 p-4 relative overflow-hidden flex flex-col">
          {state.status === 'splash' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-1000 px-6">
              <div className="relative mb-8 group">
                 <div className="absolute -inset-10 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
                 <div className="relative w-32 h-32 bg-zinc-800 rounded-3xl border-4 border-cyan-400 flex items-center justify-center shadow-2xl">
                    <Rocket className="w-16 h-16 text-cyan-400" />
                 </div>
              </div>
              <h2 className="text-5xl font-header text-white mb-4 tracking-tighter">核心領航員</h2>
              <div className="text-cyan-500 text-sm font-mono-tech tracking-[0.6em] mb-10 uppercase">Stabilization Protocol</div>
              <div className="flex flex-col gap-6 w-full max-w-xs">
                <button onClick={startNewMission} className="py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-2xl transition-all shadow-xl active:scale-95 border-b-8 border-cyan-950 uppercase tracking-widest">同步啟動</button>
              </div>
            </div>
          )}

          {state.status === 'routing' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in duration-500">
              <h2 className="text-2xl font-header text-cyan-400 uppercase tracking-widest mb-10">目標磁區選擇 / Target Sector</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                <button onClick={() => selectRoute('school')} className="p-6 bg-zinc-800/60 border-2 border-emerald-500/30 hover:border-emerald-400 rounded-3xl group transition-all text-center border-b-8 border-emerald-950 hover:-translate-y-1">
                  <School className="w-16 h-16 mx-auto mb-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-black text-white uppercase mb-1">學校區</h3>
                  <div className="text-[8px] font-mono-tech text-emerald-500 uppercase">Sector Alpha</div>
                </button>
                <button onClick={() => selectRoute('home')} className="p-6 bg-zinc-800/60 border-2 border-amber-500/30 hover:border-amber-400 rounded-3xl group transition-all text-center border-b-8 border-amber-950 hover:-translate-y-1">
                  <Home className="w-16 h-16 mx-auto mb-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-black text-white uppercase mb-1">家裡區</h3>
                  <div className="text-[8px] font-mono-tech text-amber-500 uppercase">Sector Beta</div>
                </button>
              </div>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500">
              <div className="w-full max-w-xl bg-zinc-800/40 border-4 border-zinc-700 rounded-[40px] p-8 text-center shadow-2xl relative overflow-hidden">
                <h2 className="text-3xl font-header text-white mb-2 uppercase tracking-widest">任務準備 / Ready</h2>
                <p className="text-zinc-500 text-[10px] mb-10 font-mono-tech uppercase">Target: Sector {state.currentRoute?.toUpperCase()}</p>
                <div className="grid grid-cols-2 gap-4 mb-10">
                   <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-700 flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-black mb-1">任務單元</span>
                      <span className="text-2xl font-black text-cyan-400">{state.missionConfig.cardCount} <span className="text-xs text-zinc-600">UNITS</span></span>
                   </div>
                   <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-700 flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-black mb-1">系統層級</span>
                      <span className="text-2xl font-black text-amber-400">
                        { (state.missionConfig.enablePressure ? 1 : 0) + (state.missionConfig.enableBreath ? 1 : 0) + (state.missionConfig.enableReport ? 1 : 0) } <span className="text-xs text-zinc-600">LAYERS</span>
                      </span>
                   </div>
                </div>
                <button onClick={applyConfigAndStart} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-2xl border-b-8 border-emerald-950 shadow-xl active:translate-y-1 active:border-b-0">正式啟動</button>
              </div>
            </div>
          )}

          {state.status === 'picking' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in">
              <h2 className="text-3xl font-header text-white mb-2 uppercase tracking-[0.4em] animate-pulse">單元提取 / Pull Unit</h2>
              <div className="relative w-full max-w-4xl h-72 flex items-center justify-center perspective-1000">
                {state.deck.map((card, idx) => {
                  const angle = (idx - (state.deck.length - 1) / 2) * 8;
                  const xOffset = (idx - (state.deck.length - 1) / 2) * 60;
                  return (
                    <div key={card.id} onClick={() => pickCard(idx)} style={{ transform: `translateX(${xOffset}px) rotate(${angle}deg)`, zIndex: idx }}
                      className="absolute bottom-0 w-36 h-52 bg-zinc-900 border-2 border-cyan-500/40 rounded-2xl cursor-pointer hover:-translate-y-16 transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] overflow-hidden group hover:border-cyan-400 active:scale-95"
                    >
                      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/hexellence.png')]" />
                      <div className="absolute inset-2 border border-cyan-500/10 rounded-xl flex flex-col items-center justify-center gap-3">
                         <Cpu className="w-10 h-10 text-zinc-700 group-hover:text-cyan-400 transition-colors" />
                         <span className="text-[10px] text-zinc-600 font-mono-tech uppercase group-hover:text-cyan-500">PACKET</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-16 text-zinc-500 font-mono-tech text-xs uppercase tracking-widest">任務單元進度：{state.totalRounds - state.deck.length} / {state.totalRounds}</div>
            </div>
          )}

          {state.status === 'playing' && (
            <div className="flex-1 flex flex-col items-center justify-center relative py-2">
              {state.currentCard && (
                <div className="w-full flex flex-col items-center gap-10 animate-in zoom-in duration-500">
                  <div onClick={startScanningCard} className={`relative w-[300px] h-[400px] cursor-pointer transition-all duration-700 preserve-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    <div className="absolute inset-0 bg-zinc-900 border-4 border-zinc-800 rounded-[32px] flex flex-col items-center justify-center shadow-2xl overflow-hidden tech-card backface-hidden w-[300px] h-[400px]">
                      <div className="absolute inset-4 border border-cyan-500/10 rounded-[24px]" />
                      <div className="relative z-10 flex flex-col items-center gap-6">
                         <div className={`p-8 bg-zinc-950 rounded-2xl border-2 border-zinc-800 transition-all ${isScanning ? 'border-cyan-500 scale-110 shadow-glow-cyan' : ''}`}>
                            <Scan className={`w-20 h-20 ${isScanning ? 'text-cyan-400 animate-pulse' : 'text-zinc-700'}`} />
                         </div>
                         <div className="text-xl font-header tracking-widest uppercase text-zinc-700">{isScanning ? 'Decoding...' : 'Encrypted'}</div>
                      </div>
                      {isScanning && <div className="absolute top-0 left-0 w-full h-1.5 bg-cyan-400 shadow-[0_0_15px_cyan] animate-scan-line z-20" />}
                    </div>
                    
                    <div className={`absolute inset-0 bg-zinc-900 border-4 ${state.currentCard.type === '安全' ? 'border-emerald-500 shadow-emerald-500/20' : 'border-rose-500 shadow-rose-500/20'} rounded-[32px] flex flex-col p-6 [transform:rotateY(180deg)] tech-card-front backface-hidden w-[300px] h-[400px]`}>
                      <div className="flex justify-between items-center mb-4 relative z-10 font-mono-tech text-[10px] text-zinc-500 uppercase">
                         <div className="flex items-center gap-1.5"><Hexagon size={12} className={state.currentCard.type === '安全' ? 'text-emerald-400' : 'text-rose-400'} />OBJ_PKT</div>
                         <div className={state.currentCard.type === '安全' ? 'text-emerald-500' : 'text-rose-500'}>{state.currentCard.id.toUpperCase()}</div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10 text-center">
                         <div className={`p-6 bg-zinc-950 rounded-full border-2 ${state.currentCard.type === '安全' ? 'border-emerald-500/30' : 'border-rose-500/30'} drop-shadow-glow`}>
                            {React.createElement(ICON_MAP[state.currentCard.icon] || Rocket, { className: "w-14 h-14" })}
                         </div>
                         <h3 className="text-2xl font-black text-white drop-shadow-lg">{state.currentCard.cn}</h3>
                      </div>
                    </div>
                  </div>

                  {isFlipped && !isScanning && (
                    <div className="flex gap-8 w-full max-w-2xl px-6 animate-in slide-in-from-bottom duration-500">
                      <button onClick={() => handleDecision('安全')} className="flex-1 group relative active:translate-y-1 transition-all overflow-hidden rounded-2xl border-2 border-emerald-500/50 hover:border-emerald-400">
                        <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="relative p-6 flex flex-col items-center gap-2 text-center">
                          <ShieldCheck className="w-12 h-12 text-emerald-400 group-hover:scale-110 transition-transform mx-auto" />
                          <div className="text-2xl font-header text-white tracking-widest uppercase">安全</div>
                        </div>
                      </button>
                      <button onClick={() => handleDecision('危險')} className="flex-1 group relative active:translate-y-1 transition-all overflow-hidden rounded-2xl border-2 border-rose-500/50 hover:border-rose-400">
                        <div className="absolute inset-0 bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors" />
                        <div className="relative p-6 flex flex-col items-center gap-2 text-center">
                          <ShieldAlert className="w-12 h-12 text-rose-400 group-hover:scale-110 transition-transform mx-auto" />
                          <div className="text-2xl font-header text-white tracking-widest uppercase">危險</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {state.status === 'sop' && (
            <div className="flex-1 flex flex-col bg-zinc-950 rounded-[40px] border-2 border-rose-500/30 overflow-hidden shadow-2xl relative">
              <div className="bg-rose-700 text-white p-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-2"><ShieldAlert size={20} className="animate-pulse" /><span className="font-header text-sm uppercase tracking-widest">穩定協議啟動</span></div>
                <div className="text-[10px] bg-black/30 px-3 py-1 rounded-full border border-rose-400/20 font-black uppercase tracking-widest">STEP {state.sopStep}</div>
              </div>
              <div className="flex-1 p-4 flex flex-col items-center justify-between relative">
                {isDecompressing && (
                  <div className="absolute inset-0 z-[100] bg-cyan-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
                    <Wind className="w-24 h-24 text-cyan-300 animate-spin-slow mb-6 opacity-80" />
                    <h3 className="text-3xl font-header text-white uppercase italic">核心舒壓中...</h3>
                  </div>
                )}
                {state.sopStep === 1 && (
                  <div className="flex-1 flex flex-col items-center justify-center w-full animate-in zoom-in">
                    <h3 className="text-2xl font-black text-white mb-2 uppercase">核心加壓</h3>
                    <p className="text-zinc-500 text-xs mb-8 italic">長按按鈕以對齊穩定核心能量</p>
                    <div className="relative w-56 h-56 flex items-center justify-center">
                       <svg className="absolute inset-0 w-full h-full -rotate-90 scale-105" viewBox="0 0 200 200">
                         <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-900" />
                         <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - pressure / 100)} className="text-rose-500 transition-all duration-100 ease-linear" strokeLinecap="round" />
                       </svg>
                       <button onMouseDown={startPressure} onMouseUp={stopPressure} onMouseLeave={stopPressure} onTouchStart={startPressure} onTouchEnd={stopPressure} onClick={pressure >= 100 ? handlePressureDone : undefined}
                        className={`z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all ${pressure >= 100 ? 'bg-emerald-600 border-emerald-400 shadow-glow-emerald scale-105' : 'bg-rose-600 border-rose-400 active:scale-95'} border-8`}>
                         {pressure >= 100 ? <><CheckCircle2 className="w-12 h-12 text-white mb-1" /><div className="text-white font-black text-lg uppercase">NEXT</div></> : <><Hand className="w-12 h-12 text-white mb-2" /><div className="text-white font-black text-xl">{isPressing ? '加壓中' : '按住'}</div><div className="text-white/60 text-sm font-mono-tech">{Math.round(pressure)}%</div></>}
                       </button>
                    </div>
                  </div>
                )}
                {state.sopStep === 2 && (
                  <div className="flex-1 flex flex-col items-center justify-center w-full animate-in slide-in-from-right">
                    <h3 className="text-2xl font-black text-white mb-2 uppercase">熱能冷卻</h3>
                    <p className="text-zinc-500 text-xs mb-8 italic">深呼吸 {state.missionConfig.breathCycles} 次，進行核心降溫</p>
                    <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                      <div className={`absolute rounded-full transition-all duration-700 blur-[30px] ${breathPhase === 'inhale' ? 'bg-cyan-400/30 scale-125' : breathPhase === 'hold' ? 'bg-cyan-100/40 scale-125' : 'bg-cyan-600/10 scale-90'}`} style={{ transitionDuration: `${breathPhase === 'inhale' ? state.missionConfig.inhaleTime : state.missionConfig.exhaleTime}s` }} />
                      <div className={`absolute border-8 border-cyan-400/70 rounded-full flex items-center justify-center transition-all ${breathPhase === 'inhale' ? 'w-48 h-48' : breathPhase === 'hold' ? 'w-48 h-48 border-cyan-100 shadow-[0_0_50px_rgba(34,211,238,0.4)]' : 'w-16 h-16 opacity-30'}`} style={{ transitionDuration: `${breathPhase === 'inhale' ? state.missionConfig.inhaleTime : state.missionConfig.exhaleTime}s` }}>
                        <div className="text-center"><Wind className="w-8 h-8 text-cyan-400/80 mx-auto mb-1" /><div className="text-[10px] font-black text-cyan-200 uppercase tracking-widest">{breathPhase}</div></div>
                      </div>
                    </div>
                    <div className="w-full max-w-xs flex flex-col gap-4">
                      <div className="flex justify-center gap-4">{Array.from({ length: state.missionConfig.breathCycles }).map((_, i) => <div key={i} className={`w-12 h-3 rounded-full transition-all duration-700 ${breathCount > i ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)]' : 'bg-zinc-900 border border-zinc-800'}`} />)}</div>
                      <button onClick={handleNextStep} disabled={breathCount < state.missionConfig.breathCycles} className={`w-full py-4 rounded-2xl font-black text-xl transition-all shadow-xl ${breathCount >= state.missionConfig.breathCycles ? 'bg-cyan-600 text-white border-b-6 border-cyan-950' : 'bg-zinc-900 text-zinc-700 opacity-40 cursor-not-allowed'}`}>確認下一步</button>
                    </div>
                  </div>
                )}
                {state.sopStep === 3 && (
                  <div className="w-full h-full flex flex-col animate-in slide-in-from-right py-1">
                    <div className="flex-1 flex flex-col overflow-hidden bg-black/40 rounded-3xl p-4 border border-zinc-800 shadow-inner">
                      <div className="mb-4 bg-zinc-900/90 p-3 rounded-xl border-l-4 border-l-emerald-500/50 text-zinc-300 text-[11px] leading-snug shadow-sm border border-zinc-800/50">
                        塔台，單元 <span className="text-white font-bold">{state.currentCard?.cn}</span> 已中和，偵測情緒：<span className="text-amber-400 font-bold">{EMOTIONS.find(e => e.id === sopSelection.emotion)?.cn || '偵測中...'}</span>，部署協議：<span className="text-cyan-400 font-bold">{NEEDS.find(n => n.id === sopSelection.need)?.cn || '待命...'}</span>。
                      </div>
                      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin">
                        <div className="space-y-3">
                          <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block border-l-2 border-amber-500 pl-3">感應回報 / Detect</label>
                          <div className="grid grid-cols-3 gap-2">{EMOTIONS.map(e => <button key={e.id} onClick={() => { playSfx('click'); setSopSelection(prev => ({ ...prev, emotion: e.id })); }} className={`py-3 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${sopSelection.emotion === e.id ? 'bg-amber-500/30 border-amber-500 text-amber-200 scale-105 shadow-glow-amber' : 'bg-zinc-900/40 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>{React.createElement(ICON_MAP[e.icon], { size: 20 })}<span className="text-[9px] font-bold">{e.cn}</span></button>)}</div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block border-l-2 border-cyan-500 pl-3">修復指令 / Protocol</label>
                          <div className="grid grid-cols-3 gap-2">{NEEDS.map(n => <button key={n.id} onClick={() => { playSfx('click'); setSopSelection(prev => ({ ...prev, need: n.id })); }} className={`py-3 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${sopSelection.need === n.id ? 'bg-cyan-500/30 border-cyan-500 text-cyan-200 scale-105 shadow-glow-cyan' : 'bg-zinc-900/40 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>{React.createElement(ICON_MAP[n.icon], { size: 20 })}<span className="text-[9px] font-bold">{n.cn}</span></button>)}</div>
                        </div>
                      </div>
                    </div>
                    <button disabled={!sopSelection.emotion || !sopSelection.need} onClick={handleSopCompletion} className="mt-4 w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white rounded-2xl font-black text-xl border-b-6 border-emerald-950 active:translate-y-1 transition-all">發送修復指令</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {state.status === 'result' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in overflow-y-auto">
              <div className="w-full max-w-2xl bg-zinc-900 border-4 border-emerald-500/30 rounded-[48px] p-10 relative overflow-hidden shadow-glow-emerald">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
                <div className="relative mb-8">
                   <div className="absolute -inset-10 bg-emerald-400/10 rounded-full blur-[60px] animate-pulse" />
                   <div className="bg-emerald-500/20 w-32 h-32 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/50">
                      <Trophy className="w-16 h-16 text-emerald-400 animate-bounce" />
                   </div>
                </div>
                <h2 className="text-4xl font-header text-white mb-2 uppercase tracking-widest">恭喜領航員！達成任務</h2>
                <div className="text-[10px] font-mono-tech text-emerald-500 uppercase tracking-[0.5em] mb-10">Mission debrief: Core Stabilized</div>
                <div className="grid grid-cols-2 gap-6 w-full mb-10">
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-2 group hover:border-emerald-500 transition-all">
                    <Terminal className="text-zinc-600 group-hover:text-emerald-400" size={20} />
                    <span className="text-[8px] text-zinc-500 uppercase font-black">Score</span>
                    <span className="text-4xl text-emerald-400 font-header">{state.score.toString().padStart(4, '0')}</span>
                  </div>
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-2 group hover:border-amber-500 transition-all">
                    <Activity className="text-zinc-600 group-hover:text-amber-400" size={20} />
                    <span className="text-[8px] text-zinc-500 uppercase font-black">XP GAIN</span>
                    <span className="text-4xl text-amber-400 font-header">+{state.xp}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-4 w-full">
                    <div className="flex gap-4 w-full">
                       <button onClick={() => { playSfx('click'); setShowHistory(true); }} className="flex-1 py-4 bg-zinc-800/80 text-zinc-400 hover:text-white rounded-3xl font-black border-2 border-zinc-700 uppercase text-xs active:translate-y-1">日誌</button>
                       <button onClick={startNewMission} className="flex-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black border-b-8 border-emerald-950 uppercase text-sm active:translate-y-1 transition-all">再次同步</button>
                    </div>
                    <button onClick={returnToSplash} className="w-full py-4 bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-white rounded-3xl font-black uppercase text-xs active:translate-y-1">返回主系統 / Return to HQ</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {showHistory && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b-2 border-zinc-800 flex justify-between items-center bg-zinc-900 shadow-2xl">
              <h2 className="text-xl font-black flex items-center gap-3 text-cyan-400 font-header uppercase"><History className="w-6 h-6" />Flight Memory</h2>
              <button onClick={() => { playSfx('click'); setShowHistory(false); }} className="text-zinc-400 bg-zinc-800 px-4 py-2 rounded-lg font-black text-[10px] uppercase border-b-2 border-black active:translate-y-1">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {state.history.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-800 font-mono-tech uppercase opacity-40 italic tracking-[0.5em]">No Data Cached</div> :
                state.history.map((entry, i) => (
                  <div key={i} className="p-4 bg-zinc-900 border-l-4 border-cyan-500 rounded-r-2xl border border-zinc-800 animate-in fade-in slide-in-from-left">
                    <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-mono-tech text-zinc-600 bg-black px-3 py-1 rounded-full">{entry.timestamp}</span><span className="text-[9px] px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full uppercase font-black">{entry.type}</span></div>
                    <div className="text-lg text-zinc-200 font-bold">{entry.content}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {showSettings && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col items-center justify-center p-4 animate-in fade-in backdrop-blur-3xl overflow-y-auto">
            <div className="w-full max-w-4xl bg-zinc-900 border-4 border-zinc-800 rounded-[40px] p-8 relative shadow-2xl">
              <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-4">
                <h2 className="text-3xl font-header text-white uppercase tracking-widest flex items-center gap-3"><Settings className="text-cyan-400" /> 系統設置</h2>
                <button onClick={() => { playSfx('click'); setShowSettings(false); }} className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors text-white"><X size={24} /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
                <div className="space-y-8">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">任務配置 / Config</h3>
                  <div className="bg-zinc-800/40 p-6 rounded-3xl border border-zinc-800 space-y-6">
                    <div>
                      <div className="flex justify-between mb-3"><label className="text-xs text-zinc-400 uppercase font-black">任務單元數量</label><span className="text-cyan-400 font-mono-tech font-bold text-sm">{state.missionConfig.cardCount} / 10</span></div>
                      <input type="range" min="1" max="10" step="1" value={state.missionConfig.cardCount} onChange={e => updateConfig('cardCount', parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-zinc-800 flex flex-col sm:flex-row gap-4">
                {state.status !== 'splash' && state.status !== 'result' && <button onClick={abortMission} className="flex-1 py-4 bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:translate-y-1 border-b-6 border-black"><LogOut size={20} /><span>中止當前任務</span></button>}
                <button onClick={resetGame} className="flex-1 py-4 bg-rose-950/20 border-2 border-rose-900/40 text-rose-500 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:translate-y-1 border-b-6 border-rose-950"><RefreshCw size={20} /><span>數據抹除歸零</span></button>
              </div>
              <button onClick={() => { playSfx('click'); setShowSettings(false); }} className="mt-8 w-full py-3 bg-zinc-800/50 text-zinc-600 rounded-xl font-black border border-zinc-800 uppercase text-[10px] tracking-widest hover:text-white transition-all">關閉設置</button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes scan-line { 0% { top: -5%; } 100% { top: 105%; } }
        .animate-scan-line { animation: scan-line 1.5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: currentColor; cursor: pointer; }
        .glow-cyan { animation: pulse-cyan 2s infinite; }
        .tech-card, .tech-card-front { width: 300px; height: 400px; background: linear-gradient(135deg, #18181b 0%, #09090b 100%); will-change: transform; }
      `}</style>
    </div>
  );
};

export default App;

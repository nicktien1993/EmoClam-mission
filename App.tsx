
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Rocket, Home, School, Settings, History, RefreshCw, CheckCircle2, AlertCircle, Play, 
  ArrowRight, ShieldAlert, Wind, MessageSquare, Trophy, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music, Trash2, ShieldCheck, Loader2, Gauge, Cpu, Wifi, ZapOff, 
  LogOut, Sliders, ToggleLeft, ToggleRight, Check, X, Scan, Hexagon, Hash, ShieldQuestion, 
  ChevronRight, Terminal, Info, LayoutPanelLeft, Sparkles, AlertCircle as Warning
} from 'lucide-react';
import { GameState, Card, LogEntry, MissionConfig, EmotionZone } from './types';
import { SCHOOL_CARDS, HOME_CARDS, BOSS_CARDS, EMOTIONS, NEEDS } from './constants';

const ICON_MAP: Record<string, any> = {
  Rocket, Home, School, Settings, History, RefreshCw, Star, Frown, Flame, AlertTriangle, 
  Cloud, Zap, HelpCircle, LifeBuoy, Heart, Shield, Bed, MessageCircle, Hand, BookOpen, 
  Eraser, Droplets, UserX, MicOff, Utensils, Tv, CloudLightning, HeartCrack, Activity, 
  GlassWater, PenTool, Music, ZapOff, CheckCircle2, Trophy, Trash2
};

// --- 進階音訊合成引擎 (沉浸式) ---
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

  const playComplex = (freqs: number[], type: OscillatorType, duration: number, vol: number = 0.05) => {
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

  const playNoise = (duration: number, volume: number = 0.01) => {
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
    case 'click': playComplex([880, 1760], 'sine', 0.1, 0.03); break;
    case 'draw': playComplex([200, 300, 400], 'sawtooth', 0.4, 0.02); break;
    case 'scan': 
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.6);
      g.gain.setValueAtTime(0.02, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
      break;
    case 'correct': playComplex([523.25, 659.25, 783.99], 'sine', 0.5, 0.04); break;
    case 'wrong': playComplex([120, 150], 'square', 0.4, 0.02); break;
    case 'hiss': playNoise(1.5, 0.03); break;
    case 'pressure': 
      const pOsc = ctx.createOscillator();
      const pG = ctx.createGain();
      pOsc.type = 'triangle';
      pOsc.frequency.setValueAtTime(40, ctx.currentTime);
      pOsc.frequency.linearRampToValueAtTime(220, ctx.currentTime + (customDuration || 5));
      pG.gain.setValueAtTime(0.04, ctx.currentTime);
      pOsc.connect(pG); pG.connect(ctx.destination);
      pOsc.start(); pOsc.stop(ctx.currentTime + (customDuration || 5));
      break;
    case 'inhale': playComplex([300, 310], 'sine', customDuration || 3, 0.02); break;
    case 'exhale': playComplex([200, 210], 'sine', customDuration || 3, 0.02); break;
  }
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

  useEffect(() => { return () => clearAllTimers(); }, [clearAllTimers]);

  // Persistent XP data
  useEffect(() => {
    localStorage.setItem('emotionPilotXP', state.xp.toString());
  }, [state.xp]);

  const addLog = useCallback((type: LogEntry['type'], content: string) => {
    const entry: LogEntry = { timestamp: new Date().toLocaleTimeString(), type, content };
    setState(prev => ({ ...prev, history: [entry, ...prev.history].slice(0, 50) }));
  }, []);

  // Fix: Added updateConfig function to manage MissionConfig updates from UI
  const updateConfig = useCallback((key: keyof MissionConfig, value: any) => {
    setState(prev => ({
      ...prev,
      missionConfig: {
        ...prev.missionConfig,
        [key]: value
      }
    }));
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
      const pool = prev.currentRoute === 'school' ? [...SCHOOL_CARDS] : [...HOME_CARDS];
      let baseDeck = [...pool].sort(() => Math.random() - 0.5);
      const count = Math.max(1, prev.missionConfig.cardCount);
      let finalDeck: Card[] = [];
      if (count === 1) finalDeck = [BOSS_CARDS[Math.floor(Math.random() * BOSS_CARDS.length)]];
      else {
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

  const startPressure = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
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
          return p - 3;
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
      }, 2000);
    }
  };

  const startScanningCard = () => {
    if (isFlipped || isScanning) return;
    setIsScanning(true); playSfx('scan');
    setTimeout(() => { setIsScanning(false); setIsFlipped(true); playSfx('correct'); }, 1200);
  };

  useEffect(() => {
    if (state.status === 'sop' && state.sopStep === 2 && breathCount < state.missionConfig.breathCycles) {
      const config = state.missionConfig;
      if (breathPhase === 'ready') {
         breathTimerRef.current = window.setTimeout(() => { setBreathPhase('inhale'); playSfx('inhale', config.inhaleTime); }, 800);
         return;
      }
      const durations = { ready: 800, inhale: config.inhaleTime * 1000, hold: config.holdTime * 1000, exhale: config.exhaleTime * 1000, done: 0 };
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
      }, durations[breathPhase as keyof typeof durations] || 1000);
      return () => { if (breathTimerRef.current) window.clearTimeout(breathTimerRef.current); };
    }
  }, [state.status, state.sopStep, breathPhase, breathCount, state.missionConfig]);

  const handleSopCompletion = () => {
    playSfx('correct');
    addLog('sop', `穩定協議已執行完畢：核心同步中`);
    setState(prev => ({ ...prev, xp: prev.xp + 10 }));
    setSopSelection({ emotion: '', need: '' });
    nextTurn();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-2 bg-zinc-950 scanlines overflow-hidden font-sans select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      <div className="w-full max-w-5xl h-full bg-zinc-900 md:border-[8px] border-zinc-800 md:rounded-[48px] shadow-2xl relative flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center bg-zinc-900/95 border-b-2 border-zinc-800 p-3 relative z-50 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-400 flex items-center justify-center glow-cyan shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              <LayoutPanelLeft className="text-cyan-400 w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-header text-sm tracking-widest text-white uppercase leading-none">CORE NAVIGATOR</h1>
              <p className="text-[8px] text-zinc-500 font-mono-tech tracking-tighter uppercase mt-0.5">PROTOCOL V9.0 IMMERSIVE</p>
            </div>
          </div>
          <div className="flex gap-4 font-mono-tech">
            <div className="text-center px-3 border-r border-zinc-800">
              <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">Score</span>
              <span className="text-lg text-emerald-400 font-black tracking-widest">{state.score.toString().padStart(4, '0')}</span>
            </div>
            <div className="text-center px-3">
              <span className="block text-[8px] text-zinc-500 uppercase font-black tracking-widest">XP</span>
              <span className="text-lg text-amber-400 font-black tracking-widest">{state.xp}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { playSfx('click'); setShowHistory(true); }} className="p-2 bg-zinc-800 rounded-lg border-b-2 border-black active:translate-y-0.5"><History size={20} className="text-zinc-400" /></button>
            <button onClick={() => { playSfx('click'); setShowSettings(true); }} className="p-2 bg-zinc-800 rounded-lg border-b-2 border-black active:translate-y-0.5"><Settings size={20} className="text-zinc-400" /></button>
          </div>
        </div>

        <main className="flex-1 p-4 relative overflow-hidden flex flex-col">
          {state.status === 'splash' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="relative mb-8">
                 <div className="absolute -inset-10 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
                 <div className="relative w-32 h-32 bg-zinc-800 rounded-3xl border-4 border-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    <Rocket className="w-16 h-16 text-cyan-400" />
                 </div>
              </div>
              <h2 className="text-5xl font-header text-white mb-4 tracking-tighter">核心領航員</h2>
              <div className="text-cyan-500 text-sm font-mono-tech tracking-[0.6em] mb-10 uppercase">Holographic System</div>
              <button onClick={startNewMission} className="w-full max-w-xs py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-2xl border-b-8 border-cyan-950 shadow-xl active:scale-95">同步啟動</button>
            </div>
          )}

          {state.status === 'routing' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in">
              <h2 className="text-2xl font-header text-cyan-400 uppercase tracking-widest mb-10 text-center">目標磁區 / Target Sector</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, currentRoute: 'school', status: 'ready' })); }} className="p-8 bg-zinc-800/40 border-2 border-emerald-500/30 hover:border-emerald-400 rounded-[32px] group transition-all text-center border-b-8 border-emerald-950">
                  <School className="w-16 h-16 mx-auto mb-4 text-emerald-400 group-hover:scale-110" />
                  <h3 className="text-xl font-black text-white uppercase">學校區</h3>
                </button>
                <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, currentRoute: 'home', status: 'ready' })); }} className="p-8 bg-zinc-800/40 border-2 border-amber-500/30 hover:border-amber-400 rounded-[32px] group transition-all text-center border-b-8 border-amber-950">
                  <Home className="w-16 h-16 mx-auto mb-4 text-amber-400 group-hover:scale-110" />
                  <h3 className="text-xl font-black text-white uppercase">家裡區</h3>
                </button>
              </div>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in">
              <div className="w-full max-w-xl bg-zinc-800/40 border-4 border-zinc-700 rounded-[48px] p-8 text-center shadow-2xl relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zinc-900 px-6 py-1 border-2 border-zinc-700 rounded-full text-[10px] text-zinc-500 font-mono-tech font-black uppercase">Mission Briefing</div>
                <h2 className="text-3xl font-header text-white mb-2 uppercase tracking-widest mt-4">任務準備 / Ready</h2>
                <div className="grid grid-cols-2 gap-4 my-10">
                   <div className="p-6 bg-black/40 rounded-3xl border border-zinc-800"><span className="block text-[10px] text-zinc-500 font-black mb-1">單位</span><span className="text-3xl font-black text-cyan-400">{state.missionConfig.cardCount}</span></div>
                   <div className="p-6 bg-black/40 rounded-3xl border border-zinc-800"><span className="block text-[10px] text-zinc-500 font-black mb-1">穩定層級</span><span className="text-3xl font-black text-amber-400">LV.3</span></div>
                </div>
                <button onClick={applyConfigAndStart} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-2xl border-b-8 border-emerald-950 active:translate-y-1">核心啟動</button>
              </div>
            </div>
          )}

          {state.status === 'picking' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in">
              <div className="mb-12 text-center">
                <h2 className="text-2xl font-header text-white mb-1 uppercase tracking-[0.4em] animate-pulse">單元提取 / Pull</h2>
                <div className="text-[10px] font-mono-tech text-cyan-500 uppercase tracking-widest">Select an encrypted data packet</div>
              </div>
              <div className="relative w-full max-w-4xl h-72 flex items-center justify-center perspective-1000">
                {state.deck.map((card, idx) => {
                  const angle = (idx - (state.deck.length - 1) / 2) * 8;
                  const xOffset = (idx - (state.deck.length - 1) / 2) * 45;
                  return (
                    <div key={card.id} onClick={() => pickCard(idx)} style={{ transform: `translateX(${xOffset}px) rotate(${angle}deg)`, zIndex: idx }}
                      className="absolute bottom-0 w-32 h-48 bg-zinc-900 border-2 border-cyan-500/30 rounded-2xl cursor-pointer hover:-translate-y-12 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden group hover:border-cyan-400"
                    >
                      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                      <div className="absolute inset-2 border border-cyan-500/5 rounded-xl flex items-center justify-center"><Cpu size={32} className="text-zinc-800 group-hover:text-cyan-500/40 transition-colors" /></div>
                      <div className="absolute bottom-2 left-0 w-full text-center text-[8px] font-mono-tech text-zinc-700">PKT_{idx.toString().padStart(2,'0')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {state.status === 'playing' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-10">
              {state.currentCard && (
                <div className="w-full flex flex-col items-center gap-8 animate-in zoom-in">
                  {/* Holographic Card */}
                  <div onClick={startScanningCard} className={`relative w-[280px] h-[400px] cursor-pointer transition-all duration-700 preserve-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    {/* BACK */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 border-4 border-zinc-800 rounded-[32px] flex flex-col items-center justify-center backface-hidden shadow-2xl overflow-hidden">
                       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/hexellence.png')] opacity-10" />
                       <Scan className={`w-16 h-16 ${isScanning ? 'text-cyan-400 animate-pulse' : 'text-zinc-700'}`} />
                       <div className="mt-4 font-header tracking-widest text-zinc-600">DECODING...</div>
                       {isScanning && <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-scan-line shadow-[0_0_15px_cyan]" />}
                    </div>
                    {/* FRONT */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${state.currentCard.type === '開心' ? 'from-emerald-950/90 to-zinc-950' : 'from-rose-950/90 to-zinc-950'} border-4 ${state.currentCard.type === '開心' ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-rose-500/50 shadow-rose-500/20'} rounded-[32px] flex flex-col p-6 [transform:rotateY(180deg)] backface-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]`}>
                       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                       <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-6">
                          <div className={`p-8 bg-zinc-900/80 rounded-full border-2 ${state.currentCard.type === '開心' ? 'border-emerald-500/30' : 'border-rose-500/30'} backdrop-blur-sm shadow-inner`}>
                             {React.createElement(ICON_MAP[state.currentCard.icon] || Rocket, { className: `w-14 h-14 ${state.currentCard.type === '開心' ? 'text-emerald-400' : 'text-rose-400'}` })}
                          </div>
                          <h3 className="text-xl font-black text-white leading-relaxed drop-shadow-md">{state.currentCard.cn}</h3>
                       </div>
                       <div className={`relative z-10 text-center font-mono-tech text-[10px] ${state.currentCard.type === '開心' ? 'text-emerald-500' : 'text-rose-500'} tracking-widest uppercase`}>{state.currentCard.type === '開心' ? 'EMOTION: POSITIVE' : 'EMOTION: STRESS'}</div>
                    </div>
                  </div>

                  {isFlipped && !isScanning && (
                    <div className="flex gap-6 w-full max-w-md px-4 animate-in slide-in-from-bottom">
                      <button onClick={() => handleDecision('開心')} className="flex-1 py-5 bg-emerald-600/10 border-2 border-emerald-500 text-emerald-400 rounded-2xl font-black text-xl hover:bg-emerald-600/20 active:translate-y-1 transition-all shadow-lg">開心</button>
                      <button onClick={() => handleDecision('不開心')} className="flex-1 py-5 bg-rose-600/10 border-2 border-rose-500 text-rose-400 rounded-2xl font-black text-xl hover:bg-rose-600/20 active:translate-y-1 transition-all shadow-lg">不開心</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {state.status === 'sop' && (
            <div className="flex-1 flex flex-col bg-zinc-950 rounded-[40px] border-2 border-rose-500/30 overflow-hidden shadow-2xl relative">
               <div className="bg-rose-700 text-white p-3 flex justify-between items-center z-20">
                 <div className="flex items-center gap-2 font-header text-sm tracking-widest animate-pulse"><ShieldAlert size={18} /> STABILIZATION PROTOCOL</div>
                 <div className="bg-black/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">Phase 0{state.sopStep}</div>
               </div>
               
               <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                 {/* 核心舒壓動畫：數位粒子噴射效果 */}
                 {isDecompressing && (
                   <div className="absolute inset-0 z-50 bg-cyan-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-white">
                      <div className="relative">
                        <Wind className="w-24 h-24 text-cyan-300 animate-spin-slow opacity-80" />
                        <div className="absolute inset-0 animate-ping bg-cyan-400 rounded-full opacity-20 scale-150" />
                      </div>
                      <h3 className="text-3xl font-header mt-8 tracking-widest uppercase italic">核心散熱中...</h3>
                      <div className="mt-4 text-[10px] font-mono-tech text-cyan-200 uppercase tracking-widest">Releasing Emotional Pressure</div>
                   </div>
                 )}

                 {state.sopStep === 1 && (
                   <div className="text-center animate-in zoom-in w-full max-w-xs" onContextMenu={(e) => e.preventDefault()}>
                     <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">核心加壓</h3>
                     <p className="text-zinc-500 text-xs mb-10 italic">長按進行核心同步感應</p>
                     <div className="relative w-48 h-48 mx-auto">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-900" />
                           <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - pressure / 100)} className="text-rose-500 transition-all duration-100 ease-linear" strokeLinecap="round" />
                        </svg>
                        <button 
                          onMouseDown={startPressure} onMouseUp={stopPressure} onMouseLeave={stopPressure} 
                          onTouchStart={startPressure} onTouchEnd={stopPressure} 
                          onClick={pressure >= 100 ? handlePressureDone : undefined}
                          className={`absolute inset-4 rounded-full border-4 transition-all flex flex-col items-center justify-center ${pressure >= 100 ? 'bg-emerald-600 border-emerald-400 scale-110 shadow-[0_0_20px_emerald]' : 'bg-rose-600 border-rose-400 active:scale-95 shadow-lg'}`}
                        >
                          <span className="text-white font-black text-xl uppercase">{pressure >= 100 ? 'SUCCESS' : isPressing ? '加壓中' : 'HOLD'}</span>
                          {pressure < 100 && <span className="text-white/60 text-[10px] font-mono-tech mt-1">{Math.round(pressure)}%</span>}
                        </button>
                     </div>
                   </div>
                 )}

                 {state.sopStep === 2 && (
                   <div className="text-center w-full max-w-sm animate-in slide-in-from-right">
                     <h3 className="text-2xl font-black text-white mb-2 tracking-widest uppercase">熱能冷卻 / Cool Down</h3>
                     <p className="text-zinc-500 text-xs mb-12 italic">跟著指示呼吸 {state.missionConfig.breathCycles} 次，進行降溫協議</p>
                     <div className="relative w-44 h-44 mx-auto mb-12 border-4 border-cyan-500/20 rounded-full flex items-center justify-center">
                        <div className={`transition-all duration-700 rounded-full bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.2)] ${breathPhase === 'inhale' ? 'w-40 h-40 bg-cyan-400/30' : breathPhase === 'hold' ? 'w-40 h-40 bg-cyan-100/40' : 'w-12 h-12'}`} />
                        <span className="absolute text-[12px] font-black text-cyan-400 uppercase tracking-widest">{breathPhase}</span>
                     </div>
                     <div className="flex justify-center gap-3 mb-8">
                       {Array.from({ length: state.missionConfig.breathCycles }).map((_, i) => (
                         <div key={i} className={`w-8 h-2 rounded-full transition-all duration-500 ${breathCount > i ? 'bg-cyan-400 shadow-[0_0_10px_cyan]' : 'bg-zinc-800'}`} />
                       ))}
                     </div>
                     <button onClick={() => { playSfx('click'); setState(prev => ({ ...prev, sopStep: 3 })); }} disabled={breathCount < state.missionConfig.breathCycles} className="w-full py-4 bg-cyan-600 disabled:opacity-20 text-white rounded-2xl font-black text-lg border-b-6 border-cyan-950 transition-all">確認穩定</button>
                   </div>
                 )}

                 {state.sopStep === 3 && (
                   <div className="w-full h-full flex flex-col animate-in slide-in-from-right">
                      <div className="flex-1 bg-black/50 rounded-[32px] p-6 border border-zinc-800 overflow-y-auto space-y-8 scrollbar-thin shadow-inner">
                         <div>
                            <label className="text-[10px] text-zinc-500 font-black block mb-4 pl-3 border-l-4 border-amber-500 uppercase tracking-widest">情緒感應回報 / Status Report</label>
                            <div className="grid grid-cols-3 gap-3">
                              {EMOTIONS.map(e => (
                                <button key={e.id} onClick={() => { playSfx('click'); setSopSelection(prev => ({ ...prev, emotion: e.id })); }} 
                                  className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${sopSelection.emotion === e.id ? 'bg-amber-500/20 border-amber-500 text-amber-300 scale-105 animate-bounce-short shadow-glow-amber' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600'}`}>
                                  {React.createElement(ICON_MAP[e.icon] || HelpCircle, { size: 24 })}
                                  <span className="text-[10px] font-bold">{e.cn}</span>
                                </button>
                              ))}
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] text-zinc-500 font-black block mb-4 pl-3 border-l-4 border-cyan-500 uppercase tracking-widest">修復協議部署 / Execute Protocol</label>
                            <div className="grid grid-cols-3 gap-3">
                              {NEEDS.map(n => (
                                <button key={n.id} onClick={() => { playSfx('click'); setSopSelection(prev => ({ ...prev, need: n.id })); }} 
                                  className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${sopSelection.need === n.id ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 scale-105 animate-bounce-short shadow-glow-cyan' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600'}`}>
                                  {React.createElement(ICON_MAP[n.icon] || LifeBuoy, { size: 24 })}
                                  <span className="text-[10px] font-bold">{n.cn}</span>
                                </button>
                              ))}
                            </div>
                         </div>
                      </div>
                      <button disabled={!sopSelection.emotion || !sopSelection.need} onClick={handleSopCompletion} className="mt-6 w-full py-5 bg-emerald-600 disabled:opacity-20 text-white rounded-2xl font-black text-xl border-b-8 border-emerald-950 shadow-xl active:translate-y-1 transition-all">發送修復指令並進入下一回合</button>
                   </div>
                 )}
               </div>
            </div>
          )}

          {state.status === 'result' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in zoom-in">
              <div className="w-full max-w-md bg-zinc-900 border-4 border-emerald-500/30 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 animate-pulse" />
                <Trophy className="w-20 h-20 text-emerald-400 mx-auto mb-8 animate-bounce" />
                <h2 className="text-3xl font-header text-white mb-2 uppercase tracking-widest">任務完成 / Success</h2>
                <p className="text-zinc-500 text-xs mb-10 font-mono-tech uppercase">Core Synchronization Complete</p>
                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800"><span className="block text-[8px] text-zinc-500 uppercase font-black mb-1">Score</span><span className="text-3xl text-emerald-400 font-header">{state.score}</span></div>
                  <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800"><span className="block text-[8px] text-zinc-500 uppercase font-black mb-1">XP Gain</span><span className="text-3xl text-amber-400 font-header">+{state.xp}</span></div>
                </div>
                <div className="flex flex-col gap-4">
                  <button onClick={startNewMission} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-xl border-b-8 border-emerald-950 shadow-lg">再次同步</button>
                  <button onClick={() => setState(prev => ({ ...prev, status: 'splash' }))} className="w-full py-4 bg-zinc-800 text-zinc-500 rounded-3xl font-black text-sm hover:text-white border-b-4 border-black transition-all">返回主介面</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {showSettings && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col p-8 animate-in fade-in backdrop-blur-3xl overflow-y-auto">
            <div className="w-full max-w-xl mx-auto space-y-10">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
                <h2 className="text-3xl font-header text-white uppercase tracking-widest flex items-center gap-4"><Settings size={32} className="text-cyan-400" /> 系統設置</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-400"><X /></button>
              </div>
              <div className="space-y-8 bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800">
                <div className="space-y-4">
                   <div className="flex justify-between items-center"><label className="text-sm text-zinc-400 uppercase font-black">任務單元數量</label><span className="text-cyan-400 font-mono-tech font-bold text-xl">{state.missionConfig.cardCount}</span></div>
                   <input type="range" min="1" max="15" step="1" value={state.missionConfig.cardCount} onChange={e => updateConfig('cardCount', parseInt(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                </div>
                <button onClick={resetGame} className="w-full py-5 bg-rose-950/20 border-2 border-rose-900/40 text-rose-500 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:translate-y-1 border-b-6 border-rose-950"><Trash2 /> 數據抹除歸零</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-zinc-800 text-zinc-500 rounded-2xl font-black tracking-widest hover:text-white transition-all">關閉設置</button>
            </div>
          </div>
        )}

        {showHistory && (
          <div className="absolute inset-0 bg-black/98 z-[300] flex flex-col animate-in slide-in-from-bottom">
            <div className="p-4 border-b-2 border-zinc-800 flex justify-between items-center bg-zinc-900">
              <h2 className="text-xl font-header text-cyan-400 flex items-center gap-3"><History /> 任務日誌</h2>
              <button onClick={() => setShowHistory(false)} className="px-4 py-2 bg-zinc-800 rounded-xl text-zinc-400 font-black text-xs uppercase">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {state.history.length === 0 ? <div className="h-full flex items-center justify-center text-zinc-800 font-mono-tech uppercase italic tracking-widest">No Data Logged</div> :
                state.history.map((entry, i) => (
                  <div key={i} className="p-4 bg-zinc-900 border-l-4 border-cyan-500 rounded-r-2xl border border-zinc-800 animate-in slide-in-from-left">
                    <div className="flex justify-between items-start mb-1"><span className="text-[10px] font-mono-tech text-zinc-600">{entry.timestamp}</span><span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full uppercase font-black">{entry.type}</span></div>
                    <div className="text-zinc-200 font-bold">{entry.content}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes scan-line { 0% { top: -10%; } 100% { top: 110%; } }
        .animate-scan-line { animation: scan-line 1.5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        .animate-bounce-short { animation: bounce-short 0.5s ease-out; }
        @keyframes bounce-short { 0%, 100% { transform: scale(1.05); } 50% { transform: scale(1.15); } }
        .shadow-glow-amber { shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
        .shadow-glow-cyan { shadow: 0 0 20px rgba(34, 211, 238, 0.4); }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: currentColor; cursor: pointer; border: 4px solid #18181b; }
        .glow-cyan { animation: pulse-cyan 2s infinite; }
        @keyframes pulse-cyan { 0%, 100% { box-shadow: 0 0 10px rgba(34,211,238,0.2); } 50% { box-shadow: 0 0 25px rgba(34,211,238,0.5); } }
        * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
      `}</style>
    </div>
  );
};

export default App;

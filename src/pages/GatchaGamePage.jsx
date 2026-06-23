import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2, Star, Sparkles, Crown, UserCheck, Gift, AlertCircle, RefreshCw, CheckCircle2, Keyboard, Monitor, Smartphone, Sun, Moon, MessageCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
const GatchaGamePage = () => {
  const navigate = useNavigate();
  const {
    isDark,
    toggleTheme
  } = useTheme();
  const [rfidTag, setRfidTag] = useState('');
  const inputRef = useRef(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualRfid, setManualRfid] = useState('');
  const [orientation, setOrientation] = useState('landscape');

  // Game States
  // IDLE -> SCAN_SANTRI -> WAIT_VALIDATION (Guru gives verbal q) -> SCAN_GURU -> REWARD_SPIN -> REWARD_SHOW
  const [gameState, setGameState] = useState('IDLE');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [validatingGuru, setValidatingGuru] = useState(null);
  const [activeReward, setActiveReward] = useState(null);
  const [pendingInterrupt, setPendingInterrupt] = useState(null);
  const [interruptionTimer, setInterruptionTimer] = useState(null);
  const [config, setConfig] = useState({
    challenges: [],
    rewards: []
  });

  // Initial Config Load
  useEffect(() => {
    const loadConfig = async () => {
      const {
        data
      } = await supabase.from('website_content').select('content').eq('key', 'gatcha_config').maybeSingle();
      if (data?.content) {
        setConfig(data.content);
      } else {
        // Defaults
        setConfig({
          rewards: [{
            type: "points",
            value: 10,
            label: "10 Poin",
            weight: 50
          }, {
            type: "item",
            value: "Snack",
            label: "Snack",
            weight: 50
          }]
        });
      }
    };
    loadConfig();
  }, []);

  // Focus handling
  useEffect(() => {
    const focusInput = () => {
      if (!showManualInput) inputRef.current?.focus();
    };
    focusInput();
    const interval = setInterval(focusInput, 1000);
    window.addEventListener('click', focusInput);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', focusInput);
    };
  }, [showManualInput]);

  // Timer for resetting game if abandoned
  useEffect(() => {
    let timeout;
    if (gameState !== 'IDLE' && gameState !== 'REWARD_SHOW') {
      timeout = setTimeout(() => {
        resetGame();
      }, 60000); // 1 minute timeout
    }
    return () => clearTimeout(timeout);
  }, [gameState]);
  const resetGame = () => {
    setGameState('IDLE');
    setCurrentPlayer(null);
    setValidatingGuru(null);
    setActiveReward(null);
    setPendingInterrupt(null);
    setRfidTag('');
    setManualRfid('');
    setShowManualInput(false);
  };
  const pickRandom = items => {
    if (!items || items.length === 0) return null;
    if (items[0].weight) {
      // Weighted random
      const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
      let random = Math.random() * totalWeight;
      for (const item of items) {
        random -= item.weight || 1;
        if (random <= 0) return item;
      }
      return items[0];
    }
    return items[Math.floor(Math.random() * items.length)];
  };
  const handleRfidInput = async e => {
    if (e) e.preventDefault();
    const tag = rfidTag.trim();
    if (!tag) return;
    setRfidTag('');
    processGameLogic(tag);
  };
  const handleManualSubmit = e => {
    e.preventDefault();
    if (!manualRfid.trim()) return;
    processGameLogic(manualRfid.trim());
    setShowManualInput(false);
    setManualRfid('');
  };
  const processGameLogic = tag => {
    // --- INTERRUPTION LOGIC ---
    if (gameState !== 'IDLE' && gameState !== 'REWARD_SHOW' && currentPlayer && tag !== currentPlayer.rfid_tag) {
      // Check if it's a guru first (Guru validation is part of normal flow)
      if (gameState === 'WAIT_VALIDATION') {
        // Pass to Guru validation logic
        processGuruValidation(tag).then(isGuru => {
          if (!isGuru) handleInterruption(tag);
        });
        return;
      } else {
        handleInterruption(tag);
        return;
      }
    }

    // --- NORMAL FLOW ---
    if (gameState === 'IDLE') {
      processNewPlayer(tag);
    } else if (gameState === 'WAIT_VALIDATION') {
      processGuruValidation(tag);
    } else if (gameState === 'REWARD_WAIT_TAP') {
      // Legacy state, kept just in case, but we likely skip this now
      if (currentPlayer && tag === currentPlayer.rfid_tag) {
        processRewardSpin();
      }
    }
  };
  const handleInterruption = tag => {
    if (pendingInterrupt === tag) {
      resetGame();
      setTimeout(() => processNewPlayer(tag), 200);
    } else {
      setPendingInterrupt(tag);
      if (interruptionTimer) clearTimeout(interruptionTimer);
      const timer = setTimeout(() => setPendingInterrupt(null), 5000);
      setInterruptionTimer(timer);
    }
  };
  const processNewPlayer = async tag => {
    const {
      data: santri
    } = await supabase.from('santri').select('*').eq('rfid_tag', tag).maybeSingle();
    if (santri) {
      setCurrentPlayer(santri);
      // Immediately go to Validation/Question state (Skipping random challenge)
      setGameState('WAIT_VALIDATION');
    }
  };
  const processGuruValidation = async tag => {
    const {
      data: guru
    } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();
    if (guru) {
      setValidatingGuru(guru);
      // Directly trigger reward spin after Guru validation
      processRewardSpin();
      return true;
    }
    return false;
  };
  const processRewardSpin = async () => {
    setGameState('REWARD_SPIN');
    setTimeout(async () => {
      const reward = pickRandom(config.rewards);
      setActiveReward(reward);
      if (reward.type === 'points' && currentPlayer) {
        await supabase.rpc('increment_santri_points', {
          p_santri_id: currentPlayer.id,
          p_amount: parseInt(reward.value)
        });
        setCurrentPlayer(prev => ({
          ...prev,
          points: (prev.points || 0) + parseInt(reward.value)
        }));
      }
      setGameState('REWARD_SHOW');
      setTimeout(resetGame, 15000);
    }, 3000);
  };
  return <>
            <Helmet><title>Gatcha Challenge - LPQ Al-Muhajirun Metode Qiroati Baturaja</title></Helmet>
            <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} relative overflow-hidden flex flex-col transition-colors duration-300`}>
                {/* Background Animations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                    <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow" style={{
          animationDelay: '2s'
        }}></div>
                    <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-spin-slow ${isDark ? '' : 'invert'}`} style={{
          animationDuration: '60s'
        }}></div>
                </div>

                {/* Header */}
                <div className="relative z-10 p-4 md:p-6 flex justify-between items-center">
                    <Button variant="ghost" onClick={() => navigate('/absensi-digital')} className={`${isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
                        <ArrowLeft className="w-6 h-6 mr-2" /> Kembali
                    </Button>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${isDark ? 'bg-white/10 border border-white/10' : 'bg-white/50 border border-slate-200 shadow-sm'}`}>
                        <Gamepad2 className="w-5 h-5 text-yellow-500" />
                        <span className="font-bold tracking-wider text-yellow-500 hidden md:inline">GACHA GAME </span>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" size="icon" onClick={() => setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')} className={`${isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'bg-white'}`}>
                             {orientation === 'landscape' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                         </Button>
                         <Button variant="outline" size="icon" onClick={toggleTheme} className={`${isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'bg-white'}`}>
                             {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                         </Button>
                         <Button variant="outline" size="icon" onClick={() => setShowManualInput(true)} className={`${isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'bg-white'}`}>
                             <Keyboard className="w-5 h-5" />
                         </Button>
                    </div>
                </div>

                {/* Main Stage */}
                <div className={`flex-1 flex flex-col items-center justify-center relative z-10 p-4 ${orientation === 'portrait' ? 'py-10' : ''}`}>
                    <AnimatePresence mode="wait">
                        {/* IDLE STATE */}
                        {gameState === 'IDLE' && <motion.div key="idle" initial={{
            opacity: 0,
            scale: 0.9
          }} animate={{
            opacity: 1,
            scale: 1
          }} exit={{
            opacity: 0,
            scale: 1.1
          }} className="text-center space-y-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 blur-3xl opacity-30 rounded-full animate-pulse"></div>
                                    <Gamepad2 className={`w-32 h-32 md:w-48 md:h-48 mx-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] ${isDark ? 'text-white' : 'text-slate-800'}`} />
                                </div>
                                <div>
                                    <h1 className={`text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b mb-4 font-serif ${isDark ? 'from-white to-slate-400' : 'from-slate-800 to-slate-500'}`}>GACHA TIME!</h1>
                                    <p className="text-xl text-blue-400 font-mono animate-pulse">TAP KARTU SANTRI UNTUK MULAI</p>
                                </div>
                                
                                {pendingInterrupt && <motion.div initial={{
              y: 20,
              opacity: 0
            }} animate={{
              y: 0,
              opacity: 1
            }} className="bg-red-500/80 backdrop-blur-md p-4 rounded-xl border border-red-400 max-w-md mx-auto mt-8 text-white">
                                        <p className="font-bold text-lg">⚠️ Kartu Berbeda Terdeteksi!</p>
                                        <p className="text-sm">Tap sekali lagi untuk konfirmasi ganti pemain.</p>
                                    </motion.div>}
                            </motion.div>}

                        {/* WAIT VALIDATION (Guru Asking Question) */}
                        {gameState === 'WAIT_VALIDATION' && currentPlayer && <motion.div key="wait_validation" initial={{
            rotateX: 90,
            opacity: 0
          }} animate={{
            rotateX: 0,
            opacity: 1
          }} className={`max-w-3xl w-full border-4 border-blue-500 rounded-[3rem] p-8 md:p-12 text-center shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-white/90 backdrop-blur-xl'}`}>
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-gradient-x"></div>
                                
                                <div className="flex justify-center mb-6">
                                    <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                                        <AvatarImage src={currentPlayer?.foto_url} />
                                        <AvatarFallback>{currentPlayer?.nama_lengkap?.[0]}</AvatarFallback>
                                    </Avatar>
                                </div>
                                
                                <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Halo, {currentPlayer?.nama_panggilan}!</h3>
                                
                                <div className={`py-8 px-6 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                    <div className="flex flex-col items-center gap-4">
                                        <MessageCircle className="w-16 h-16 text-yellow-500 animate-bounce" />
                                        <p className={`text-xl md:text-3xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                            Dengarkan pertanyaan dari Guru...
                                        </p>
                                        <p className="text-sm opacity-70">Jawab dengan lantang dan benar!</p>
                                    </div>
                                </div>

                                <div className={`mt-8 p-6 rounded-2xl border ${isDark ? 'bg-blue-900/30 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                                    <div className="flex flex-col items-center gap-2">
                                        <UserCheck className="w-8 h-8 text-green-500" />
                                        <p className="text-lg font-bold text-green-500">Guru: Tap kartu untuk validasi & beri hadiah!</p>
                                    </div>
                                </div>
                            </motion.div>}

                        {/* REWARD SPINNING */}
                        {gameState === 'REWARD_SPIN' && <motion.div className="text-center">
                                <h2 className="text-4xl font-bold text-yellow-500 mb-8">Mengacak Hadiah...</h2>
                                <div className="flex justify-center gap-4">
                                    {[1, 2, 3].map(i => <motion.div key={i} animate={{
                y: [0, -50, 0]
              }} transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1
              }} className="w-24 h-32 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-xl border-4 border-white"></motion.div>)}
                                </div>
                            </motion.div>}

                        {/* REWARD REVEALED */}
                        {gameState === 'REWARD_SHOW' && activeReward && <motion.div key="reward_show" initial={{
            scale: 0,
            rotate: 180
          }} animate={{
            scale: 1,
            rotate: 0
          }} transition={{
            type: "spring",
            bounce: 0.5
          }} className="max-w-2xl w-full bg-gradient-to-b from-yellow-500 via-orange-500 to-red-600 p-1 rounded-[3rem] shadow-[0_0_100px_rgba(234,179,8,0.5)]">
                                <div className={`rounded-[2.8rem] p-10 text-center h-full relative overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
                                    
                                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                                        <Sparkles className="absolute top-10 left-10 text-yellow-300 w-8 h-8 animate-ping" />
                                        <Sparkles className="absolute bottom-10 right-10 text-yellow-300 w-8 h-8 animate-ping" style={{
                  animationDelay: '0.5s'
                }} />
                                    </div>

                                    <h2 className="text-3xl font-bold text-yellow-500 mb-6 tracking-widest uppercase">🎉 CONGRATULATIONS 🎉</h2>
                                    
                                    <div className="relative inline-block mb-8">
                                        <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-50 rounded-full"></div>
                                        <Avatar className="w-40 h-40 border-[6px] border-white shadow-2xl relative z-10">
                                            <AvatarImage src={currentPlayer?.foto_url} />
                                            <AvatarFallback>{currentPlayer?.nama_panggilan?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-4 -right-4 bg-white text-orange-600 p-2 rounded-full border-4 border-orange-600 z-20 shadow-lg">
                                            <Crown className="w-8 h-8" fill="currentColor" />
                                        </div>
                                    </div>

                                    <h3 className={`text-4xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentPlayer?.nama_lengkap}</h3>
                                    <p className="text-slate-400 mb-8 font-mono">Kamu Mendapatkan:</p>
                                    
                                    <div className={`p-6 rounded-2xl shadow-inner mb-8 transform hover:scale-105 transition-transform ${isDark ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-900'}`}>
                                        <div className="flex items-center justify-center gap-4">
                                            {activeReward.type === 'points' ? <Star className="w-12 h-12 text-yellow-500 fill-yellow-500 animate-spin-slow" /> : <Gift className="w-12 h-12 text-purple-600 animate-bounce" />}
                                            <span className="text-5xl font-black tracking-tighter">{activeReward.label}</span>
                                        </div>
                                        {activeReward.type === 'points' && <p className="text-green-600 font-bold mt-2 text-lg">+ {activeReward.value} Poin Ditambahkan!</p>}
                                    </div>

                                    <Button onClick={resetGame} variant="ghost" className={`${isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}>
                                        <RefreshCw className="w-4 h-4 mr-2" /> Main Lagi
                                    </Button>
                                </div>
                            </motion.div>}
                    </AnimatePresence>

                    {/* Pending Interrupt Popup */}
                    {pendingInterrupt && gameState !== 'IDLE' && <motion.div initial={{
          y: 50,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-full shadow-2xl z-50 flex items-center gap-4 border-4 border-white">
                            <AlertCircle className="w-8 h-8 animate-pulse" />
                            <div>
                                <p className="font-black text-lg uppercase">Ingin Ganti Pemain?</p>
                                <p className="text-sm opacity-90">Tap kartu sekali lagi untuk reset & mulai baru.</p>
                            </div>
                        </motion.div>}

                    {/* Manual Input Dialog */}
                    <Dialog open={showManualInput} onOpenChange={setShowManualInput}>
                        <DialogContent className={`${isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white'}`}>
                            <DialogHeader>
                                <DialogTitle>Input Manual</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleManualSubmit} className="space-y-4">
                                <Input placeholder="Masukkan ID/RFID Tag..." value={manualRfid} onChange={e => setManualRfid(e.target.value)} autoFocus />
                                <Button type="submit" className="w-full">Proses</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Hidden Input for Card Reader */}
                <form onSubmit={handleRfidInput} className="absolute opacity-0 pointer-events-none">
                    <Input ref={inputRef} value={rfidTag} onChange={e => setRfidTag(e.target.value)} autoFocus autoComplete="off" />
                </form>
            </div>
        </>;
};
export default GatchaGamePage;

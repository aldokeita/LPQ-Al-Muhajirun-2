
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trophy, CheckCircle, RotateCcw, Users, Smartphone, Monitor, Gamepad2, Sparkles, ArrowLeft, HelpCircle, Search, ScanLine, Keyboard, Settings, Sun, Moon, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import useWindowSize from '@/hooks/useWindowSize';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { doaHarian, bacaanShalat, suratPendek } from '@/data/islamicContent';
import { useTheme } from '@/contexts/ThemeContext';

const QuizHafalanPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { width, height } = useWindowSize();
  const { user, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  // State
  const [rfidTag, setRfidTag] = useState('');
  const [gameState, setGameState] = useState('idle'); // idle, confirm_santri, spinning, question, result
  const [currentSantri, setCurrentSantri] = useState(null);
  const [validationGuru, setValidationGuru] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [orientation, setOrientation] = useState('landscape');
  const [spinningText, setSpinningText] = useState("MENGACAK SOAL..."); 
  const [resultType, setResultType] = useState('guru'); // 'guru' (points) or 'self' (no points)
  
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualRfid, setManualRfid] = useState('');

  // Settings State
  const [flattenedItems, setFlattenedItems] = useState([]);
  const [displayItems, setDisplayItems] = useState([]); // Items currently shown on wheel (subset)
  
  const [showSettings, setShowSettings] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [adminPin, setAdminPin] = useState('1234');
  
  const inputRef = useRef(null);
  const isPracticeMode = role === 'santri';

  // Load Config from hafalan_items table
  useEffect(() => {
    const loadConfig = async () => {
        // Fetch from the correct hafalan_items table
        const { data: itemsData, error } = await supabase.from('hafalan_items').select('*');
        const categoriesMap = {};
        const colors = { 'Doa': '#3b82f6', 'Surat': '#a855f7', 'Sholat': '#f59e0b' };

        if (itemsData && itemsData.length > 0) {
            itemsData.forEach(item => {
                if (!categoriesMap[item.category]) {
                    categoriesMap[item.category] = {
                        id: item.category,
                        label: item.category,
                        color: colors[item.category] || '#10b981',
                        items: []
                    };
                }
                categoriesMap[item.category].items.push(item.item_name);
            });
        }
        
        let categories = Object.values(categoriesMap);
        
        // Fallback to static data if DB is empty
        if (categories.length === 0) {
            categories = [
                { id: 1, label: 'Doa', color: '#3b82f6', items: doaHarian },
                { id: 2, label: 'Surat', color: '#a855f7', items: suratPendek },
                { id: 3, label: 'Sholat', color: '#f59e0b', items: bacaanShalat }
            ];
        }

        // Fetch pin from config if exists
        const { data: configData } = await supabase.from('website_content').select('content').eq('key', 'quiz_hafalan_config').maybeSingle();
        if (configData?.content) {
            setAdminPin(configData.content.adminPin || '1234');
        }

        // Flatten items
        const allItems = [];
        categories.forEach(cat => {
            if(cat.items && Array.isArray(cat.items)) {
                cat.items.forEach(item => {
                    allItems.push({
                        text: item,
                        category: cat.label,
                        color: cat.color
                    });
                });
            }
        });
        setFlattenedItems(allItems);
    };
    loadConfig();
  }, []);

  // Set current santri automatically if in practice mode
  useEffect(() => {
      if (isPracticeMode && user) {
          setCurrentSantri({
              id: user.id,
              nama_lengkap: user.nama_lengkap,
              nama_panggilan: user.nama_panggilan,
              foto_url: user.foto_url,
              jilid: user.jilid,
              points: user.points || 0,
              rfid_tag: user.rfid_tag
          });
          // Skip scan step for practice
          setGameState('confirm_santri');
      }
  }, [isPracticeMode, user]);

  // Focus Management
  useEffect(() => {
    const focusInput = () => {
        if (!showManualInput && !showSettings && !isPracticeMode) inputRef.current?.focus();
    }
    focusInput();
    const interval = setInterval(focusInput, 500);
    window.addEventListener('click', focusInput);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', focusInput);
    };
  }, [showManualInput, showSettings, isPracticeMode]);

  useEffect(() => {
    if (width && height) {
      setOrientation(width > height ? 'landscape' : 'portrait');
    }
  }, [width, height]);
  
  // Effect for shuffling text during spin
  useEffect(() => {
      let interval;
      if (gameState === 'spinning' && flattenedItems.length > 0) {
          interval = setInterval(() => {
              const randomItem = flattenedItems[Math.floor(Math.random() * flattenedItems.length)];
              setSpinningText(randomItem.text);
          }, 100);
      } else {
          setSpinningText("MENGACAK SOAL...");
      }
      return () => clearInterval(interval);
  }, [gameState, flattenedItems]);


  const calculateLevel = (points) => {
    if (!points || points < 7) return { label: 'Level C', color: 'text-slate-500', border: 'border-slate-400' };
    if (points < 15) return { label: 'Level B', color: 'text-blue-600', border: 'border-blue-500' };
    if (points <= 20) return { label: 'Level A', color: 'text-amber-500', border: 'border-amber-500' };
    return { label: 'Level S', color: 'text-purple-600', border: 'border-purple-500' };
  };

  const processLogic = async (tag) => {
    if (isPracticeMode) return;
    
    setIsLoading(true);
    try {
      if (gameState === 'idle' || gameState === 'result') {
        const { data: santri } = await supabase.from('santri').select('*').eq('rfid_tag', tag).maybeSingle();
        if (santri) {
          setCurrentSantri(santri);
          setGameState('confirm_santri');
        } else {
          toast({ title: "Kartu Tidak Dikenal", description: "Silahkan scan kartu santri yang terdaftar.", variant: "destructive" });
        }
      } else if (gameState === 'confirm_santri') {
        if (currentSantri && tag === currentSantri.rfid_tag) {
           spinWheel();
        } else {
           const { data: santri } = await supabase.from('santri').select('*').eq('rfid_tag', tag).maybeSingle();
           if (santri) {
             setCurrentSantri(santri); 
             toast({ title: "Ganti Pemain", description: `Selamat datang, ${santri.nama_panggilan}!` });
           } else {
             toast({ title: "Konfirmasi Gagal", description: "Tap kartu santri yang sama untuk memutar.", variant: "destructive" });
           }
        }
      } else if (gameState === 'question') {
        // Determine if it's a Guru or the Santri themselves
        const { data: guru } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();
        
        if (guru) {
           // Guru Validation -> Earn Points
           validateAnswer(guru);
        } else if (currentSantri && tag === currentSantri.rfid_tag) {
           // Santri Self Validation -> No Points
           selfValidate();
        } else {
           // Check if it's another santri just in case
           toast({ title: "Kartu Tidak Sesuai", description: "Tap kartu Guru (untuk poin) atau kartu Santri sendiri (tanpa poin).", variant: "warning" });
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const handleRfidSubmit = async (e) => {
    e.preventDefault();
    if (!rfidTag.trim() || isLoading || showSettings) return;
    const tag = rfidTag.trim();
    setRfidTag('');
    await processLogic(tag);
  };
  
  const handleManualSubmit = async (e) => {
      e.preventDefault();
      if (!manualRfid.trim() || isLoading) return;
      const tag = manualRfid.trim();
      setManualRfid('');
      setShowManualInput(false);
      await processLogic(tag);
  };

  const spinWheel = () => {
    if (flattenedItems.length === 0) {
        toast({ title: "Error", description: "Belum ada data konten kuis.", variant: "destructive" });
        return;
    }

    setGameState('spinning');
    
    // Select winner first
    const winnerIndex = Math.floor(Math.random() * flattenedItems.length);
    const winner = flattenedItems[winnerIndex];
    setSelectedQuestion(winner);

    // Prepare display items for wheel (limit to 24 for visual clarity + ensure winner is included)
    let itemsForWheel = [];
    if (flattenedItems.length <= 24) {
        itemsForWheel = [...flattenedItems];
    } else {
        // Pick 23 random distinct items
        const pool = flattenedItems.filter((_, idx) => idx !== winnerIndex);
        const randomSubset = [];
        const usedIndices = new Set();
        while (randomSubset.length < 23 && pool.length > 0) {
            const rand = Math.floor(Math.random() * pool.length);
            if(!usedIndices.has(rand)) {
                randomSubset.push(pool[rand]);
                usedIndices.add(rand);
            }
        }
        // Insert winner at random position
        const insertPos = Math.floor(Math.random() * (randomSubset.length + 1));
        randomSubset.splice(insertPos, 0, winner);
        itemsForWheel = randomSubset;
    }
    setDisplayItems(itemsForWheel);

    // Find index of winner in the *displayed* items to calculate rotation
    const visualWinnerIndex = itemsForWheel.indexOf(winner);
    
    const segmentSize = 360 / itemsForWheel.length;
    const targetRotation = -((visualWinnerIndex * segmentSize) + (segmentSize / 2)); 
    
    const extraSpins = 360 * 10; // Longer spin
    const finalRotation = wheelRotation + extraSpins + targetRotation - (wheelRotation % 360); 
    const jitter = (Math.random() * 10) - 5; 
    
    setWheelRotation(finalRotation + jitter);

    setTimeout(() => {
      setGameState('question');
    }, 8000); // 8s spin duration
  };

  const validateAnswer = async (guru) => {
    setValidationGuru(guru);
    setResultType('guru');
    setGameState('result');
    try {
      const newPoints = (currentSantri.points || 0) + 1;
      await supabase.rpc('increment_santri_points', { p_santri_id: currentSantri.id, p_amount: 1 });
      setCurrentSantri(prev => ({ ...prev, points: newPoints }));
    } catch (error) {
      toast({ title: "Gagal Update Poin", description: error.message, variant: "destructive" });
    }
  };

  const selfValidate = () => {
      setValidationGuru(null);
      setResultType('self');
      setGameState('result');
  };

  const practiceNext = () => {
      setGameState('confirm_santri'); // Back to spin ready
      setSelectedQuestion(null);
  };

  const resetGame = () => {
    if(isPracticeMode) {
        setGameState('confirm_santri');
        setSelectedQuestion(null);
    } else {
        setGameState('idle');
        setCurrentSantri(null);
        setSelectedQuestion(null);
        setValidationGuru(null);
        setResultType('guru');
    }
  };

  const handleSettingsAuth = () => {
      if (pinInput === adminPin || pinInput === 'admin') {
          toast({ title: "Akses Ditolak", description: "Konfigurasi game kini dipusatkan di Dashboard Admin.", variant: "warning" });
          setPinInput('');
          setShowSettings(false);
      } else {
          toast({ title: "Akses Ditolak", description: "PIN Salah.", variant: "destructive" });
      }
  };

  const WheelComponent = () => {
      const itemCount = displayItems.length;
      return (
        <div className="relative w-[350px] h-[350px] md:w-[600px] md:h-[600px] mx-auto my-8">
          {/* Pointer */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 filter drop-shadow-lg">
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-yellow-500"></div>
          </div>
          
          <motion.div 
            className="w-full h-full rounded-full border-[12px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative bg-slate-900"
            animate={{ rotate: wheelRotation }}
            transition={{ duration: 8, ease: [0.1, 0, 0.1, 1] }} // Cubic-bezier for realistic deceleration
          >
            {displayItems.map((item, i) => {
                const rotate = (i * 360) / itemCount;
                const skew = 90 - (360 / itemCount);
                return (
                    <div 
                        key={i}
                        className="absolute top-0 right-0 w-[50%] h-[50%] origin-bottom-left border-l border-white/10"
                        style={{ 
                            transform: `rotate(${rotate}deg) skewY(-${skew}deg)`,
                            background: i % 2 === 0 ? item.color : `${item.color}dd` // Slight variation
                        }}
                    >
                        <div 
                            className="absolute text-white font-bold uppercase tracking-wider drop-shadow-md text-[10px] md:text-sm text-right w-[180px] md:w-[280px] top-[40%] left-[-100%] origin-center truncate px-2"
                            style={{ 
                                transform: `skewY(${skew}deg) rotate(${360/itemCount/2}deg) translate(10%, -50%)`
                            }}
                        >
                           {item.text}
                        </div>
                    </div>
                )
            })}
            {/* Center Cap */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center z-10 border-4 border-slate-600">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center">
                 <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>
      );
  };

  return (
    <>
    <Helmet><title>Quiz Hafalan Gacha - LPQ Al-Muhajirun Metode Qiroati Baturaja</title></Helmet>
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'} overflow-hidden flex flex-col relative font-sans selection:bg-purple-500 selection:text-white transition-colors duration-300`}>
      
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         <div className={`absolute top-0 left-0 w-full h-full ${isDark ? "bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30" : "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"} animate-pulse`}></div>
         <motion.div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-900/40 rounded-full blur-[120px]" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
         <motion.div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-900/40 rounded-full blur-[120px]" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 10, repeat: Infinity, delay: 1 }} />
      </div>

      <div className={`relative z-20 p-4 flex justify-between items-center border-b ${isDark ? 'border-white/10 bg-slate-900/50' : 'border-slate-200 bg-white/50'} backdrop-blur-md`}>
          <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className={isDark ? "text-white hover:bg-white/10" : "text-slate-800 hover:bg-slate-200"} onClick={() => navigate(isPracticeMode ? '/dashboard' : '/absensi-digital')}><ArrowLeft className="w-5 h-5 mr-2" /> Exit</Button>
              <h1 className="text-xl font-bold tracking-wider flex items-center gap-2"><Gamepad2 className="w-6 h-6 text-purple-400" /> QUIZ HAFALAN {isPracticeMode && "(LATIHAN)"}</h1>
          </div>
          {!isPracticeMode && (
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="icon" onClick={() => setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')} className={isDark ? "border-white/20 text-white hover:bg-white/10" : "bg-white border-slate-300 hover:bg-slate-100"}>{orientation === 'landscape' ? <Monitor className="w-4 h-4"/> : <Smartphone className="w-4 h-4"/>}</Button>
                 <Button variant="outline" size="icon" onClick={toggleTheme} className={isDark ? "border-white/20 text-white hover:bg-white/10" : "bg-white border-slate-300 hover:bg-slate-100"}>{isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-600" />}</Button>
                 <Button variant="outline" size="icon" onClick={() => setShowManualInput(true)} className={isDark ? "border-white/20 text-white hover:bg-white/10" : "bg-white border-slate-300 hover:bg-slate-100"}><Keyboard className="w-4 h-4" /></Button>
                 <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} className={isDark ? "border-white/20 text-white hover:bg-white/10" : "bg-white border-slate-300 hover:bg-slate-100"}><Settings className="w-4 h-4" /></Button>
              </div>
          )}
      </div>

      <div className={`flex-1 relative z-10 flex items-center justify-center p-4 ${orientation === 'portrait' ? 'flex-col' : 'flex-row'} gap-8`}>
         <AnimatePresence mode="wait">
             {currentSantri ? (
                <motion.div key="profile" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className={`flex flex-col items-center ${orientation === 'landscape' ? 'w-1/3' : 'w-full max-w-md'}`}>
                    <Card className={`w-full p-6 backdrop-blur-xl border-2 shadow-2xl relative overflow-hidden ${isDark ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200'} ${calculateLevel(currentSantri.points).border}`}>
                         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
                         <Avatar className="w-32 h-32 mx-auto border-4 border-white shadow-xl mb-4"><AvatarImage src={currentSantri.foto_url} className="object-cover"/><AvatarFallback className="text-4xl text-slate-800 font-bold">{currentSantri.nama_lengkap?.[0]}</AvatarFallback></Avatar>
                         <h2 className={`text-2xl font-bold mb-1 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentSantri.nama_lengkap}</h2>
                         <p className={`${isDark ? 'text-white/70' : 'text-slate-500'} mb-4 font-mono`}>{currentSantri.jilid}</p>
                         <div className={`${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-xl p-4 flex justify-around items-center border`}>
                             <div className="text-center"><p className={`text-xs uppercase tracking-widest ${isDark ? 'text-white/50' : 'text-slate-400'} mb-1`}>TOTAL POIN</p><p className="text-4xl font-black text-yellow-400 drop-shadow-lg flex items-center justify-center gap-2"><Trophy className="w-6 h-6" /> {currentSantri.points || 0}</p></div>
                             <div className={`w-px h-10 ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                             <div className="text-center"><p className={`text-xs uppercase tracking-widest ${isDark ? 'text-white/50' : 'text-slate-400'} mb-1`}>RANK</p><p className={`text-2xl font-bold ${calculateLevel(currentSantri.points).color}`}>{calculateLevel(currentSantri.points).label}</p></div>
                         </div>
                         {gameState === 'result' && resultType === 'guru' && !isPracticeMode && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-green-500/20 border border-green-500 text-green-600 dark:text-green-300 px-4 py-2 rounded-lg font-bold animate-pulse">+1 POIN DITAMBAHKAN!</motion.div>)}
                         {gameState === 'result' && resultType === 'self' && !isPracticeMode && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 bg-slate-500/20 border border-slate-500 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg font-bold">LATIHAN MANDIRI (TANPA POIN)</motion.div>)}
                    </Card>
                </motion.div>
             ) : (
                <motion.div key="empty" className={`flex flex-col items-center justify-center ${isDark ? 'text-white/30' : 'text-slate-400'} ${orientation === 'landscape' ? 'w-1/3' : 'w-full h-40'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Users className="w-24 h-24 mb-4 opacity-20" /><p className="text-lg font-light">Menunggu Pemain...</p>
                </motion.div>
             )}
         </AnimatePresence>

         <div className={`flex-1 flex flex-col items-center justify-center w-full max-w-4xl min-h-[400px]`}>
             <AnimatePresence mode="wait">
                {gameState === 'idle' && (
                    <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="text-center space-y-6">
                        <div className="relative w-48 h-48 mx-auto flex items-center justify-center"><div className={`absolute inset-0 border-4 ${isDark ? 'border-white/20' : 'border-slate-300'} rounded-full animate-ping opacity-20`}></div><div className="absolute inset-0 border-4 border-purple-500 rounded-full animate-pulse shadow-[0_0_50px_rgba(168,85,247,0.5)]"></div><ScanLine className={`w-20 h-20 ${isDark ? 'text-white' : 'text-slate-800'} animate-pulse`} /></div>
                        <div><h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-2">SCAN KARTU SANTRI</h2><p className={`${isDark ? 'text-white/60' : 'text-slate-500'} text-lg`}>Silahkan tap kartu untuk memulai quiz.</p></div>
                    </motion.div>
                )}
                {gameState === 'confirm_santri' && (
                    <motion.div key="confirm" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="text-center space-y-8">
                        <HelpCircle className="w-24 h-24 text-yellow-400 mx-auto animate-bounce" />
                        <div>
                            <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Siap untuk Tantangan?</h2>
                            {isPracticeMode ? (
                                <Button onClick={spinWheel} size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xl px-8 py-6 rounded-full animate-pulse">PUTAR SEKARANG!</Button>
                            ) : (
                                <p className={`text-xl ${isDark ? 'text-white/80' : 'text-slate-600'}`}>Tap kartu <span className="font-bold text-yellow-400">{currentSantri.nama_panggilan}</span> sekali lagi untuk memutar Gacha!</p>
                            )}
                        </div>
                        {!isPracticeMode && <div className="flex justify-center gap-2 text-sm opacity-50"><Smartphone className="w-4 h-4" /> Tempel kartu pada reader</div>}
                    </motion.div>
                )}
                {gameState === 'spinning' && (
                    <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                        <WheelComponent />
                        <h2 className={`text-3xl md:text-4xl font-black mt-4 ${isDark ? 'text-white' : 'text-slate-900'} animate-pulse tracking-widest text-center px-4 leading-tight drop-shadow-md min-h-[3rem]`}>
                             {spinningText}
                        </h2>
                    </motion.div>
                )}
                {(gameState === 'question' || gameState === 'result') && selectedQuestion && (
                    <motion.div key="question" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl">
                        <Card className={`border-4 ${gameState === 'result' ? 'border-green-500 bg-green-900/20' : isDark ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-white/90'} backdrop-blur-xl p-8 text-center shadow-2xl overflow-hidden relative`}>
                            {gameState === 'result' && (<div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"><Sparkles className="w-full h-full text-yellow-400 opacity-20 animate-spin-slow" /></div>)}
                            <div className="relative z-10">
                                <div className="inline-block px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider mb-6 text-white border border-white/30" style={{ backgroundColor: selectedQuestion.color }}>{selectedQuestion.category}</div>
                                <h2 className={`text-3xl md:text-5xl font-black mb-8 drop-shadow-lg leading-tight break-words ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedQuestion.text}</h2>
                                {gameState === 'question' && (
                                    isPracticeMode ? (
                                        <Button onClick={() => setGameState('result')} className="w-full bg-green-600 hover:bg-green-500 text-white">Saya Sudah Hafal</Button>
                                    ) : (
                                        <div className={`${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-xl p-6 border animate-pulse`}>
                                            <div className="flex flex-col gap-4 items-center">
                                                <p className="text-yellow-500 font-bold flex items-center justify-center gap-2 text-xl"><Search className="w-6 h-6" /> MENUNGGU VALIDASI</p>
                                                <div className="grid grid-cols-2 gap-4 w-full">
                                                    <div className={`p-3 rounded-lg border ${isDark ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-slate-50'} flex flex-col items-center`}>
                                                        <UserCheck className="w-8 h-8 mb-2 text-blue-400"/>
                                                        <p className="text-xs font-bold uppercase">TAP KARTU SANTRI</p>
                                                        <p className="text-[10px] opacity-70">Tanpa Poin (Latihan)</p>
                                                    </div>
                                                    <div className={`p-3 rounded-lg border ${isDark ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-slate-50'} flex flex-col items-center`}>
                                                        <CheckCircle className="w-8 h-8 mb-2 text-green-400"/>
                                                        <p className="text-xs font-bold uppercase">TAP KARTU GURU</p>
                                                        <p className="text-[10px] opacity-70">Dapat Poin (Resmi)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                                {gameState === 'result' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-center"><CheckCircle className="w-20 h-20 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" /></div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-green-500">JAWABAN BENAR!</h3>
                                            {!isPracticeMode && resultType === 'guru' && <p className={`${isDark ? 'text-white/70' : 'text-slate-600'} text-sm`}>Divalidasi oleh: {validationGuru?.nama}</p>}
                                            {!isPracticeMode && resultType === 'self' && <p className={`${isDark ? 'text-white/70' : 'text-slate-600'} text-sm`}>Validasi Mandiri oleh Santri</p>}
                                        </div>
                                        <Button onClick={isPracticeMode ? practiceNext : resetGame} className={`mt-4 w-full ${isDark ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}><RotateCcw className="w-4 h-4 mr-2"/> {isPracticeMode ? 'Lanjut Latihan' : 'Lanjut / Reset'}</Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                )}
             </AnimatePresence>
         </div>
      </div>

      {/* Settings Dialog - ONLY FOR ADMIN/TEACHER ACCESS (Not Practice Mode) */}
      {!isPracticeMode && (
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogContent className={`${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-900'} max-w-sm`}>
                  <DialogHeader>
                      <DialogTitle>Akses Pengaturan</DialogTitle>
                      <DialogDescription className={isDark ? 'text-slate-400' : 'text-slate-500'}>Masukkan PIN untuk mengakses konfigurasi.</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                      <Label>PIN Admin</Label>
                      <Input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className={isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-300 text-slate-900"} autoFocus/>
                      <Button onClick={handleSettingsAuth} className="w-full">Verifikasi</Button>
                  </div>
              </DialogContent>
          </Dialog>
      )}

      {/* Input Handling (Hidden) - Disabled in practice mode */}
      {!isPracticeMode && (
          <form onSubmit={handleRfidSubmit} className="absolute opacity-0 pointer-events-none">
              <Input ref={inputRef} value={rfidTag} onChange={e => setRfidTag(e.target.value)} autoFocus autoComplete="off" />
          </form>
      )}
      
      {/* Manual Input - Disabled in practice mode */}
      {!isPracticeMode && (
          <Dialog open={showManualInput} onOpenChange={setShowManualInput}>
              <DialogContent className={`${isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900'}`}>
                  <DialogHeader><DialogTitle>Input Manual</DialogTitle></DialogHeader>
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                      <Input placeholder="Masukkan ID/RFID Tag..." value={manualRfid} onChange={e => setManualRfid(e.target.value)} autoFocus className={isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}/>
                      <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white">Proses</Button>
                  </form>
              </DialogContent>
          </Dialog>
      )}
    </div>
    </>
  );
};

export default QuizHafalanPage;

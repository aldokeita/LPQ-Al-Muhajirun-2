
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trophy, CheckCircle, RotateCcw, Users, Smartphone, Monitor, Gamepad2, Sparkles, ArrowLeft, HelpCircle, Search, Sun, Moon, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import useWindowSize from '@/hooks/useWindowSize';
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
  const [gameState, setGameState] = useState('idle'); // idle, confirm_santri, spinning, question, result
  const [currentSantri, setCurrentSantri] = useState(null);
  const [validationGuru, setValidationGuru] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [orientation, setOrientation] = useState('landscape');
  const [spinningText, setSpinningText] = useState("MENGACAK SOAL..."); 
  const [resultType, setResultType] = useState('guru'); // 'guru' (points) or 'self' (no points)
  
  const [santriList, setSantriList] = useState([]);
  const [selectedSantriId, setSelectedSantriId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isRosterLoading, setIsRosterLoading] = useState(true);

  // Wheel content
  const [flattenedItems, setFlattenedItems] = useState([]);
  const [displayItems, setDisplayItems] = useState([]); // Items currently shown on wheel (subset)
  
  const isPracticeMode = role === 'santri';

  // Load Config from hafalan_items table
  useEffect(() => {
    const loadConfig = async () => {
        const [{ data: configData }, { data: itemsData }] = await Promise.all([
            supabase.from('website_content').select('content').eq('key', 'quiz_hafalan_config').maybeSingle(),
            supabase.from('hafalan_items').select('*')
        ]);

        const savedCategories = configData?.content?.categories;
        let categories = Array.isArray(savedCategories) && savedCategories.length > 0
            ? savedCategories
            : [];

        if (categories.length === 0 && itemsData?.length) {
            const categoriesMap = {};
            const colors = { 'Doa': '#3b82f6', 'Surat': '#a855f7', 'Sholat': '#f59e0b' };

            itemsData.forEach((item) => {
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
            categories = Object.values(categoriesMap);
        }

        if (categories.length === 0) {
            categories = [
                { id: 1, label: 'Doa', color: '#3b82f6', items: doaHarian },
                { id: 2, label: 'Surat', color: '#a855f7', items: suratPendek },
                { id: 3, label: 'Sholat', color: '#f59e0b', items: bacaanShalat }
            ];
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

        const { data: santriData, error: santriError } = await supabase
          .from('santri')
          .select('id, nama_lengkap, nama_panggilan, foto_url, jilid, points, status')
          .order('nama_lengkap', { ascending: true });

        if (!santriError) {
          setSantriList((santriData || []).filter((santri) => santri.status !== 'inactive'));
        }
        setIsRosterLoading(false);
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

  const filteredSantri = santriList.filter((santri) => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return true;
    return [santri.nama_lengkap, santri.nama_panggilan, santri.jilid]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const selectSantriForQuiz = () => {
    const selected = santriList.find((santri) => String(santri.id) === String(selectedSantriId));
    if (!selected) return;
    setCurrentSantri(selected);
    setGameState('confirm_santri');
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

    const newPoints = (currentSantri.points || 0) + 1;
    const { error: rpcError } = await supabase.rpc('increment_santri_points', {
      p_santri_id: currentSantri.id,
      p_amount: 1
    });

    if (rpcError) {
      const { error: fallbackError } = await supabase
        .from('santri')
        .update({ points: newPoints })
        .eq('id', currentSantri.id);

      if (fallbackError) {
        toast({ title: "Gagal Update Poin", description: fallbackError.message, variant: "destructive" });
        return;
      }
    }

    setCurrentSantri(prev => ({ ...prev, points: newPoints }));
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
        setSelectedSantriId('');
        setStudentSearch('');
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
                  <motion.div
                    key="idle"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    className="w-full max-w-xl text-center space-y-6"
                  >
                    <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/35 to-cyan-500/35 blur-2xl animate-pulse"></div>
                      <Gamepad2 className={`relative w-20 h-20 ${isDark ? 'text-white' : 'text-slate-800'}`} />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 mb-2">PILIH SANTRI</h2>
                      <p className={`${isDark ? 'text-white/60' : 'text-slate-500'} text-lg`}>Guru memilih pemain langsung dari kelas.</p>
                    </div>
                    <div className={`rounded-3xl p-5 md:p-6 backdrop-blur-xl ${isDark ? 'bg-white/8 shadow-[0_18px_50px_rgba(0,0,0,0.35)]' : 'bg-white/75 shadow-[0_18px_50px_rgba(71,85,105,0.16)]'}`}>
                      <Input
                        value={studentSearch}
                        onChange={(event) => setStudentSearch(event.target.value)}
                        placeholder="Cari nama, panggilan, atau jilid..."
                        className={`mb-3 h-12 ${isDark ? 'bg-slate-900/70 border-white/10 text-white' : 'bg-white/90'}`}
                      />
                      <select
                        value={selectedSantriId}
                        onChange={(event) => setSelectedSantriId(event.target.value)}
                        className={`w-full h-12 rounded-xl px-4 text-sm font-semibold outline-none ${isDark ? 'bg-slate-900/80 text-white' : 'bg-white text-slate-800'}`}
                        disabled={isRosterLoading}
                      >
                        <option value="">{isRosterLoading ? 'Memuat santri...' : 'Pilih santri'}</option>
                        {filteredSantri.map((santri) => (
                          <option key={santri.id} value={santri.id}>
                            {santri.nama_lengkap}{santri.jilid ? ` — ${santri.jilid}` : ''}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="lg"
                        onClick={selectSantriForQuiz}
                        disabled={!selectedSantriId}
                        className="mt-4 w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-600 text-white font-black shadow-lg shadow-purple-500/25"
                      >
                        <Gamepad2 className="w-5 h-5 mr-2" /> Pilih dan Lanjut
                      </Button>
                    </div>
                  </motion.div>
                )}
                {gameState === 'confirm_santri' && (
                    <motion.div key="confirm" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="text-center space-y-8">
                        <HelpCircle className="w-24 h-24 text-yellow-400 mx-auto animate-bounce" />
                        <div>
                            <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Siap untuk Tantangan?</h2>
                            <Button onClick={spinWheel} size="lg" className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-slate-950 font-black text-xl px-8 py-6 rounded-full shadow-lg shadow-orange-500/25 animate-pulse">
                              PUTAR SEKARANG!
                            </Button>
                        </div>
                        {!isPracticeMode && <div className="flex justify-center gap-2 text-sm opacity-55"><UserCheck className="w-4 h-4" /> Guru mengendalikan permainan dari perangkat ini</div>}
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
                                        <div className={`${isDark ? 'bg-slate-900/55' : 'bg-slate-100'} rounded-2xl p-6`}>
                                          <div className="flex flex-col gap-4 items-center">
                                            <p className="text-yellow-500 font-bold flex items-center justify-center gap-2 text-xl"><Search className="w-6 h-6" /> VALIDASI GURU</p>
                                            <p className={`text-sm ${isDark ? 'text-white/65' : 'text-slate-500'}`}>Nilai jawaban santri secara langsung.</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                onClick={selfValidate}
                                                className={`h-14 rounded-xl font-bold ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700'}`}
                                              >
                                                <RotateCcw className="w-5 h-5 mr-2" /> Belum Tepat
                                              </Button>
                                              <Button
                                                type="button"
                                                onClick={() => validateAnswer({ nama: user?.nama || user?.nama_lengkap || 'Guru' })}
                                                className="h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black shadow-lg shadow-emerald-500/25"
                                              >
                                                <CheckCircle className="w-5 h-5 mr-2" /> Jawaban Benar +1
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                    )
                                )}
                                {gameState === 'result' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-center">
                                          {resultType === 'guru'
                                            ? <CheckCircle className="w-20 h-20 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.55)]" />
                                            : <HelpCircle className="w-20 h-20 text-amber-400" />}
                                        </div>
                                        <div>
                                            <h3 className={`text-2xl font-bold ${resultType === 'guru' ? 'text-green-500' : 'text-amber-400'}`}>{resultType === 'guru' ? 'JAWABAN BENAR!' : 'COBA LAGI!'}</h3>
                                            {!isPracticeMode && resultType === 'guru' && <p className={`${isDark ? 'text-white/70' : 'text-slate-600'} text-sm`}>Divalidasi oleh: {validationGuru?.nama}</p>}
                                            {!isPracticeMode && resultType === 'self' && <p className={`${isDark ? 'text-white/70' : 'text-slate-600'} text-sm`}>Belum mendapat poin</p>}
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

    </div>
    </>
  );
};

export default QuizHafalanPage;

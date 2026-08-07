import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import {
  ArrowLeft,
  Brush,
  Check,
  CheckCircle2,
  Link2,
  Moon,
  Search,
  Sparkles,
  Star,
  Sun,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  combineLetterHarakat,
  HARAKAT,
  HIJAIYAH_LETTERS,
  MODES,
  readLetterHarakat,
  REWARD_OPTIONS,
} from '@/data/hijaiyahData';

const HIJAIYAH_CONFIG_KEY = 'hijaiyah_game_config';

const shuffle = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const MODE_ICONS = {
  tracing: Brush,
  matching: Link2,
  finding: Search,
};

const TOTAL_ROUNDS = 5;

const HijaiyahGamePage = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, role } = useAuth();
  const isPracticeMode = role === 'santri';

  const [gameState, setGameState] = useState('home'); // home, pick_letters, pick_santri, playing, result
  const [activeMode, setActiveMode] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [selectedSantriId, setSelectedSantriId] = useState('');
  const [currentSantri, setCurrentSantri] = useState(null);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [config, setConfig] = useState({ modes: {} });

  const [letterPool, setLetterPool] = useState(HIJAIYAH_LETTERS);
  const [letterSearch, setLetterSearch] = useState('');
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundData, setRoundData] = useState(null);
  const [rewardAmount, setRewardAmount] = useState(null);
  const [isAwarding, setIsAwarding] = useState(false);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from('website_content')
      .select('content')
      .eq('key', HIJAIYAH_CONFIG_KEY)
      .maybeSingle();
    if (data?.content) setConfig(data.content);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsRosterLoading(true);
      await loadConfig();
      const { data: santriData, error } = await supabase
        .from('santri')
        .select('id, nama_lengkap, nama_panggilan, foto_url, avatar_path, jilid, points, status')
        .order('nama_lengkap', { ascending: true });
      if (!error) {
        setSantriList((santriData || []).filter((s) => s.status !== 'inactive'));
      }
      setIsRosterLoading(false);
    };
    load();
  }, [loadConfig]);

  useEffect(() => {
    if (isPracticeMode && user) {
      setCurrentSantri({
        id: user.id,
        nama_lengkap: user.nama_lengkap,
        nama_panggilan: user.nama_panggilan,
        foto_url: user.foto_url,
        avatar_path: user.avatar_path,
        jilid: user.jilid,
        points: user.points || 0,
      });
      setSelectedSantriId(String(user.id));
    }
  }, [isPracticeMode, user]);

  const modeEnabled = (modeId) => config.modes?.[modeId] !== false;

  const generateRound = (modeId) => {
    const pool = letterPool.length > 0 ? letterPool : HIJAIYAH_LETTERS;
    if (modeId === 'tracing') {
      const letter = pool[Math.floor(Math.random() * pool.length)];
      const harakat = HARAKAT[Math.floor(Math.random() * HARAKAT.length)];
      return { letter, harakat, reading: readLetterHarakat(letter.char, harakat) };
    }
    if (modeId === 'matching') {
      const target = pool[Math.floor(Math.random() * pool.length)];
      const decoys = shuffle(pool.filter((l) => l.char !== target.char)).slice(0, 2);
      const letterOptions = shuffle([target, ...decoys]);
      const targetHarakat = HARAKAT[Math.floor(Math.random() * HARAKAT.length)];
      const harakatOptions = shuffle([...HARAKAT]);
      return { target, targetHarakat, letterOptions, harakatOptions };
    }
    const target = pool[Math.floor(Math.random() * pool.length)];
    const decoys = shuffle(HIJAIYAH_LETTERS.filter((l) => l.char !== target.char)).slice(0, 14);
    return { target, decoys };
  };

  const startGame = (mode) => {
    setActiveMode(mode);
    setRoundIndex(0);
    setRewardAmount(null);
    setRoundData(generateRound(mode.id));
    setGameState('pick_letters');
  };

  const confirmLetters = () => {
    setRoundData(generateRound(activeMode.id));
    setGameState(isPracticeMode ? 'playing' : 'pick_santri');
  };

  const selectSantriAndStart = async () => {
    const selected = santriList.find((s) => String(s.id) === String(selectedSantriId));
    if (!selected) {
      toast({ title: 'Pilih Santri', description: 'Pilih satu santri terlebih dahulu.', variant: 'destructive' });
      return;
    }
    setIsPlayerLoading(true);
    const foto_url = await resolveAvatarUrl({
      ownerType: 'santri',
      ownerId: selected.id,
      avatarPath: selected.avatar_path,
      fallbackUrl: selected.foto_url,
    });
    setCurrentSantri({ ...selected, foto_url });
    setIsPlayerLoading(false);
    setGameState('playing');
  };

  const nextRound = () => {
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      setGameState('result');
      return;
    }
    setRoundIndex((prev) => prev + 1);
    setRoundData(generateRound(activeMode.id));
  };

  const awardReward = async (amount) => {
    if (!currentSantri) return;
    setIsAwarding(true);
    const newPoints = (Number(currentSantri.points) || 0) + amount;
    const { error: rpcError } = await supabase.rpc('increment_santri_points', {
      p_santri_id: currentSantri.id,
      p_amount: amount,
    });
    if (rpcError) {
      const { error: fallbackError } = await supabase
        .from('santri')
        .update({ points: newPoints })
        .eq('id', currentSantri.id);
      if (fallbackError) {
        toast({ title: 'Gagal Update Poin', description: fallbackError.message, variant: 'destructive' });
        setIsAwarding(false);
        return;
      }
    }
    setCurrentSantri((prev) => ({ ...prev, points: newPoints }));
    setRewardAmount(amount);
    setIsAwarding(false);
  };

  const resetGame = () => {
    setGameState('home');
    setActiveMode(null);
    setCurrentSantri(null);
    setRewardAmount(null);
    setRoundData(null);
    setLetterPool(HIJAIYAH_LETTERS);
  };

  const backTarget = isPracticeMode ? '/dashboard' : '/absensi-digital';

  const toggleLetter = (char) => {
    setLetterPool((prev) =>
      prev.some((l) => l.char === char)
        ? prev.filter((l) => l.char !== char)
        : [...prev, HIJAIYAH_LETTERS.find((l) => l.char === char)],
    );
  };

  const filteredLetters = useMemo(() => {
    const q = letterSearch.trim().toLowerCase();
    if (!q) return HIJAIYAH_LETTERS;
    return HIJAIYAH_LETTERS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.char === letterSearch.trim(),
    );
  }, [letterSearch]);

  return (
    <main className="hijaiyah-game min-h-screen w-full overflow-x-hidden">
      <Helmet>
        <title>Play Hijaiyah — LPQ Al-Muhajirun</title>
      </Helmet>

      <div className="hijaiyah-game__ambient" aria-hidden="true" />

      <header className="hijaiyah-game__topbar">
        <button type="button" className="hijaiyah-game__icon-btn" onClick={() => (gameState === 'home' ? navigate(backTarget) : resetGame())} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="hijaiyah-game__brand">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span>Play Hijaiyah</span>
        </div>
        <button type="button" className="hijaiyah-game__icon-btn" onClick={toggleTheme} aria-label="Ganti tema">
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <div className="hijaiyah-game__content">
        <AnimatePresence mode="wait">
          {gameState === 'home' && (
            <motion.section
              key="home"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.3 }}
              className="hijaiyah-game__home"
            >
              <div className="hijaiyah-game__hero">
                <h1>Belajar Huruf Hijaiyah</h1>
                <p>Pilih permainan, tantang dirimu, dan kumpulkan poin bersama guru.</p>
              </div>

              <div className="hijaiyah-game__mode-grid">
                {MODES.map((mode) => {
                  const Icon = MODE_ICONS[mode.id];
                  const enabled = modeEnabled(mode.id);
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={!enabled}
                      onClick={() => startGame(mode)}
                      className={`hijaiyah-game__mode-card ${enabled ? '' : 'hijaiyah-game__mode-card--disabled'}`}
                      style={{ '--mode-accent': mode.color }}
                    >
                      <span className="hijaiyah-game__mode-icon"><Icon className="h-6 w-6" /></span>
                      <span className="hijaiyah-game__mode-label">{mode.label}</span>
                      <span className="hijaiyah-game__mode-subtitle">{mode.subtitle}</span>
                      <span className="hijaiyah-game__mode-desc">{mode.description}</span>
                      {!enabled && <span className="hijaiyah-game__mode-lock">Dinonaktifkan</span>}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {gameState === 'pick_letters' && activeMode && (
            <motion.section
              key="letters"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.3 }}
              className="hijaiyah-game__letters"
            >
              <h2 className="hijaiyah-game__section-title">{activeMode.label} — Pilih Huruf</h2>
              <p className="hijaiyah-game__letters-hint">Guru memilih huruf yang ingin dimainkan. Bisa dicari berdasarkan nama huruf.</p>

              <div className="hijaiyah-game__letter-search">
                <Search className="h-4 w-4 hijaiyah-game__letter-search-icon" />
                <input
                  type="text"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="Cari nama huruf… (contoh: Ba, Sin, Nun)"
                  className="hijaiyah-game__letter-search-input"
                />
              </div>

              <div className="hijaiyah-game__letter-count">
                {letterPool.length} dari {HIJAIYAH_LETTERS.length} huruf dipilih
              </div>

              <div className="hijaiyah-game__letter-grid">
                {filteredLetters.map((letter) => {
                  const selected = letterPool.some((l) => l.char === letter.char);
                  return (
                    <button
                      key={letter.char}
                      type="button"
                      onClick={() => toggleLetter(letter.char)}
                      className={`hijaiyah-game__letter-cell ${selected ? 'hijaiyah-game__letter-cell--active' : ''}`}
                    >
                      <span className="hijaiyah-game__letter-cell-char">{letter.char}</span>
                      <span className="hijaiyah-game__letter-cell-name">{letter.name}</span>
                      {selected && <Check className="h-4 w-4 hijaiyah-game__letter-cell-check" />}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                size="lg"
                onClick={confirmLetters}
                disabled={letterPool.length === 0}
                className="hijaiyah-game__cta"
                style={{ background: activeMode.color }}
              >
                Lanjut — {letterPool.length} Huruf
              </Button>
            </motion.section>
          )}

          {gameState === 'pick_santri' && activeMode && (
            <motion.section
              key="pick"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.3 }}
              className="hijaiyah-game__roster"
            >
              <h2 className="hijaiyah-game__section-title">{activeMode.label} — Pilih Santri</h2>

              {isRosterLoading ? (
                <div className="hijaiyah-game__loading">Memuat daftar santri…</div>
              ) : (
                <div className="hijaiyah-game__santri-list">
                  {santriList.map((santri) => (
                    <button
                      key={santri.id}
                      type="button"
                      onClick={() => setSelectedSantriId(String(santri.id))}
                      className={`hijaiyah-game__santri-card ${selectedSantriId === String(santri.id) ? 'hijaiyah-game__santri-card--active' : ''}`}
                    >
                      <span className="hijaiyah-game__santri-avatar">
                        {santri.nama_lengkap?.charAt(0) || '?'}
                      </span>
                      <span className="hijaiyah-game__santri-info">
                        <strong>{santri.nama_lengkap}</strong>
                        <small>{santri.jilid ? `Jilid ${santri.jilid}` : 'Tanpa jilid'} · {santri.points || 0} poin</small>
                      </span>
                      {selectedSantriId === String(santri.id) && <Check className="h-5 w-5 hijaiyah-game__santri-check" />}
                    </button>
                  ))}
                  {santriList.length === 0 && <p className="hijaiyah-game__empty">Belum ada santri aktif.</p>}
                </div>
              )}

              <Button
                type="button"
                size="lg"
                onClick={selectSantriAndStart}
                disabled={!selectedSantriId || isPlayerLoading}
                className="hijaiyah-game__cta"
                style={{ background: activeMode.color }}
              >
                {isPlayerLoading ? 'Menyiapkan…' : 'Mulai Bermain'}
              </Button>
            </motion.section>
          )}

          {gameState === 'playing' && activeMode && currentSantri && (
            <motion.section
              key="playing"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.3 }}
              className="hijaiyah-game__playing"
            >
              <div className="hijaiyah-game__roundbar">
                <div>
                  <span className="hijaiyah-game__round-pill">{roundIndex + 1} / {TOTAL_ROUNDS}</span>
                  <strong>{activeMode.label}</strong>
                </div>
                <div className="hijaiyah-game__round-progress">
                  {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
                    <span key={i} className={i < roundIndex ? 'hijaiyah-game__round-progress-dot--filled' : ''} />
                  ))}
                </div>
              </div>

              <div className="hijaiyah-game__player-chip">
                <span>{currentSantri.nama_lengkap}</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeMode.id}-${roundIndex}`}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.25 }}
                >
                  {activeMode.id === 'tracing' && (
                    <TracingStage
                      letter={roundData.letter}
                      harakat={roundData.harakat}
                      reading={roundData.reading}
                      accent={activeMode.color}
                      onNext={nextRound}
                    />
                  )}
                  {activeMode.id === 'matching' && (
                    <MatchingStage
                      target={roundData.target}
                      targetHarakat={roundData.targetHarakat}
                      letterOptions={roundData.letterOptions}
                      harakatOptions={roundData.harakatOptions}
                      accent={activeMode.color}
                      onNext={nextRound}
                    />
                  )}
                  {activeMode.id === 'finding' && (
                    <FindingStage
                      target={roundData.target}
                      decoys={roundData.decoys}
                      accent={activeMode.color}
                      onNext={nextRound}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.section>
          )}

          {gameState === 'result' && activeMode && currentSantri && (
            <motion.section
              key="result"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="hijaiyah-game__result"
            >
              <span className="hijaiyah-game__result-icon" style={{ color: activeMode.color }}>
                <Sparkles className="h-10 w-10" />
              </span>
              <h2>Permainan Selesai!</h2>
              <p className="hijaiyah-game__result-name">{currentSantri.nama_lengkap} · {activeMode.label}</p>

              {rewardAmount !== null ? (
                <div className="hijaiyah-game__reward-given">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <p className="hijaiyah-game__reward-given-title">Berhasil!</p>
                  <p className="hijaiyah-game__reward-given-sub">+{rewardAmount} poin diberikan kepada {currentSantri.nama_lengkap}</p>
                </div>
              ) : isPracticeMode ? (
                <p className="hijaiyah-game__practice-note">Mode latihan — poin tidak ditambahkan.</p>
              ) : (
                <div className="hijaiyah-game__reward-box">
                  <p className="hijaiyah-game__reward-label">
                    <UserCheck className="h-4 w-4" /> Guru memberikan reward poin
                  </p>
                  <div className="hijaiyah-game__reward-options">
                    {REWARD_OPTIONS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={isAwarding}
                        onClick={() => awardReward(amount)}
                        className="hijaiyah-game__reward-btn"
                        style={{ '--mode-accent': activeMode.color }}
                      >
                        <Star className="h-6 w-6" />
                        <span className="hijaiyah-game__reward-amount">+{amount}</span>
                        <span className="hijaiyah-game__reward-unit">poin</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="hijaiyah-game__result-actions">
                <Button type="button" variant="outline" onClick={() => startGame(activeMode)}>
                  Main Lagi
                </Button>
                <Button type="button" variant="outline" onClick={resetGame}>
                  Pilih Mode Lain
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
};

const TracingStage = ({ letter, harakat, reading, accent, onNext }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startStroke = (event) => {
    event.preventDefault();
    const point = getPoint(event);
    if (!point) return;
    drawing.current = true;
    lastPoint.current = point;
    setHasStrokes(true);
  };

  const moveStroke = (event) => {
    event.preventDefault();
    if (!drawing.current) return;
    const point = getPoint(event);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!point || !ctx || !lastPoint.current) return;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(6, canvas.width / 60);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const endStroke = () => {
    drawing.current = false;
    lastPoint.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const confirmTrace = () => {
    setTimeout(onNext, 400);
  };

  const combined = combineLetterHarakat(letter.char, harakat.symbol);

  return (
    <div className="hijaiyah-game__tracing">
      <div className="hijaiyah-game__tracing-prompt">
        <span className="hijaiyah-game__tracing-reading">{combined}</span>
        <span className="hijaiyah-game__tracing-guide-text">{letter.name} · Harakat {harakat.name}</span>
        <span className="hijaiyah-game__tracing-hint">Guru membacakan: “{reading}” — tebalkan hurufnya di bawah ini</span>
      </div>
      <div className="hijaiyah-game__tracing-canvas-wrap">
        <div className="hijaiyah-game__tracing-guide" aria-hidden="true">
          <span className="hijaiyah-game__tracing-guide-letter">{combined}</span>
        </div>
        <canvas
          ref={canvasRef}
          className="hijaiyah-game__tracing-canvas"
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
      </div>
      <div className="hijaiyah-game__tracing-actions">
        <Button type="button" variant="outline" onClick={clearCanvas} disabled={!hasStrokes}>
          <X className="w-4 h-4 mr-1" /> Bersihkan
        </Button>
        <Button type="button" onClick={confirmTrace} disabled={!hasStrokes} style={{ background: accent }}>
          <Check className="w-4 h-4 mr-1" /> Selesai Menebalkan
        </Button>
      </div>
    </div>
  );
};

const MatchingStage = ({ target, targetHarakat, letterOptions, harakatOptions, accent, onNext }) => {
  const targetBoxRef = useRef(null);
  const [droppedLetter, setDroppedLetter] = useState(null);
  const [droppedHarakat, setDroppedHarakat] = useState(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [success, setSuccess] = useState(false);

  const isInside = (point, rect) =>
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

  const handleLetterDrop = (letter, event, info) => {
    const rect = targetBoxRef.current?.getBoundingClientRect();
    if (rect && isInside(info.point, rect)) {
      setDroppedLetter(letter);
    }
  };

  const handleHarakatDrop = (harakat, event, info) => {
    const rect = targetBoxRef.current?.getBoundingClientRect();
    if (rect && isInside(info.point, rect)) {
      setDroppedHarakat(harakat);
    }
  };

  useEffect(() => {
    if (!droppedLetter || !droppedHarakat) return;
    const letterOk = droppedLetter.char === target.char;
    const harakatOk = droppedHarakat.id === targetHarakat.id;
    if (letterOk && harakatOk) {
      setSuccess(true);
      setTimeout(onNext, 900);
    } else {
      setWrongFlash(true);
      setTimeout(() => {
        setWrongFlash(false);
        setDroppedLetter(null);
        setDroppedHarakat(null);
      }, 700);
    }
  }, [droppedLetter, droppedHarakat, target, targetHarakat, onNext]);

  const targetReading = combineLetterHarakat(target.char, targetHarakat.symbol);

  return (
    <div className="hijaiyah-game__matching">
      <p className="hijaiyah-game__stage-prompt">
        Guru menyebutkan: <strong className="hijaiyah-game__matching-target">{targetReading}</strong>
        <span className="hijaiyah-game__matching-target-name"> ({target.name} — {targetHarakat.name})</span>
      </p>

      <div className="hijaiyah-game__matching-target-box" ref={targetBoxRef}>
        <span className="hijaiyah-game__matching-slot-label">Seret huruf & harakat ke sini</span>
        <div className="hijaiyah-game__matching-drop-area">
          <span className="hijaiyah-game__matching-dropped">
            {droppedLetter ? droppedLetter.char : '_'}
          </span>
          <span className="hijaiyah-game__matching-dropped-symbol">
            {droppedHarakat ? droppedHarakat.symbol : ''}
          </span>
        </div>
      </div>

      <div className="hijaiyah-game__matching-tray">
        <p className="hijaiyah-game__matching-tray-label">Huruf</p>
        <div className="hijaiyah-game__matching-pieces">
          {letterOptions.map((letter) => (
            <motion.button
              key={letter.char}
              type="button"
              drag
              dragSnapToOrigin
              dragMomentum={false}
              whileDrag={{ scale: 1.15, zIndex: 20 }}
              onDragEnd={(event, info) => handleLetterDrop(letter, event, info)}
              className="hijaiyah-game__matching-piece"
              style={{ '--mode-accent': accent }}
            >
              {letter.char}
            </motion.button>
          ))}
        </div>
        <p className="hijaiyah-game__matching-tray-label">Harakat</p>
        <div className="hijaiyah-game__matching-pieces">
          {harakatOptions.map((harakat) => (
            <motion.button
              key={harakat.id}
              type="button"
              drag
              dragSnapToOrigin
              dragMomentum={false}
              whileDrag={{ scale: 1.15, zIndex: 20 }}
              onDragEnd={(event, info) => handleHarakatDrop(harakat, event, info)}
              className="hijaiyah-game__matching-piece hijaiyah-game__matching-piece--harakat"
              style={{ '--mode-accent': accent }}
            >
              {harakat.symbol}
              <span>{harakat.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {wrongFlash && (
        <p className="hijaiyah-game__stage-feedback hijaiyah-game__stage-feedback--wrong">
          <XCircle className="h-4 w-4 inline mr-1" /> Belum tepat, coba lagi.
        </p>
      )}
      {success && (
        <p className="hijaiyah-game__stage-feedback">
          <CheckCircle2 className="h-4 w-4 inline mr-1" /> Benar! {targetReading} dibaca {target.name} {targetHarakat.name}.
        </p>
      )}
    </div>
  );
};

const FindingStage = ({ target, decoys, accent, onNext }) => {
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState(null);
  const [success, setSuccess] = useState(false);

  const positions = useMemo(() => {
    const all = shuffle([target, ...decoys]);
    return all.map((letter, i) => ({
      letter,
      left: 4 + ((i * 37) % 88),
      top: 12 + ((i * 53) % 66),
      rotate: ((i * 23) % 50) - 25,
      scale: 0.8 + ((i * 7) % 4) * 0.12,
    }));
  }, [target, decoys]);

  const revealTarget = () => {
    setRevealed(true);
    setTimeout(() => setRevealed(false), 3000);
  };

  const handlePick = (letter) => {
    if (picked !== null || success) return;
    setPicked(letter.char);
    if (letter.char === target.char) {
      setSuccess(true);
      setTimeout(onNext, 900);
    } else {
      setTimeout(() => setPicked(null), 700);
    }
  };

  return (
    <div className="hijaiyah-game__finding">
      <div className="hijaiyah-game__finding-topbar">
        <p className="hijaiyah-game__stage-prompt">
          Guru mengucapkan sebuah huruf — <strong>carilah huruf itu di dalam gambar!</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={revealTarget}
          disabled={revealed}
          className="hijaiyah-game__finding-reveal"
        >
          {revealed ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Ingat hurufnya…</> : <>Baca huruf (guru)</>}
        </Button>
      </div>

      {revealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hijaiyah-game__finding-reveal-card"
        >
          <span className="hijaiyah-game__finding-reveal-char">{target.char}</span>
          <span className="hijaiyah-game__finding-reveal-name">{target.name}</span>
        </motion.div>
      )}

      <div className="hijaiyah-game__find-scene">
        <div className="hijaiyah-game__find-sky" aria-hidden="true" />
        <div className="hijaiyah-game__find-sun" aria-hidden="true" />
        <div className="hijaiyah-game__find-cloud hijaiyah-game__find-cloud--1" aria-hidden="true" />
        <div className="hijaiyah-game__find-cloud hijaiyah-game__find-cloud--2" aria-hidden="true" />
        <div className="hijaiyah-game__find-hill hijaiyah-game__find-hill--back" aria-hidden="true" />
        <div className="hijaiyah-game__find-hill hijaiyah-game__find-hill--front" aria-hidden="true" />
        {positions.map(({ letter, left, top, rotate, scale }, index) => (
          <button
            key={`${letter.char}-${index}`}
            type="button"
            onClick={() => handlePick(letter)}
            className={`hijaiyah-game__find-scene-letter ${
              picked === letter.char && letter.char !== target.char ? 'hijaiyah-game__find-scene-letter--wrong' : ''
            } ${success && letter.char === target.char ? 'hijaiyah-game__find-scene-letter--correct' : ''}`}
            style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${rotate}deg) scale(${scale})` }}
          >
            {letter.char}
          </button>
        ))}
      </div>

      {picked !== null && picked !== target.char && !success && (
        <p className="hijaiyah-game__stage-feedback hijaiyah-game__stage-feedback--wrong">
          <XCircle className="h-4 w-4 inline mr-1" /> Bukan itu, cari lagi.
        </p>
      )}
      {success && (
        <p className="hijaiyah-game__stage-feedback">
          <CheckCircle2 className="h-4 w-4 inline mr-1" /> Tepat! Kamu menemukan huruf {target.name} ({target.char}).
        </p>
      )}
    </div>
  );
};

export default HijaiyahGamePage;

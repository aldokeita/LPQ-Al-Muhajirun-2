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
  Gamepad2,
  Grid3X3,
  Link2,
  Moon,
  Pencil,
  Search,
  Sparkles,
  Star,
  Sun,
  Trophy,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  HARAKAT,
  HARAKAT_READING,
  HIJAIYAH_LETTERS,
  JILID_OPTIONS,
  MODES,
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

const MODE_ACCENT = {
  tracing: 'var(--hijaiyah-emerald, #10b981)',
  matching: 'var(--hijaiyah-violet, #8b5cf6)',
  finding: 'var(--hijaiyah-amber, #f59e0b)',
};

const TOTAL_ROUNDS = 5;

const HijaiyahGamePage = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, role } = useAuth();
  const isPracticeMode = role === 'santri';

  const [gameState, setGameState] = useState('home'); // home, pick_santri, playing, result
  const [activeMode, setActiveMode] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [selectedSantriId, setSelectedSantriId] = useState('');
  const [currentSantri, setCurrentSantri] = useState(null);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [config, setConfig] = useState({ modes: {}, jilid: '1' });
  const [jilid, setJilid] = useState('1');

  const [roundIndex, setRoundIndex] = useState(0);
  const [roundData, setRoundData] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [validationGuru, setValidationGuru] = useState(null);
  const [resultType, setResultType] = useState('self');

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from('website_content')
      .select('content')
      .eq('key', HIJAIYAH_CONFIG_KEY)
      .maybeSingle();
    if (data?.content) {
      setConfig(data.content);
      if (data.content.jilid) setJilid(data.content.jilid);
    }
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

  const modeEnabled = (modeId) => {
    const modeConfig = config.modes?.[modeId];
    return modeConfig !== false;
  };

  const enabledModes = useMemo(
    () => MODES.filter((mode) => modeEnabled(mode.id)),
    [config.modes],
  );

  const generateRound = (modeId) => {
    if (modeId === 'tracing') {
      const letter = HIJAIYAH_LETTERS[Math.floor(Math.random() * HIJAIYAH_LETTERS.length)];
      const harakat = HARAKAT[Math.floor(Math.random() * HARAKAT.length)];
      return { letter, harakat, reading: HARAKAT_READING[harakat.id](letter.char) };
    }
    if (modeId === 'matching') {
      const letter = HIJAIYAH_LETTERS[Math.floor(Math.random() * HIJAIYAH_LETTERS.length)];
      const correct = HARAKAT[Math.floor(Math.random() * HARAKAT.length)];
      const options = shuffle([...HARAKAT]);
      return { letter, correct, options };
    }
    const letter = HIJAIYAH_LETTERS[Math.floor(Math.random() * HIJAIYAH_LETTERS.length)];
    const grid = shuffle([...HIJAIYAH_LETTERS]).slice(0, 9);
    if (!grid.some((l) => l.char === letter.char)) grid[Math.floor(Math.random() * grid.length)] = letter;
    return { letter, grid: shuffle(grid) };
  };

  const startGame = (mode) => {
    setActiveMode(mode);
    setRoundIndex(0);
    setCorrectCount(0);
    setValidationGuru(null);
    setResultType('self');
    setRoundData(generateRound(mode.id));
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

  const handleAnswer = async (isCorrect) => {
    if (isCorrect) setCorrectCount((prev) => prev + 1);
    setValidationGuru({ nama: user?.nama || user?.nama_lengkap || 'Guru' });
    setResultType('guru');
  };

  const awardPoints = async () => {
    if (!currentSantri) return;
    const points = activeMode.pointsPerRound * correctCount;
    if (points <= 0) {
      setGameState('result');
      return;
    }
    const newPoints = (Number(currentSantri.points) || 0) + points;
    const { error: rpcError } = await supabase.rpc('increment_santri_points', {
      p_santri_id: currentSantri.id,
      p_amount: points,
    });
    if (rpcError) {
      const { error: fallbackError } = await supabase
        .from('santri')
        .update({ points: newPoints })
        .eq('id', currentSantri.id);
      if (fallbackError) {
        toast({ title: 'Gagal Update Poin', description: fallbackError.message, variant: 'destructive' });
        return;
      }
    }
    setCurrentSantri((prev) => ({ ...prev, points: newPoints }));
  };

  const resetGame = () => {
    setGameState('home');
    setActiveMode(null);
    setCurrentSantri(null);
    setValidationGuru(null);
    setRoundData(null);
  };

  const backTarget = isPracticeMode ? '/dashboard' : '/absensi-digital';

  const totalPoints = activeMode ? activeMode.pointsPerRound * correctCount : 0;

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
                      <span className="hijaiyah-game__mode-points">
                        <Star className="h-3.5 w-3.5" /> +{mode.pointsPerRound} poin per jawaban benar
                      </span>
                      {!enabled && <span className="hijaiyah-game__mode-lock">Dinonaktifkan</span>}
                    </button>
                  );
                })}
              </div>
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
              <div className="hijaiyah-game__jilid-row">
                {JILID_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setJilid(opt.value)}
                    className={`hijaiyah-game__jilid-chip ${jilid === opt.value ? 'hijaiyah-game__jilid-chip--active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

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
                <small><Star className="h-3 w-3" /> {currentSantri.points || 0}</small>
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
                      letter={roundData.letter}
                      correct={roundData.correct}
                      options={roundData.options}
                      accent={activeMode.color}
                      onAnswer={(isCorrect) => {
                        handleAnswer(isCorrect);
                        setTimeout(nextRound, 400);
                      }}
                    />
                  )}
                  {activeMode.id === 'finding' && (
                    <FindingStage
                      letter={roundData.letter}
                      grid={roundData.grid}
                      accent={activeMode.color}
                      onAnswer={(isCorrect) => {
                        handleAnswer(isCorrect);
                        setTimeout(nextRound, 400);
                      }}
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
                <Trophy className="h-10 w-10" />
              </span>
              <h2>Permainan Selesai!</h2>
              <p className="hijaiyah-game__result-name">{currentSantri.nama_lengkap}</p>

              <div className="hijaiyah-game__result-stats">
                <div><span>{correctCount}</span><small>Jawaban Benar</small></div>
                <div><span>{TOTAL_ROUNDS - correctCount}</span><small>Belum Tepat</small></div>
                <div><span>+{totalPoints}</span><small>Poin</small></div>
              </div>

              {resultType === 'guru' && validationGuru ? (
                <p className="hijaiyah-game__result-validated">
                  <UserCheck className="h-4 w-4" /> Divalidasi oleh {validationGuru.nama}
                </p>
              ) : (
                <p className="hijaiyah-game__result-validated">
                  <UserCheck className="h-4 w-4" /> Menunggu persetujuan guru
                </p>
              )}

              {!isPracticeMode && resultType === 'self' && (
                <Button
                  type="button"
                  size="lg"
                  onClick={awardPoints}
                  className="hijaiyah-game__cta"
                  style={{ background: activeMode.color }}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Setujui & Tambah {totalPoints} Poin
                </Button>
              )}

              {isPracticeMode && (
                <p className="hijaiyah-game__practice-note">Mode latihan — poin tidak ditambahkan.</p>
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
  const [confirmed, setConfirmed] = useState(false);

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
    setConfirmed(false);
  };

  const confirmTrace = () => {
    setConfirmed(true);
    setTimeout(onNext, 500);
  };

  return (
    <div className="hijaiyah-game__tracing">
      <div className="hijaiyah-game__tracing-prompt">
        <span className="hijaiyah-game__tracing-reading">{reading}</span>
        <span className="hijaiyah-game__tracing-hint">Tebalkan huruf {letter.name} dengan harakat {harakat.name.toLowerCase()} di bawah ini</span>
      </div>
      <div className="hijaiyah-game__tracing-canvas-wrap">
        <div className="hijaiyah-game__tracing-guide" aria-hidden="true">
          <span className="hijaiyah-game__tracing-guide-letter">{letter.char}</span>
          <span className="hijaiyah-game__tracing-guide-harakat">{harakat.symbol}</span>
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
        <Button type="button" variant="outline" onClick={clearCanvas} disabled={!hasStrokes && !confirmed}>
          <X className="w-4 h-4 mr-1" /> Bersihkan
        </Button>
        <Button type="button" onClick={confirmTrace} disabled={!hasStrokes} style={{ background: accent }}>
          <Check className="w-4 h-4 mr-1" /> Selesai Menebalkan
        </Button>
      </div>
    </div>
  );
};

const MatchingStage = ({ letter, correct, options, accent, onAnswer }) => {
  const [picked, setPicked] = useState(null);
  const handlePick = (harakat) => {
    if (picked !== null) return;
    setPicked(harakat.id);
    onAnswer(harakat.id === correct.id);
  };
  return (
    <div className="hijaiyah-game__matching">
      <p className="hijaiyah-game__stage-prompt">
        Huruf <strong>{letter.name}</strong> — pilih harakat yang tepat untuk membacanya
      </p>
      <div className="hijaiyah-game__matching-letter">
        <span className="hijaiyah-game__matching-letter-char">{letter.char}</span>
        <span className="hijaiyah-game__matching-letter-symbol">{picked ? HARAKAT.find((h) => h.id === picked)?.symbol : ''}</span>
      </div>
      <div className="hijaiyah-game__matching-options">
        {options.map((harakat) => {
          const isPicked = picked === harakat.id;
          const isCorrect = picked !== null && harakat.id === correct.id;
          const isWrongPick = isPicked && !isCorrect;
          return (
            <button
              key={harakat.id}
              type="button"
              onClick={() => handlePick(harakat)}
              disabled={picked !== null}
              className={`hijaiyah-game__match-option ${isCorrect ? 'hijaiyah-game__match-option--correct' : ''} ${isWrongPick ? 'hijaiyah-game__match-option--wrong' : ''}`}
              style={{ '--mode-accent': accent }}
            >
              <span className="hijaiyah-game__match-symbol">{harakat.symbol}</span>
              <span>{harakat.name}</span>
              <small>{harakat.sound}</small>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="hijaiyah-game__stage-feedback">
          {picked === correct.id ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
          {picked === correct.id ? `Benar! ${letter.char} dibaca ${HARAKAT_READING[correct.id](letter.char)}` : `Belum tepat. ${letter.char} dibaca ${HARAKAT_READING[correct.id](letter.char)}`}
        </p>
      )}
    </div>
  );
};

const FindingStage = ({ letter, grid, accent, onAnswer }) => {
  const [picked, setPicked] = useState(null);
  const handlePick = (char) => {
    if (picked !== null) return;
    setPicked(char);
    onAnswer(char === letter.char);
  };
  return (
    <div className="hijaiyah-game__finding">
      <p className="hijaiyah-game__stage-prompt">
        Temukan huruf <strong className="hijaiyah-game__finding-target">{letter.char}</strong> <span>({letter.name})</span>
      </p>
      <div className="hijaiyah-game__finding-grid">
        {grid.map((l, i) => {
          const isPicked = picked === l.char;
          const isCorrect = picked !== null && l.char === letter.char;
          const isWrongPick = isPicked && !isCorrect;
          return (
            <button
              key={`${l.char}-${i}`}
              type="button"
              onClick={() => handlePick(l.char)}
              disabled={picked !== null}
              className={`hijaiyah-game__find-cell ${isCorrect ? 'hijaiyah-game__find-cell--correct' : ''} ${isWrongPick ? 'hijaiyah-game__find-cell--wrong' : ''}`}
              style={{ '--mode-accent': accent }}
            >
              {l.char}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="hijaiyah-game__stage-feedback">
          {picked === letter.char ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
          {picked === letter.char ? `Benar! Ini huruf ${letter.name}.` : `Belum tepat. Yang dicari adalah huruf ${letter.name} (${letter.char}).`}
        </p>
      )}
    </div>
  );
};

export default HijaiyahGamePage;

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
  Eraser,
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

const usePinchZoom = (min = 0.6, max = 3) => {
  const [zoom, setZoom] = useState(1);
  const pointersRef = useRef(new Map());
  const lastDistRef = useRef(null);

  const onPointerDown = (e) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      lastDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && lastDistRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / lastDistRef.current;
      setZoom((z) => Math.min(max, Math.max(min, +(z * ratio).toFixed(2))));
      lastDistRef.current = dist;
    }
  };

  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) lastDistRef.current = null;
  };

  const zoomIn = () => setZoom((z) => Math.min(max, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(min, +(z - 0.2).toFixed(2)));

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    pinchHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
};


const MODE_ICONS = {
  tracing: Brush,
  matching: Link2,
  colorMatch: Sparkles,
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
    const [configRes, bgRes] = await Promise.all([
      supabase.from('website_content').select('content').eq('key', HIJAIYAH_CONFIG_KEY).maybeSingle(),
      supabase.from('website_content').select('content').eq('key', 'hijaiyahFindingBackgroundUrl').maybeSingle(),
    ]);
    if (configRes.data?.content) setConfig(configRes.data.content);
    if (bgRes.data?.content) setConfig((prev) => ({ ...prev, backgroundUrl: bgRes.data.content }));
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
        const active = (santriData || []).filter((s) => s.status !== 'inactive');
        const resolved = await Promise.all(active.map(async (s) => ({
          ...s,
          foto_url: await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: s.id,
            avatarPath: s.avatar_path,
            fallbackUrl: s.foto_url,
          }).catch(() => s.foto_url || ''),
        })));
        setSantriList(resolved);
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
    if (modeId === 'colorMatch') {
      const letters = shuffle(pool).slice(0, 3);
      const shuffledHarakat = shuffle([...HARAKAT]);
      const pairColors = shuffle(['#dc2626', '#2563eb', '#ea580c', '#7c3aed', '#0d9488', '#c026d3']).slice(0, 3);
      const pairs = letters.map((letter, i) => ({ letter, harakat: shuffledHarakat[i], color: pairColors[i] }));
      return { pairs };
    }
    const targetCount = roundIndex >= 4 ? 3 : roundIndex >= 2 ? 2 : 1;
    const targets = shuffle(pool).slice(0, targetCount);
    const poolSet = new Set(pool.map((l) => l.char));
    const decoys = shuffle(HIJAIYAH_LETTERS.filter((l) => !targets.some((t) => t.char === l.char) && poolSet.has(l.char))).slice(0, 18);
    const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#c026d3', '#db2777'];
    const all = shuffle([...targets.map((t) => ({ ...t, isTarget: true })), ...decoys.map((d) => ({ ...d, isTarget: false }))]);
    const scatter = all.map((item, i) => ({
      ...item,
      left: 4 + ((i * 37) % 88),
      top: 14 + ((i * 53) % 62),
      rotate: ((i * 23) % 50) - 25,
      scale: 0.8 + ((i * 7) % 4) * 0.14,
      color: colors[i % colors.length],
      harakat: HARAKAT[i % HARAKAT.length],
      harakatColor: colors[(i + 3) % colors.length],
    }));
    return { targets, scatter };
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

  const backTarget = '/dashboard';

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

              <div className="hijaiyah-game__letter-actions">
                <span className="hijaiyah-game__letter-count">
                  {letterPool.length} dari {HIJAIYAH_LETTERS.length} huruf dipilih
                </span>
                <div className="hijaiyah-game__letter-actions-btns">
                  <button type="button" className="hijaiyah-game__letter-action-btn" onClick={() => setLetterPool(HIJAIYAH_LETTERS)}>
                    Pilih Semua
                  </button>
                  <button type="button" className="hijaiyah-game__letter-action-btn hijaiyah-game__letter-action-btn--clear" onClick={() => setLetterPool([])}>
                    Hapus Semua
                  </button>
                </div>
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
                        {santri.foto_url ? <img src={santri.foto_url} alt={santri.nama_lengkap} className="hijaiyah-game__santri-avatar-img" /> : (santri.nama_lengkap?.charAt(0) || '?')}
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
                  {activeMode.id === 'colorMatch' && (
                    <ColorMatchStage
                      pairs={roundData.pairs}
                      accent={activeMode.color}
                      onNext={nextRound}
                    />
                  )}
                  {activeMode.id === 'finding' && (
                    <FindingStage
                      targets={roundData.targets}
                      scatter={roundData.scatter}
                      accent={activeMode.color}
                      backgroundUrl={config.backgroundUrl || ''}
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

const STROKE_COLORS = ['#10b981', '#2563eb', '#dc2626', '#ea580c', '#7c3aed', '#0f172a'];

const TracingStage = ({ letter, harakat, reading, accent, onNext }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [strokeColor, setStrokeColor] = useState(accent);
  const [isEraser, setIsEraser] = useState(false);
  const [brushWidth, setBrushWidth] = useState(12);
  const [zoom, setZoom] = useState(1);

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
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : strokeColor;
    ctx.lineWidth = brushWidth * (isEraser ? 1.6 : 1);
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
  const readingSize = String(1.6 + (zoom - 1) * 1.2) + 'rem';
  const guideScale = String(zoom);

  return (
    <div className="hijaiyah-game__tracing">
      <div className="hijaiyah-game__tracing-prompt">
        <span className="hijaiyah-game__tracing-reading" style={{ fontSize: readingSize }}>{combined}</span>
        <span className="hijaiyah-game__tracing-guide-text">{letter.name} · Harakat {harakat.name}</span>
        <span className="hijaiyah-game__tracing-hint">Guru membacakan: “{reading}” — tebalkan hurufnya di bawah ini</span>
      </div>

      <div className="hijaiyah-game__tracing-toolbar">
        <div className="hijaiyah-game__tracing-colors">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={'Pilih warna ' + color}
              onClick={() => { setStrokeColor(color); setIsEraser(false); }}
              className={'hijaiyah-game__tracing-swatch ' + (!isEraser && strokeColor === color ? 'hijaiyah-game__tracing-swatch--active' : '')}
              style={{ background: color }}
            />
          ))}
          <button
            type="button"
            aria-label="Penghapus"
            onClick={() => setIsEraser((prev) => !prev)}
            className={'hijaiyah-game__tracing-eraser ' + (isEraser ? 'hijaiyah-game__tracing-eraser--active' : '')}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
        <div className="hijaiyah-game__tracing-zoom">
          <button type="button" aria-label="Perkecil" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))} className="hijaiyah-game__tracing-zoom-btn">−</button>
          <span className="hijaiyah-game__tracing-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Perbesar" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))} className="hijaiyah-game__tracing-zoom-btn">+</button>
        </div>
      </div>

      <div className="hijaiyah-game__tracing-widthbar">
        <label htmlFor="tracing-brush-width" className="hijaiyah-game__tracing-widthlabel">
          {isEraser ? 'Penghapus' : 'Pena'} — Ketebalan
        </label>
        <input
          id="tracing-brush-width"
          type="range"
          min="4"
          max="32"
          step="1"
          value={brushWidth}
          onChange={(e) => setBrushWidth(Number(e.target.value))}
          className="hijaiyah-game__tracing-widthslider"
        />
        <span className="hijaiyah-game__tracing-widthvalue">{brushWidth}px</span>
      </div>

      <div className="hijaiyah-game__tracing-canvas-wrap">
        <div className="hijaiyah-game__tracing-guide" aria-hidden="true" style={{ transform: 'scale(' + guideScale + ')' }}>
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
  const canvasRef = useRef(null);
  const { zoom, setZoom, zoomIn, zoomOut, pinchHandlers } = usePinchZoom();
  const [placed, setPlaced] = useState([]);
  const [usedKeys, setUsedKeys] = useState(() => new Set());
  const [wrongFlash, setWrongFlash] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isInside = (point, rect) =>
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

  const addToCanvas = (kind, value, point, rect) => {
    const x = (point.x - rect.left) / zoom;
    const y = (point.y - rect.top) / zoom;
    const key = kind === 'letter' ? `letter:${value.char}` : `harakat:${value.id}`;
    if (usedKeys.has(key)) return;
    setUsedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setPlaced((prev) => [...prev, { id: `${kind}-${Date.now()}-${Math.random()}`, kind, value, x, y }]);
  };

  const handleTrayDragStart = (event, info) => {
    setIsDragging(true);
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = {
      x: info.point.x - (rect.left + rect.width / 2),
      y: info.point.y - (rect.top + rect.height / 2),
    };
  };

  const handleLetterDrop = (letter, event, info) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const dropPoint = {
      x: info.point.x - dragOffsetRef.current.x,
      y: info.point.y - dragOffsetRef.current.y,
    };
    if (rect && isInside(dropPoint, rect)) addToCanvas('letter', letter, dropPoint, rect);
    setIsDragging(false);
  };

  const handleHarakatDrop = (harakat, event, info) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const dropPoint = {
      x: info.point.x - dragOffsetRef.current.x,
      y: info.point.y - dragOffsetRef.current.y,
    };
    if (rect && isInside(dropPoint, rect)) addToCanvas('harakat', harakat, dropPoint, rect);
    setIsDragging(false);
  };

  const removePlaced = (id) => {
    const item = placed.find((p) => p.id === id);
    if (!item) return;
    const key = item.kind === 'letter' ? `letter:${item.value.char}` : `harakat:${item.value.id}`;
    setUsedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setPlaced((prev) => prev.filter((p) => p.id !== id));
  };

  const checkAnswer = () => {
    const hasLetter = placed.some((p) => p.kind === 'letter' && p.value.char === target.char);
    const hasHarakat = placed.some((p) => p.kind === 'harakat' && p.value.id === targetHarakat.id);
    if (hasLetter && hasHarakat) {
      setSuccess(true);
      setTimeout(onNext, 1000);
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 900);
    }
  };

  const targetReading = combineLetterHarakat(target.char, targetHarakat.symbol);

  const canvasStyle = {
    transform: `scale(${zoom})`,
  };

  return (
    <div className="hijaiyah-game__matching">
      <p className="hijaiyah-game__stage-prompt">
        Guru menyebutkan: <strong className="hijaiyah-game__matching-target">{targetReading}</strong>
        <span className="hijaiyah-game__matching-target-name"> ({target.name} — {targetHarakat.name})</span>
      </p>
      <p className="hijaiyah-game__matching-hint">Seret huruf dan harakat ke area canvas. Setiap huruf/harakat hanya bisa dipakai sekali — gunakan zoom untuk memperbesar.</p>

      <div className="hijaiyah-game__canvas-tools">
        <span className="hijaiyah-game__canvas-tools-label">{Math.round(zoom * 100)}%</span>
        <div className="hijaiyah-game__tracing-zoom">
          <button type="button" aria-label="Perkecil" onClick={zoomOut} className="hijaiyah-game__tracing-zoom-btn">−</button>
          <button type="button" aria-label="Perbesar" onClick={zoomIn} className="hijaiyah-game__tracing-zoom-btn">+</button>
          <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} className="hijaiyah-game__tracing-zoom-btn">⟲</button>
        </div>
      </div>

      <div
        className={`hijaiyah-game__matching-canvas ${isDragging ? 'hijaiyah-game__matching-canvas--active' : ''}`}
        ref={canvasRef}
        style={canvasStyle}
        {...pinchHandlers}
      >
        {placed.map((item) => (
          <motion.div
            key={item.id}
            className={`hijaiyah-game__matching-canvas-item ${item.kind === 'harakat' ? 'hijaiyah-game__matching-canvas-item--harakat' : ''}`}
            style={{ left: item.x, top: item.y, '--mode-accent': accent }}
            drag
            dragMomentum={false}
            dragElastic={0}
            whileDrag={{ scale: 1.12, zIndex: 30, cursor: 'grabbing' }}
          >
            {item.kind === 'letter' ? item.value.char : <span className="hijaiyah-game__harakat-preview">{item.value.preview}</span>}
            <button type="button" className="hijaiyah-game__matching-canvas-remove" onClick={() => removePlaced(item.id)} aria-label="Hapus"><X className="h-3 w-3" /></button>
          </motion.div>
        ))}
      </div>

      <div className="hijaiyah-game__matching-tray">
        <p className="hijaiyah-game__matching-tray-label">Huruf</p>
        <div className="hijaiyah-game__matching-pieces">
          {letterOptions.map((letter) => {
            const used = usedKeys.has(`letter:${letter.char}`);
            return (
              <motion.button
                key={letter.char}
                type="button"
                drag
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0}
                whileDrag={{ scale: 1.15, zIndex: 20, cursor: 'grabbing' }}
                onDragStart={handleTrayDragStart}
                onDragEnd={(event, info) => handleLetterDrop(letter, event, info)}
                className={`hijaiyah-game__matching-piece ${used ? 'hijaiyah-game__matching-piece--used' : ''}`}
                style={{ '--mode-accent': accent }}
                aria-disabled={used}
              >
                {letter.char}
              </motion.button>
            );
          })}
        </div>
        <p className="hijaiyah-game__matching-tray-label">Harakat</p>
        <div className="hijaiyah-game__matching-pieces">
          {harakatOptions.map((harakat) => {
            const used = usedKeys.has(`harakat:${harakat.id}`);
            return (
              <motion.button
                key={harakat.id}
                type="button"
                drag
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0}
                whileDrag={{ scale: 1.15, zIndex: 20, cursor: 'grabbing' }}
                onDragStart={handleTrayDragStart}
                onDragEnd={(event, info) => handleHarakatDrop(harakat, event, info)}
                className={`hijaiyah-game__matching-piece hijaiyah-game__matching-piece--harakat ${used ? 'hijaiyah-game__matching-piece--used' : ''}`}
                style={{ '--mode-accent': accent }}
                aria-disabled={used}
              >
                <span className="hijaiyah-game__harakat-preview">{harakat.preview}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="hijaiyah-game__matching-actions">
        <Button type="button" variant="outline" onClick={() => { setPlaced([]); setUsedKeys(new Set()); }} disabled={placed.length === 0}>
          <X className="w-4 h-4 mr-1" /> Kosongkan
        </Button>
        <Button type="button" onClick={checkAnswer} disabled={placed.length === 0} style={{ background: accent }}>
          <Check className="w-4 h-4 mr-1" /> Periksa Jawaban
        </Button>
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


const FindingStage = ({ targets, scatter, accent, backgroundUrl, onNext }) => {
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState([]);
  const [success, setSuccess] = useState(false);

  const revealTarget = () => {
    setRevealed(true);
    setTimeout(() => setRevealed(false), 3200);
  };

  const handlePick = (item) => {
    if (success) return;
    const alreadyPicked = picked.some((p) => p.char === item.char);
    if (alreadyPicked) return;
    if (item.isTarget) {
      const next = [...picked, item];
      setPicked(next);
      if (next.length >= targets.length) {
        setSuccess(true);
        setTimeout(onNext, 1000);
      }
    } else {
      setPicked((prev) => [...prev, { ...item, isWrong: true }]);
      setTimeout(() => setPicked((prev) => prev.filter((p) => p.char !== item.char)), 700);
    }
  };

  const remaining = Math.max(0, targets.length - picked.filter((p) => !p.isWrong).length);

  return (
    <div className="hijaiyah-game__finding">
      <div className="hijaiyah-game__finding-topbar">
        <p className="hijaiyah-game__stage-prompt">
          Guru mengucapkan <strong>{targets.length} huruf</strong> — <strong>carilah semua huruf itu di dalam gambar!</strong>
        </p>
        <div className="hijaiyah-game__finding-targets">
          {targets.map((t, i) => (
            <span key={t.char} className={`hijaiyah-game__finding-target-chip ${picked.some((p) => p.char === t.char) ? 'hijaiyah-game__finding-target-chip--found' : ''}`}>
              <span className="hijaiyah-game__finding-target-char">{t.char}</span>
              <small>{t.name}</small>
            </span>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={revealTarget} disabled={revealed} className="hijaiyah-game__finding-reveal">
          {revealed ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Ingat hurufnya…</> : <>Baca huruf (guru)</>}
        </Button>
        <span className="hijaiyah-game__finding-remaining">Sisa dicari: {remaining}</span>
      </div>

      {revealed && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="hijaiyah-game__finding-reveal-card">
          <span className="hijaiyah-game__finding-reveal-chars">
            {targets.map((t) => <span key={t.char} className="hijaiyah-game__finding-reveal-char">{t.char}</span>)}
          </span>
        </motion.div>
      )}

      <div className="hijaiyah-game__find-scene" style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!backgroundUrl && <><div className="hijaiyah-game__find-sky" aria-hidden="true" />
        <div className="hijaiyah-game__find-sun" aria-hidden="true" />
        <div className="hijaiyah-game__find-cloud hijaiyah-game__find-cloud--1" aria-hidden="true" />
        <div className="hijaiyah-game__find-cloud hijaiyah-game__find-cloud--2" aria-hidden="true" />
        <div className="hijaiyah-game__find-hill hijaiyah-game__find-hill--back" aria-hidden="true" />
        <div className="hijaiyah-game__find-hill hijaiyah-game__find-hill--front" aria-hidden="true" /></>}
        {scatter.map((item, index) => {
          const isFound = picked.some((p) => p.char === item.char && !p.isWrong && item.isTarget);
          const isWrong = picked.some((p) => p.char === item.char && p.isWrong);
          return (
            <button
              key={`${item.char}-${index}`}
              type="button"
              onClick={() => handlePick(item)}
              disabled={isFound}
              className={`hijaiyah-game__find-scene-letter ${isFound ? 'hijaiyah-game__find-scene-letter--correct' : ''} ${isWrong ? 'hijaiyah-game__find-scene-letter--wrong' : ''}`}
              style={{ left: `${item.left}%`, top: `${item.top}%`, color: item.color, transform: `rotate(${item.rotate}deg) scale(${isFound ? 1.4 : item.scale})` }}
            >
              <span className="hijaiyah-game__find-scene-letter-harakat" style={{ color: item.harakatColor }}>{item.harakat.preview}</span>
              <span>{item.char}</span>
            </button>
          );
        })}
      </div>

      {picked.some((p) => p.isWrong) && !success && (
        <p className="hijaiyah-game__stage-feedback hijaiyah-game__stage-feedback--wrong">
          <XCircle className="h-4 w-4 inline mr-1" /> Bukan itu, cari lagi.
        </p>
      )}
      {success && (
        <p className="hijaiyah-game__stage-feedback">
          <CheckCircle2 className="h-4 w-4 inline mr-1" /> Hebat! Kamu menemukan semua huruf.
        </p>
      )}
    </div>
  );
};

const ColorMatchStage = ({ pairs, accent, onNext }) => {
  const canvasRef = useRef(null);
  const { zoom, setZoom, zoomIn, zoomOut, pinchHandlers } = usePinchZoom();
  const [placed, setPlaced] = useState([]);
  const [usedKeys, setUsedKeys] = useState(() => new Set());
  const [wrongFlash, setWrongFlash] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isInside = (point, rect) =>
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

  const addToCanvas = (kind, value, point, rect) => {
    const x = (point.x - rect.left) / zoom;
    const y = (point.y - rect.top) / zoom;
    const key = kind === 'letter' ? `letter:${value.char}` : `harakat:${value.id}`;
    if (usedKeys.has(key)) return;
    setUsedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setPlaced((prev) => [...prev, { id: `${kind}-${Date.now()}-${Math.random()}`, kind, value, x, y }]);
  };

  const handleTrayDragStart = (event, info) => {
    setIsDragging(true);
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = {
      x: info.point.x - (rect.left + rect.width / 2),
      y: info.point.y - (rect.top + rect.height / 2),
    };
  };

  const handleLetterDrop = (letter, event, info) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const dropPoint = {
      x: info.point.x - dragOffsetRef.current.x,
      y: info.point.y - dragOffsetRef.current.y,
    };
    if (rect && isInside(dropPoint, rect)) addToCanvas('letter', letter, dropPoint, rect);
    setIsDragging(false);
  };

  const handleHarakatDrop = (harakat, event, info) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const dropPoint = {
      x: info.point.x - dragOffsetRef.current.x,
      y: info.point.y - dragOffsetRef.current.y,
    };
    if (rect && isInside(dropPoint, rect)) addToCanvas('harakat', harakat, dropPoint, rect);
    setIsDragging(false);
  };

  const removePlaced = (id) => {
    const item = placed.find((p) => p.id === id);
    if (!item) return;
    const key = item.kind === 'letter' ? `letter:${item.value.char}` : `harakat:${item.value.id}`;
    setUsedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setPlaced((prev) => prev.filter((p) => p.id !== id));
  };

  const letterColor = (letterChar) => pairs.find((p) => p.letter.char === letterChar)?.color || accent;
  const harakatColor = (harakatId) => pairs.find((p) => p.harakat.id === harakatId)?.color || accent;

  const checkAnswer = () => {
    const allCorrect = pairs.every(({ letter, harakat }) =>
      placed.some((p) => p.kind === 'letter' && p.value.char === letter.char) &&
      placed.some((p) => p.kind === 'harakat' && p.value.id === harakat.id)
    );
    if (allCorrect) {
      setSuccess(true);
      setTimeout(onNext, 1200);
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 900);
    }
  };

  const allPlaced = pairs.every(({ letter, harakat }) =>
    placed.some((p) => p.kind === 'letter' && p.value.char === letter.char) &&
    placed.some((p) => p.kind === 'harakat' && p.value.id === harakat.id)
  );

  const colorLegend = pairs.map((p) => ({ color: p.color, letter: p.letter.char, harakat: p.harakat.name }));

  return (
    <div className="hijaiyah-game__matching">
      <p className="hijaiyah-game__stage-prompt">
        Guru menyebutkan tiga huruf — <strong>cocokkan huruf &amp; harakat berdasarkan warna!</strong>
      </p>

      <div className="hijaiyah-game__colormatch-legend">
        {colorLegend.map((item, i) => (
          <span key={i} className="hijaiyah-game__colormatch-legend-item">
            <span className="hijaiyah-game__colormatch-legend-swatch" style={{ background: item.color }} />
            <span style={{ color: item.color }}>{item.letter} + {item.harakat}</span>
          </span>
        ))}
      </div>
      <p className="hijaiyah-game__matching-hint">Seret huruf dan harakat berwarna ke area canvas, lalu letakkan pasangan warnanya berdekatan. Setiap huruf/harakat hanya dipakai sekali.</p>

      <div className="hijaiyah-game__canvas-tools">
        <span className="hijaiyah-game__canvas-tools-label">{Math.round(zoom * 100)}%</span>
        <div className="hijaiyah-game__tracing-zoom">
          <button type="button" aria-label="Perkecil" onClick={zoomOut} className="hijaiyah-game__tracing-zoom-btn">−</button>
          <button type="button" aria-label="Perbesar" onClick={zoomIn} className="hijaiyah-game__tracing-zoom-btn">+</button>
          <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} className="hijaiyah-game__tracing-zoom-btn">⟲</button>
        </div>
      </div>

      <div
        className={`hijaiyah-game__matching-canvas ${isDragging ? 'hijaiyah-game__matching-canvas--active' : ''}`}
        ref={canvasRef}
        style={{ transform: `scale(${zoom})` }}
        {...pinchHandlers}
      >
        {placed.map((item) => (
          <motion.div
            key={item.id}
            className={'hijaiyah-game__matching-canvas-item ' + (item.kind === 'harakat' ? 'hijaiyah-game__matching-canvas-item--harakat' : '')}
            style={{
              left: item.x,
              top: item.y,
              '--mode-accent': accent,
              color: item.kind === 'letter' ? letterColor(item.value.char) : harakatColor(item.value.id),
            }}
            drag
            dragMomentum={false}
            dragElastic={0}
            whileDrag={{ scale: 1.12, zIndex: 30, cursor: 'grabbing' }}
          >
            {item.kind === 'letter' ? item.value.char : <span className="hijaiyah-game__harakat-preview" style={{ color: harakatColor(item.value.id) }}>{item.value.preview}</span>}
            <button type="button" className="hijaiyah-game__matching-canvas-remove" onClick={() => removePlaced(item.id)} aria-label="Hapus"><X className="h-3 w-3" /></button>
          </motion.div>
        ))}
      </div>

      <div className="hijaiyah-game__matching-tray">
        <p className="hijaiyah-game__matching-tray-label">Huruf</p>
        <div className="hijaiyah-game__matching-pieces">
          {pairs.map(({ letter, color }) => {
            const used = usedKeys.has(`letter:${letter.char}`);
            return (
              <motion.button
                key={letter.char}
                type="button"
                drag
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0}
                whileDrag={{ scale: 1.15, zIndex: 20, cursor: 'grabbing' }}
                onDragStart={handleTrayDragStart}
                onDragEnd={(event, info) => handleLetterDrop(letter, event, info)}
                className={`hijaiyah-game__matching-piece ${used ? 'hijaiyah-game__matching-piece--used' : ''}`}
                style={{ '--mode-accent': accent, color }}
                aria-disabled={used}
              >
                {letter.char}
              </motion.button>
            );
          })}
        </div>
        <p className="hijaiyah-game__matching-tray-label">Harakat</p>
        <div className="hijaiyah-game__matching-pieces">
          {pairs.map(({ harakat, color }) => {
            const used = usedKeys.has(`harakat:${harakat.id}`);
            return (
              <motion.button
                key={harakat.id}
                type="button"
                drag
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0}
                whileDrag={{ scale: 1.15, zIndex: 20, cursor: 'grabbing' }}
                onDragStart={handleTrayDragStart}
                onDragEnd={(event, info) => handleHarakatDrop(harakat, event, info)}
                className={`hijaiyah-game__matching-piece hijaiyah-game__matching-piece--harakat ${used ? 'hijaiyah-game__matching-piece--used' : ''}`}
                style={{ '--mode-accent': accent, color }}
                aria-disabled={used}
              >
                <span className="hijaiyah-game__harakat-preview" style={{ color }}>{harakat.preview}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="hijaiyah-game__matching-actions">
        <Button type="button" variant="outline" onClick={() => { setPlaced([]); setUsedKeys(new Set()); }} disabled={placed.length === 0}>
          <X className="w-4 h-4 mr-1" /> Kosongkan
        </Button>
        <Button type="button" onClick={checkAnswer} disabled={!allPlaced} style={{ background: accent }}>
          <Check className="w-4 h-4 mr-1" /> Periksa Jawaban
        </Button>
      </div>

      {wrongFlash && (
        <p className="hijaiyah-game__stage-feedback hijaiyah-game__stage-feedback--wrong">
          <XCircle className="w-4 h-4 inline mr-1" /> Masih ada yang belum tepat, coba lagi.
        </p>
      )}
      {success && (
        <p className="hijaiyah-game__stage-feedback">
          <CheckCircle2 className="w-4 h-4 inline mr-1" /> Benar semua! Huruf &amp; harakat warnanya cocok.
        </p>
      )}
    </div>
  );
};


export default HijaiyahGamePage;

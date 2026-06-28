import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import GradientText from '@/components/reactbits/GradientText/GradientText';
import '@/styles/public-login.css';

/* ---------- Animation Variants ---------- */
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const identityVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ---------- Error Mapping ---------- */
const mapErrorMessage = (error) => {
  if (!error) return null;
  const msg = error.message?.toLowerCase() || '';

  if (msg.includes('supabase belum dikonfigurasi')) {
    return error.message;
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Koneksi ke server gagal. Periksa koneksi internet Anda.';
  }
  if (
    msg.includes('invalid') ||
    msg.includes('salah') ||
    msg.includes('format') ||
    msg.includes('credentials')
  ) {
    return 'Email/Username atau Password salah.';
  }
  if (msg.includes('not found') || msg.includes('tidak ditemukan')) {
    return 'Akun tidak ditemukan. Periksa kembali kredensial Anda.';
  }
  return 'Terjadi kesalahan, silakan coba lagi.';
};

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { signInWithUsername, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const errorAlertRef = useRef(null);

  /* --- Redirect if already authenticated --- */
  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  /* --- Fetch dynamic logo --- */
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const fetchLogo = async () => {
      const { data } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'logoUrl')
        .maybeSingle();
      if (data?.content) setLogoUrl(data.content);
    };
    fetchLogo();

    const channel = supabase
      .channel('website_content_login_logo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_content', filter: 'key=eq.logoUrl' },
        (payload) => setLogoUrl(payload.new?.content || '/logo.png'),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  /* --- Form Validation --- */
  const validate = useCallback(() => {
    const errors = {};
    if (!username.trim()) {
      errors.username = 'Masukkan email atau username Anda.';
    }
    if (!password.trim()) {
      errors.password = 'Masukkan password Anda.';
    }
    return errors;
  }, [username, password]);

  /* --- Submit Handler --- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Focus first field with error
      if (errors.username) {
        usernameRef.current?.focus();
      } else if (errors.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    try {
      const { user: loggedInUser, error } = await signInWithUsername(
        trimmedUsername,
        trimmedPassword,
      );

      if (error) {
        const errorMsg = mapErrorMessage(error);
        setFormError(errorMsg);
        // Clear password on failed login for security
        setPassword('');
        // Focus password field for retry
        setTimeout(() => passwordRef.current?.focus(), 100);
      } else if (loggedInUser) {
        toast({
          title: 'Login berhasil!',
          description: 'Mengalihkan ke dashboard...',
          className: 'bg-green-600 text-white border-none',
        });
        navigate('/dashboard');
      }
    } catch (err) {
      setFormError('Terjadi kesalahan, silakan coba lagi.');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* --- Loading / Redirect state --- */
  if (loading) {
    return (
      <div className="login-page">
        <Helmet>
          <title>Login - LPQ Al-Muhajirun Metode Qiroati Baturaja</title>
        </Helmet>
        <div className="login-form-panel">
          <div className="login-spinner" style={{ width: 32, height: 32 }} aria-label="Memuat..." />
        </div>
      </div>
    );
  }

  /* --- Render --- */
  return (
    <>
      <Helmet>
        <title>Login - LPQ Al-Muhajirun Metode Qiroati Baturaja</title>
        <meta
          name="description"
          content="Login ke sistem LPQ Al-Muhajirun Metode Qiroati Baturaja untuk mengakses dashboard"
        />
      </Helmet>

      <div className="login-page">
        {/* ===== Identity Panel (Desktop) ===== */}
        <motion.aside
          className="login-identity-panel"
          variants={identityVariants}
          initial="hidden"
          animate="visible"
          aria-hidden="true"
        >
          <div className="login-identity-content">
            <div className="login-identity-logo">
              <img src={logoUrl} alt="" />
            </div>

            <h1 className="login-identity-title">
              LPQ Al-Muhajirun
            </h1>

            <div className="login-identity-divider" />

            <p className="login-identity-subtitle">
              Metode Qiroati Baturaja — Membentuk generasi Qur&rsquo;ani yang berakhlak mulia dan berprestasi.
            </p>

            <div className="login-identity-badge">
              <span className="login-identity-badge-dot" />
              Sistem Terintegrasi
            </div>
          </div>
        </motion.aside>

        {/* ===== Form Panel ===== */}
        <main className="login-form-panel" role="main">
          {/* Mobile Logo */}
          <div className="login-mobile-logo">
            <img
              src={logoUrl}
              alt="Logo LPQ Al-Muhajirun"
              className="login-mobile-logo-img"
            />
            <span className="login-mobile-title">LPQ Al-Muhajirun</span>
          </div>

          {/* Form Card */}
          <motion.div
            className="login-card"
            variants={prefersReducedMotion ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header */}
            <motion.div
              className="login-card-header"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h2 variants={staggerItem} className="login-card-greeting">
                <GradientText
                  colors={['hsl(152 58% 37%)', 'hsl(152 45% 50%)', 'hsl(42 65% 55%)', 'hsl(152 58% 37%)']}
                  animationSpeed={6}
                  className="login-card-greeting"
                >
                  Selamat Datang
                </GradientText>
              </motion.h2>
              <motion.p variants={staggerItem} className="login-card-description">
                Masukkan kredensial Anda untuk mengakses dashboard LPQ Al-Muhajirun.
              </motion.p>
            </motion.div>

            {/* Inline Error Alert */}
            {formError && (
              <div
                ref={errorAlertRef}
                className="login-alert"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="login-alert-icon" aria-hidden="true" />
                <div className="login-alert-content">
                  <p className="login-alert-title">Login Gagal</p>
                  <p className="login-alert-message">{formError}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {/* Username Field */}
              <div className="login-field-group">
                <label htmlFor="login-username" className="login-field-label">
                  Email atau Username
                </label>
                <div className="login-input-wrapper">
                  <User className="login-input-icon" aria-hidden="true" />
                  <input
                    ref={usernameRef}
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="Email Admin/Guru atau Nama Panggilan Santri"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: null }));
                      }
                    }}
                    disabled={isSubmitting}
                    className={`login-input${fieldErrors.username ? ' login-input--error' : ''}`}
                    aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                    aria-invalid={!!fieldErrors.username}
                    required
                  />
                </div>
                <div
                  id="login-username-error"
                  className="login-field-error"
                  role="status"
                  aria-live="polite"
                >
                  {fieldErrors.username && (
                    <>
                      <AlertCircle aria-hidden="true" />
                      {fieldErrors.username}
                    </>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field-group">
                <label htmlFor="login-password" className="login-field-label">
                  Password
                </label>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" aria-hidden="true" />
                  <input
                    ref={passwordRef}
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: null }));
                      }
                    }}
                    disabled={isSubmitting}
                    className={`login-input${fieldErrors.password ? ' login-input--error' : ''}`}
                    style={{ paddingRight: '3rem' }}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    aria-invalid={!!fieldErrors.password}
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div
                  id="login-password-error"
                  className="login-field-error"
                  role="status"
                  aria-live="polite"
                >
                  {fieldErrors.password && (
                    <>
                      <AlertCircle aria-hidden="true" />
                      {fieldErrors.password}
                    </>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="login-footer" aria-hidden="true">
              <p>&copy; {new Date().getFullYear()} LPQ Al-Muhajirun</p>
              <p>Metode Qiroati Baturaja</p>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default LoginPage;
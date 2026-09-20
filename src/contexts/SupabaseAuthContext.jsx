// Keadaan autentikasi aplikasi.
//
// Berkasnya masih bernama SupabaseAuthContext meski tidak ada lagi Supabase di dalamnya.
// Sekitar tiga puluh berkas mengimpor dari jalur ini, dan mengganti namanya berarti
// menyentuh semuanya tanpa mengubah perilaku apa pun. Penggantian nama itu pekerjaan
// tersendiri, bukan bagian dari peralihan autentikasi.
//
// Perbedaan mendasar dari sebelumnya: tidak ada token yang dipegang JavaScript. Sesinya
// ada di cookie HttpOnly yang hanya bisa dibaca Worker, jadi tidak ada yang bisa dicuri
// dari localStorage dan tidak ada yang perlu disegarkan sendiri di sisi klien.
//
// Akibatnya beberapa hal ikut hilang dan memang tidak digantikan:
//   - Tidak ada onAuthStateChange. Tidak ada token yang berubah diam-diam, jadi tidak ada
//     peristiwa yang perlu didengarkan, dan seluruh penanganan TOKEN_REFRESHED yang dulu
//     menyebabkan halaman berkedip saat pengguna kembali ke tab ikut hilang bersamanya.
//   - Peran tidak lagi dibaca dari tabel user_profiles oleh klien. Kebijakan tabel itu
//     hanya mengizinkan admin membacanya, jadi santri dan guru tidak akan bisa membaca
//     barisnya sendiri. Endpoint sesi yang membacanya di server dan memulangkan perannya.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { changePassword, getSession, login, logout } from '@/lib/authClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload) => {
    const nextUser = payload?.user ?? null;
    setUser(nextUser);
    setRole(nextUser?.role ?? null);
    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      const payload = await getSession();
      if (!active) return;
      applySession(payload);
      setLoading(false);
    };
    bootstrap();
    return () => { active = false; };
  }, [applySession]);

  // Menerima email untuk staf atau nama panggilan dan nomor induk untuk santri; klien
  // autentikasi yang memilih endpoint berdasarkan ada atau tidaknya tanda @, sama seperti
  // alur lama.
  const signInWithUsername = useCallback(async (rawUsername, rawPassword) => {
    try {
      const result = await login({ username: rawUsername, password: rawPassword });
      const nextUser = applySession(result);
      if (!nextUser) throw new Error('Sesi gagal dibuat.');
      return { user: nextUser, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      // Cookie-nya tetap dihapus server pada permintaan berikutnya, dan menahan pengguna
      // di halaman yang sudah ia tinggalkan lebih buruk daripada gagal diam-diam.
      console.warn('[Auth] Logout gagal dikirim:', error.message);
    }
    setUser(null);
    setRole(null);
    return { error: null };
  }, []);

  // Dipakai guru untuk mengganti password sendiri dari dialog profil.
  const updateUserPassword = useCallback(async (newPassword, currentPassword) => {
    try {
      await changePassword({ currentPassword, newPassword });
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  const value = useMemo(() => ({
    user,
    role,
    loading,
    // Dipertahankan karena ProtectedRoute membacanya. Dulu bernilai true selagi profil
    // ditarik terpisah sesudah sesi; sekarang sesinya sudah membawa peran sekaligus, jadi
    // tidak pernah ada jeda tersendiri untuk ditunggu.
    profileLoading: false,
    signInWithUsername,
    signOut,
    updateUserPassword,
  }), [user, role, loading, signInWithUsername, signOut, updateUserPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import RegistrationInfoPage from '@/pages/RegistrationInfoPage';
import BrochurePage from '@/pages/BrochurePage';
import ContactPage from '@/pages/ContactPage';
import PaymentStatusPage from '@/pages/PaymentStatusPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import NewsPage from '@/pages/NewsPage';
import NewsDetailPage from '@/pages/NewsDetailPage';
import AnnouncementPage from '@/pages/AnnouncementPage';
import AnnouncementDetailPage from '@/pages/AnnouncementDetailPage';
import QiroatiMethodPage from '@/pages/QiroatiMethodPage';
import FacilitiesPage from '@/pages/FacilitiesPage';
import ParentingPage from '@/pages/ParentingPage';
import ParentingArticlePage from '@/pages/ParentingArticlePage';
import ForumPage from '@/pages/ForumPage';
import ForumTopicPage from '@/pages/ForumTopicPage';
import EduMediaPage from '@/pages/EduMediaPage';
import SystemPage from '@/pages/SystemPage';
import WaliDiscussionPage from '@/pages/WaliDiscussionPage';
import DigitalAttendancePage from '@/pages/DigitalAttendancePage';
import TvDisplayPage from '@/pages/TvDisplayPage';
import PublicContentBlockRenderer from '@/components/public/PublicContentBlockRenderer';
import QuizHafalanPage from '@/pages/QuizHafalanPage';
import GatchaGamePage from '@/pages/GatchaGamePage';
import GalleryPage from '@/pages/GalleryPage';
import RandomNamePage from '@/pages/RandomNamePage';
import HijaiyahGamePage from '@/pages/HijaiyahGamePage';
import TopScorePage from '@/pages/TopScorePage';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { verifyDatabaseSchema } from '@/utils/verifyDatabaseSchema';
import { AlertTriangle, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import { enableDeferredFeatures, enableGameFeatures } from '@/lib/featureFlags';

const RouteLogger = () => {
  const location = useLocation();
  useEffect(() => {
    console.log(`App Routing to: ${location.pathname}${location.search}`);
  }, [location]);
  return null;
};

const DatabaseHealthCheck = () => {
  const { role } = useAuth();
  const [dbErrors, setDbErrors] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const checkDb = async () => {
      if (role === 'admin' && isSupabaseConfigured) {
        const report = await verifyDatabaseSchema();
        console.log('Database Health Report:', report);
        if (report.status === 'error') {
          setDbErrors(report.errors);
        }
      }
    };
    checkDb();
  }, [role]);

  if (!isVisible || dbErrors.length === 0 || role !== 'admin') return null;

  return (
    <div className="bg-red-500 text-white p-4 fixed top-0 left-0 w-full z-[999] flex justify-between items-start shadow-md">
      <div>
        <div className="flex items-center gap-2 font-bold mb-1">
          <AlertTriangle className="w-5 h-5" />
          Database Schema / RLS Issues Detected
        </div>
        <ul className="list-disc list-inside text-sm ml-6">
          {dbErrors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      </div>
      <button onClick={() => setIsVisible(false)} className="p-1 hover:bg-red-600 rounded">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

const DeferredFeaturePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-2xl font-bold text-foreground">Fitur belum diaktifkan</h1>
      <p className="text-muted-foreground">
        Fitur ini akan diaktifkan setelah Supabase baru dan Edge Function tersedia.
      </p>
    </div>
  </div>
);

const PublicPageWithBlocks = ({ pageKey, pageKeys, children }) => (
  <>
    {children}
    <PublicContentBlockRenderer pageKey={pageKey} pageKeys={pageKeys} />
  </>
);
const allDashboardRoles = ['admin', 'guru', 'santri', 'pentashih'];
const operationalDisplayRoles = ['admin', 'guru', 'pentashih'];

function App() {
  /* ----------------------------------------------------------------
   * Dismiss the inline loading shell that lives in index.html.
   * The shell is pure HTML+CSS and appears instantly before React.
   * We remove it on mount so there is zero additional delay.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const shell = document.getElementById('lpq-loading');
    if (shell) {
      shell.classList.add('lpq-loading-hide');
      // Remove from DOM after transition completes
      const onEnd = () => shell.remove();
      shell.addEventListener('transitionend', onEnd, { once: true });
      // Fallback removal if transitionend doesn't fire
      setTimeout(() => shell.remove(), 600);
    }
    try {
      sessionStorage.setItem('lpq_initial_load_done', 'true');
    } catch {
      // sessionStorage can be unavailable in restricted browser modes.
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DndProvider backend={HTML5Backend}>
          <Router>
            <DatabaseHealthCheck />
            <RouteLogger />
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
              <Routes>
                <Route path="/absensi-digital" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><DigitalAttendancePage /></ProtectedRoute>} />
                <Route path="/tv-display-mode" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><PublicPageWithBlocks pageKey="tv-display"><TvDisplayPage /></PublicPageWithBlocks></ProtectedRoute>} />
                {enableGameFeatures ? (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><QuizHafalanPage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><GatchaGamePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><RandomNamePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><TopScorePage /></ProtectedRoute>} />
                    <Route path="/hijaiyah-game" element={<ProtectedRoute><HijaiyahGamePage /></ProtectedRoute>} />
                  </>
                ) : (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/hijaiyah-game" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                  </>
                )}

                <Route path="*" element={
                  <>
                    <Navbar />
                    <main className="flex-grow">
                      <Routes>
                        <Route path="/" element={<PublicPageWithBlocks pageKeys={['home', 'apresiasi']}><HomePage /></PublicPageWithBlocks>} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/profil" element={<PublicPageWithBlocks pageKey="profile"><ProfilePage /></PublicPageWithBlocks>} />
                        <Route path="/profil/galeri" element={<PublicPageWithBlocks pageKey="gallery"><GalleryPage /></PublicPageWithBlocks>} />
                        <Route path="/pendaftaran/informasi" element={<PublicPageWithBlocks pageKey="registration"><RegistrationInfoPage /></PublicPageWithBlocks>} />
                        <Route path="/pendaftaran/brosur" element={<PublicPageWithBlocks pageKey="registration-brochure"><BrochurePage /></PublicPageWithBlocks>} />
                        <Route path="/pendaftaran/sistem" element={<PublicPageWithBlocks pageKey="registration-system"><SystemPage /></PublicPageWithBlocks>} />
                        <Route path="/parenting" element={<PublicPageWithBlocks pageKey="parenting"><ParentingPage /></PublicPageWithBlocks>} />
                        <Route path="/parenting/:articleId" element={<PublicPageWithBlocks pageKey="parenting-article"><ParentingArticlePage /></PublicPageWithBlocks>} />
                        <Route path="/parenting/media-edukatif" element={<PublicPageWithBlocks pageKeys={['educational-media', 'parenting-media']}><EduMediaPage /></PublicPageWithBlocks>} />
                        <Route path="/parenting/diskusi-wali" element={<PublicPageWithBlocks pageKey="wali-discussion"><WaliDiscussionPage /></PublicPageWithBlocks>} />
                        {enableDeferredFeatures ? (
                          <>
                            <Route path="/forum" element={<ForumPage />} />
                            <Route path="/forum/:topicId" element={<ForumTopicPage />} />
                          </>
                        ) : (
                          <>
                            <Route path="/forum" element={<DeferredFeaturePage />} />
                            <Route path="/forum/:topicId" element={<DeferredFeaturePage />} />
                          </>
                        )}
                        <Route path="/kontak" element={<PublicPageWithBlocks pageKey="contact"><ContactPage /></PublicPageWithBlocks>} />
                        <Route path="/status-pembayaran/:paymentId" element={<PaymentStatusPage />} />
                        <Route path="/berita" element={<PublicPageWithBlocks pageKey="news"><NewsPage /></PublicPageWithBlocks>} />
                        <Route path="/berita/:id" element={<PublicPageWithBlocks pageKey="news-detail"><NewsDetailPage /></PublicPageWithBlocks>} />
                        <Route path="/pengumuman" element={<PublicPageWithBlocks pageKey="announcements"><AnnouncementPage /></PublicPageWithBlocks>} />
                        <Route path="/pengumuman/:id" element={<PublicPageWithBlocks pageKey="announcement-detail"><AnnouncementDetailPage /></PublicPageWithBlocks>} />
                        <Route path="/metode-qiroati" element={<PublicPageWithBlocks pageKey="learning-system"><QiroatiMethodPage /></PublicPageWithBlocks>} />
                        <Route path="/fasilitas" element={<PublicPageWithBlocks pageKey="facilities"><FacilitiesPage /></PublicPageWithBlocks>} />
                        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={allDashboardRoles}><DashboardPage /></ProtectedRoute>} />
                      </Routes>
                    </main>
                    <Footer />
                  </>
                } />
              </Routes>
              <Toaster />
              <ScrollToTopButton />
            </div>
          </Router>
        </DndProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

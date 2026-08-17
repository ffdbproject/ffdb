// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Main Application — Routing and Layout
// ============================================================

import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';

const HomePage = lazy(() => import('./pages/HomePage'));
const SpeciesListPage = lazy(() => import('./pages/SpeciesListPage'));
const SpeciesDetailPage = lazy(() => import('./pages/SpeciesDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ContributePage = lazy(() => import('./pages/ContributePage'));
const ReportProblemPage = lazy(() => import('./pages/ReportProblemPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AddSpeciesPage = lazy(() => import('./pages/AddSpeciesPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AppShell() {
  const location = useLocation();
  const previousPathRef = useRef(`${location.pathname}${location.search}${location.hash}`);

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const previousPath = previousPathRef.current;

    if (/^\/species\/[^/]+$/.test(previousPath)) {
      const savedPath = sessionStorage.getItem('ffdb_return_path');
      if (savedPath && savedPath !== currentPath && currentPath !== savedPath) {
        sessionStorage.removeItem('ffdb_return_path');
        sessionStorage.removeItem('ffdb_return_scroll_y');
      }
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, location.search, location.hash]);

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="app">
      {!isAdminRoute && <Navbar />}
      <main>
        <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/species" element={<SpeciesListPage />} />
            <Route path="/species/:id" element={<SpeciesDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/contribute" element={<ContributePage />} />
            <Route path="/report-problem" element={<ReportProblemPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/admin/species/add" element={<AddSpeciesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
      <CookieBanner />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const clearRestoreMemory = () => {
      try {
        sessionStorage.removeItem('ffdb_return_path');
        sessionStorage.removeItem('ffdb_return_scroll_y');
      } catch {
        // ignore storage failures
      }
    };

    window.addEventListener('pagehide', clearRestoreMemory);
    window.addEventListener('beforeunload', clearRestoreMemory);

    return () => {
      window.removeEventListener('pagehide', clearRestoreMemory);
      window.removeEventListener('beforeunload', clearRestoreMemory);
    };
  }, []);

  return (
    <Router>
      <AppShell />
    </Router>
  );
}

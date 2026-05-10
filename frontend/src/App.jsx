// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Main Application — Routing and Layout
// ============================================================

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SpeciesListPage from './pages/SpeciesListPage';
import SpeciesDetailPage from './pages/SpeciesDetailPage';
import SearchPage from './pages/SearchPage';
import ContributePage from './pages/ContributePage';
import ReportProblemPage from './pages/ReportProblemPage';
import AdminPage from './pages/AdminPage';
import ApiDocsPage from './pages/ApiDocsPage';
import TeamPage from './pages/TeamPage';

export default function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/species" element={<SpeciesListPage />} />
            <Route path="/species/:id" element={<SpeciesDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/contribute" element={<ContributePage />} />
            <Route path="/report-problem" element={<ReportProblemPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

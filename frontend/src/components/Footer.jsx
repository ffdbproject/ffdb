import { Link } from 'react-router-dom';
import { preloadRoute } from '../utils/routePreload';

const prefetchProps = (path) => ({
  onMouseEnter: () => preloadRoute(path),
  onFocus: () => preloadRoute(path),
  onTouchStart: () => preloadRoute(path),
});

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/team" {...prefetchProps('/team')}>Team</Link>
          <Link to="/contribute" {...prefetchProps('/contribute')}>Contribute</Link>
          <Link to="/report-problem" {...prefetchProps('/report-problem')}>Report a Problem</Link>
          <Link to="/api-docs" {...prefetchProps('/api-docs')}>API Docs</Link>
          <Link to="/privacy" {...prefetchProps('/privacy')}>Privacy Policy</Link>
          <Link to="/terms" {...prefetchProps('/terms')}>Terms of Service</Link>
          <Link to="/contact" {...prefetchProps('/contact')}>Contact Us</Link>
        </div>
        <div className="footer-social">
          <a href="https://www.facebook.com/ffdbproject" target="_blank" rel="noopener noreferrer me" title="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a href="https://www.instagram.com/ffdbproject/" target="_blank" rel="noopener noreferrer me" title="Instagram">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5zm8.9 1.85a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/ffdbproject" target="_blank" rel="noopener noreferrer me" title="LinkedIn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>
            </svg>
          </a>
        </div>
        <p>
          © {new Date().getFullYear()} Flora and Fauna Database of Bangladesh (FFDB).
        </p>
      </div>
    </footer>
  );
}

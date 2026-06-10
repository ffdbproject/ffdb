import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export default function ContactPage() {
  return (
    <div className="page-enter container" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '800px' }}>
      <Helmet>
        <title>Contact Us - FFDB</title>
        <meta name="description" content="Contact the Flora and Fauna Database of Bangladesh (FFDB) team." />
      </Helmet>

      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '24px' }}>Contact Us</h1>
      
      <div className="content-block" style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '24px' }}>
          We would love to hear from you! Whether you have a question, a suggestion, or want to report an issue, feel free to reach out.
        </p>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '32px', wordBreak: 'break-word' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
            Get in Touch
          </h2>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <strong style={{ minWidth: '100px', color: 'var(--text-primary)' }}>Email:</strong>
              <a href="mailto:ffdbproject@gmail.com" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>ffdbproject@gmail.com</a>
            </li>
            <li style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <strong style={{ minWidth: '100px', color: 'var(--text-primary)' }}>Social Media:</strong>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <a href="https://www.facebook.com/ffdbproject" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', transition: 'color 0.2s' }} title="Facebook">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/ffdbproject/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', transition: 'color 0.2s' }} title="Instagram">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5zm8.9 1.85a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>
                  </svg>
                </a>
                <a href="https://www.linkedin.com/company/ffdbproject" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', transition: 'color 0.2s' }} title="LinkedIn">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>
                  </svg>
                </a>
              </div>
            </li>
          </ul>
        </div>

        <div style={{ marginTop: '32px', padding: '24px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(var(--accent-primary-rgb), 0.2)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary)' }}>
            Found a mistake in our data?
          </h3>
          <p style={{ marginBottom: '16px', fontSize: '14px' }}>
            If you've spotted an error in a species listing or have additional information to contribute, please use our reporting tool so we can review it quickly.
          </p>
          <Link to="/report-problem" className="btn btn-primary" style={{ display: 'inline-block' }}>
            Report a Problem
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function NotFoundPage() {
  return (
    <div className="page-enter container" style={{ 
      paddingTop: '80px', 
      paddingBottom: '80px', 
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <Helmet>
        <title>Page Not Found - FFDB</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div style={{
        fontSize: '120px',
        fontWeight: '900',
        color: 'var(--accent-primary)',
        lineHeight: 1,
        marginBottom: '20px',
        opacity: 0.2
      }}>
        404
      </div>
      
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>
        Lost in the Wilderness?
      </h1>
      
      <p style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '16px', 
        lineHeight: 1.6, 
        maxWidth: '500px', 
        marginBottom: '32px' 
      }}>
        The page you are looking for has migrated, gone extinct, or never existed in our database. 
        Don't worry, there's still plenty of flora and fauna to explore!
      </p>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
        <Link to="/species" className="btn btn-secondary">
          Browse Species
        </Link>
      </div>
    </div>
  );
}

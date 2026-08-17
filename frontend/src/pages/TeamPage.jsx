import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { teamAPI } from '../services/api';
import SafeImage from '../components/SafeImage';
import '../styles/pages/team-page.css';

export default function TeamPage() {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Team - FFDB',
    url: `${siteOrigin}/team`,
    description: 'Meet the FFDB team maintaining Bangladesh biodiversity data.',
  };

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await teamAPI.getPublic();
        setMembers(res.data || []);
      } catch (err) {
        console.error('Failed to load team:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeam();
  }, []);

  return (
    <div className="page-enter container" id="team-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>Team - FFDB</title>
        <meta name="description" content="Meet the FFDB team maintaining Bangladesh biodiversity data." />
        <meta property="og:title" content="Team - FFDB" />
        <meta property="og:description" content="Meet the FFDB team maintaining Bangladesh biodiversity data." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteOrigin}/team`} />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:image" content={`${siteOrigin}/og-fallback.png`} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Team - FFDB" />
        <meta name="twitter:description" content="Meet the FFDB team maintaining Bangladesh biodiversity data." />
        <link rel="canonical" href={`${siteOrigin}/team`} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
      </Helmet>

      <div style={{ maxWidth: '700px', margin: '0 auto', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Team</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6 }}>Meet the team</p>
      </div>

      <div className="team-content">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span className="loading-text">Loading team members...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No team members added yet</h3>
            <p>Admin can add team members from the Team tab in the admin panel.</p>
          </div>
        ) : (
          <div className="team-grid" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {members.map((member) => (
              <article key={member.id} className="team-member-card">
                <div className="team-member-image">
                  {member.image_url ? (
                    <SafeImage
                      src={member.image_url}
                      alt={`Photo of ${member.name}`}
                      className="member-photo"
                    />
                  ) : (
                    <div className="member-placeholder">
                      {member.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="team-member-info">
                  <h3 className="member-name">{member.name}</h3>
                  <p className="member-role">{member.role}</p>
                  {member.bio && (
                    <p className="member-bio">{member.bio}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

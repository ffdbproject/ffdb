import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { teamAPI } from '../services/api';
import SafeImage from '../components/SafeImage';

export default function TeamPage() {
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
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <Helmet>
        <title>Team | FFDB</title>
        <meta
          name="description"
          content="Meet the FFDB team maintaining Bangladesh biodiversity data."
        />
      </Helmet>

      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>Team</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px' }}>
        People behind the Flora and Fauna Database of Bangladesh.
      </p>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="loading-text">Loading team...</span>
        </div>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">Team</div>
          <h3>No team members added yet</h3>
          <p>Admin can add team members from the Team tab in the admin panel.</p>
        </div>
      ) : (
        <div className="species-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {members.map((member) => (
            <article key={member.id} className="species-card" style={{ cursor: 'default' }}>
              {member.image_url ? (
                <SafeImage
                  src={member.image_url}
                  alt={member.name}
                  className="species-card-image"
                />
              ) : (
                <div className="species-card-placeholder" style={{ fontSize: '28px' }}>
                  {member.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}

              <div className="species-card-body">
                <h3>{member.name}</h3>
                <p className="species-card-scientific" style={{ fontStyle: 'normal' }}>
                  {member.role}
                </p>
                {member.bio && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {member.bio}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

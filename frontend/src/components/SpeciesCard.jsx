import { Link, useLocation } from 'react-router-dom';
import SafeImage from './SafeImage';

/**
 * Reusable species card component.
 * Used in species grid listings on Homepage, Browse, and Search pages.
 */
export default function SpeciesCard({ species, index = 0 }) {
  const location = useLocation();
  const {
    id,
    scientific_name,
    english_name,
    bengali_name,
    category,
    conservation_status,
    primary_image,
    primary_image_thumbnail,
    origin,
  } = species;

  const displayName = english_name || bengali_name || scientific_name;
  const statusClass = (conservation_status || '').toLowerCase();

  const publicId = species.public_id || id;

  const handleCardClick = () => {
    try {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem('ffdb_return_scroll_y', String(window.scrollY || 0));
      sessionStorage.setItem('ffdb_return_path', currentPath);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <Link
      to={`/species/${publicId}`}
      className="species-card"
      id={`species-card-${publicId}`}
      onClick={handleCardClick}
    >
      <div className="species-card-img-wrap">
        {primary_image ? (
          <SafeImage
            src={primary_image_thumbnail || (() => {
              try {
                if (primary_image && primary_image.startsWith('/uploads/')) {
                  const parts = primary_image.split('/');
                  const name = parts[parts.length - 1];
                  return `/uploads/${name.replace(/(\.[^.]+)$/, '-sm$1')}`;
                }
              } catch {}
              return primary_image;
            })()}
            imageName={scientific_name}
            skipProxy
            alt={`Photo of ${displayName}`}
            className="species-card-image"
            loading={index < 2 ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="species-card-placeholder">
            {category === 'flora' ? 'Flora' : 'Fauna'}
          </div>
        )}
        <span className={`species-card-category ${category}`}>
          {category}
        </span>
      </div>

      <div className="species-card-body">
        <h3>{displayName}</h3>
          {english_name && bengali_name && english_name !== bengali_name && (
            <p className="species-card-bengali">{bengali_name}</p>
          )}
        <p className="species-card-scientific">{scientific_name}</p>
        <div className="species-card-meta">
          {origin && (
            <span className={`species-origin-badge ${origin}`}>
              {origin === 'native' ? 'Native' : origin === 'exotic' ? 'Exotic' : origin}
            </span>
          )}
          {conservation_status && (
            <span className={`conservation-badge ${statusClass}`}>
              {conservation_status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

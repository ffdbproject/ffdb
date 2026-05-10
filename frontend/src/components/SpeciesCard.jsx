import { Link } from 'react-router-dom';
import SafeImage from './SafeImage';

/**
 * Reusable species card component.
 * Used in species grid listings on Homepage, Browse, and Search pages.
 */
export default function SpeciesCard({ species }) {
  const {
    id,
    scientific_name,
    english_name,
    bengali_name,
    category,
    conservation_status,
    family,
    primary_image,
    origin,
  } = species;

  const displayName = english_name || bengali_name || scientific_name;
  const statusClass = (conservation_status || '').toLowerCase();

  return (
    <Link to={`/species/${id}`} className="species-card" id={`species-card-${id}`}>
      <div className="species-card-img-wrap">
        {primary_image ? (
          <SafeImage
            src={primary_image}
            alt={displayName}
            className="species-card-image"
            loading="lazy"
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

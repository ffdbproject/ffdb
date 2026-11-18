import { Link, useLocation } from 'react-router-dom';
import SafeImage from './SafeImage';

/**
 * Reusable species card component.
 * Used in species grid listings on Homepage, Browse, and Search pages.
 *
 * Card images are loaded DIRECTLY (no backend proxy) because:
 *  - The grid may show 8–12+ images simultaneously on shared hosting.
 *  - The backend proxy only has one Node process and cannot handle a burst
 *    of parallel image fetches without choking the server.
 *  - Direct loading with referrerPolicy="no-referrer" handles the two most
 *    common failure modes (Wikimedia hotlink protection, Safari ITP) without
 *    any server involvement.
 *
 * URL resolution strategy (in priority order):
 *  1. Local /uploads/   → serve directly (always works, same-origin).
 *  2. Wikimedia         → rewrite to official 330px thumbnail URL (HTTPS,
 *                         no referrer required, CORS-permissive).
 *  3. Any other https   → pass the URL directly with no-referrer. Most CDN
 *                         sources (iNaturalist S3, Flickr, etc.) do not check
 *                         referrers and load fine. If a source blocks it the
 *                         placeholder is shown — better than a proxy timeout.
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

  const speciesPath = species.status === 'published'
    ? `/species/${species.public_id || id}`
    : `/species/preview/${id}`;

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
      to={speciesPath}
      className="species-card"
      id={`species-card-${species.public_id || id}`}
      onClick={handleCardClick}
    >
      <div className="species-card-img-wrap">
        {primary_image ? (
          <SafeImage
            src={(() => {
              let srcUrl = primary_image_thumbnail || primary_image;
              if (!srcUrl) return null;
              try {
                // 1. Local upload — serve directly, same-origin, always works.
                if (srcUrl.startsWith('/uploads/')) {
                  return srcUrl;
                }

                // 2. Wikimedia — rewrite to official thumbnail URL.
                //    330px is on Wikimedia's allowlist; 400px is rejected.
                //    HTTPS is required; no referrer check at this size.
                if (srcUrl.includes('wikimedia.org')) {
                  const cleanUrl = srcUrl.split('?')[0].replace('http://', 'https://');
                  if (cleanUrl.includes('/thumb/')) return cleanUrl;

                  const match = cleanUrl.match(
                    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/([a-f0-9]\/[a-f0-9]{2})\/([^/]+)$/i
                  );
                  if (match) {
                    const [, project, path, filename] = match;
                    return `https://upload.wikimedia.org/wikipedia/${project}/thumb/${path}/${filename}/330px-${filename}`;
                  }
                  return cleanUrl;
                }

                // 3. All other external images — load directly.
                //    SafeImage sends referrerPolicy="no-referrer" which bypasses
                //    most hotlink-protection checks. No proxy = no server load.
                return srcUrl.replace(/^http:\/\//, 'https://');
              } catch {}
              return srcUrl;
            })()}
            imageName={scientific_name}
            skipProxy
            alt={`Photo of ${displayName}`}
            className="species-card-image"
            loading={index < 2 ? 'eager' : 'lazy'}
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

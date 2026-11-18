import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { resolveAssetUrl } from '../services/api';

/**
 * SafeImage — resilient image loader with 2-step fallback:
 *   1. Proxy URL (via resolveAssetUrl)  — if proxy fails, immediately fall back
 *   2. Direct original URL with referrerPolicy="no-referrer"
 *
 * Props:
 *   - imageName: optional species name for proxy filename (e.g. "Panthera tigris")
 *   - skipProxy: if true, load directly from the original URL (no proxy).
 *                Used by card grids where the backend proxy would be overwhelmed.
 *
 * Safari / privacy-browser compatibility:
 *   - referrerPolicy always defaults to "no-referrer" for external images.
 *     Wikimedia and many CDNs use referrer-based hotlink protection; sending
 *     no referrer bypasses the check without needing any server involvement.
 *
 * NOTE: We intentionally do NOT set crossOrigin="anonymous" by default.
 *   That attribute triggers a CORS preflight. If the image server does not
 *   send Access-Control-Allow-Origin headers the browser blocks the image
 *   entirely — which is worse than a broken-image icon. Only set crossOrigin
 *   explicitly on images you know are served with CORS headers (e.g. /uploads/).
 */
const SafeImage = forwardRef(function SafeImage({
  src,
  alt = '',
  fallbackAltSrc = '',
  imageName,
  skipProxy = false,
  width,
  height,
  aspectRatio,
  loading,
  style,
  referrerPolicy,
  ...props
}, ref) {
  const proxySrc = useMemo(() => resolveAssetUrl(src, imageName), [src, imageName]);
  const directSrc = useMemo(() => fallbackAltSrc || src || '', [fallbackAltSrc, src]);

  // Default to no-referrer for external images.
  // Most broken-image issues in Safari and privacy browsers are caused by
  // the browser sending the ffdb.bd origin as a referrer to Wikimedia/iNaturalist,
  // which then blocks the request. Omitting the referrer header fixes this.
  const isExternal = (url) => url && (url.startsWith('http://') || url.startsWith('https://'));
  const resolvePolicy = (url) => {
    if (referrerPolicy) return referrerPolicy; // caller-supplied always wins
    return isExternal(url) ? 'no-referrer' : '';
  };

  const initialSrc = skipProxy ? directSrc : proxySrc;
  const initialPolicy = resolvePolicy(initialSrc);

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [currentReferrerPolicy, setCurrentReferrerPolicy] = useState(initialPolicy);
  const failedRef = useRef(false);

  // Reset when src changes
  useEffect(() => {
    failedRef.current = false;
    const newSrc = skipProxy ? directSrc : proxySrc;
    setCurrentSrc(newSrc);
    setCurrentReferrerPolicy(resolvePolicy(newSrc));
  }, [proxySrc, directSrc, referrerPolicy, skipProxy]);

  if (!src) return null;

  const imgProps = {};
  if (width) imgProps.width = width;
  if (height) imgProps.height = height;

  const computedStyle = { ...(style || {}) };
  if (!computedStyle.aspectRatio && aspectRatio) computedStyle.aspectRatio = aspectRatio;
  if (!computedStyle.aspectRatio && width && height) computedStyle.aspectRatio = `${width} / ${height}`;

  const handleError = () => {
    // If already failed once (was on direct URL), give up
    if (failedRef.current) {
      if (typeof props.onError === 'function') props.onError();
      return;
    }

    failedRef.current = true;

    // If we were on proxy, fall back to direct URL immediately (no retry)
    if (!skipProxy && directSrc && directSrc !== proxySrc) {
      setCurrentSrc(directSrc);
      setCurrentReferrerPolicy('no-referrer');
      return;
    }

    // All attempts exhausted
    if (typeof props.onError === 'function') props.onError();
  };

  return (
    <img
      {...props}
      {...imgProps}
      ref={ref}
      src={currentSrc}
      alt={alt}
      loading={loading || 'lazy'}
      decoding="async"
      referrerPolicy={currentReferrerPolicy}
      style={computedStyle}
      onError={handleError}
    />
  );
});

export default SafeImage;
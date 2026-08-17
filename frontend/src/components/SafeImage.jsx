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
 *                Useful for list/card views where speed > proxy benefits.
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

  // When skipProxy is true, go straight to direct URL with no-referrer
  const initialSrc = skipProxy ? directSrc : proxySrc;
  const initialPolicy = skipProxy ? 'no-referrer' : (referrerPolicy || '');

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [currentReferrerPolicy, setCurrentReferrerPolicy] = useState(initialPolicy);
  const failedRef = useRef(false);

  // Reset when src changes
  useEffect(() => {
    failedRef.current = false;
    const newSrc = skipProxy ? directSrc : proxySrc;
    const newPolicy = skipProxy ? 'no-referrer' : (referrerPolicy || '');
    setCurrentSrc(newSrc);
    setCurrentReferrerPolicy(newPolicy);
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
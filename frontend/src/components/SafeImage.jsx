import { useEffect, useMemo, useState } from 'react';
import { resolveAssetUrl } from '../services/api';

export default function SafeImage({ src, alt = '', fallbackAltSrc = '', ...props }) {
  const resolvedSrc = useMemo(() => resolveAssetUrl(src), [src]);
  const originalSrc = useMemo(() => fallbackAltSrc || src || '', [fallbackAltSrc, src]);
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [hasFallenBack, setHasFallenBack] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolvedSrc);
    setHasFallenBack(false);
  }, [resolvedSrc]);

  if (!src) return null;

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        if (!hasFallenBack && originalSrc && originalSrc !== currentSrc) {
          setHasFallenBack(true);
          setCurrentSrc(originalSrc);
          return;
        }

        if (typeof props.onError === 'function') {
          props.onError(event);
        }
      }}
    />
  );
}
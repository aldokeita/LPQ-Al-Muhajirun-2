import { useEffect, useState } from 'react';
import '@/styles/cms-logo.css';

const CmsLogo = ({
  src = '',
  alt = 'Logo LPQ',
  width = 48,
  height = 48,
  className = '',
  imgClassName = '',
  loading = 'eager',
  ...imgProps
}) => {
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const [status, setStatus] = useState(normalizedSrc ? 'loading' : 'empty');
  const [loadedSrc, setLoadedSrc] = useState('');

  useEffect(() => {
    setStatus(normalizedSrc ? 'loading' : 'empty');
    setLoadedSrc('');
  }, [normalizedSrc]);

  const slotClassName = [
    'cms-logo-slot',
    status === 'empty' || status === 'error' ? 'cms-logo-slot--empty' : '',
    className,
  ].filter(Boolean).join(' ');
  const imageClassName = [
    'cms-logo-slot__image',
    status === 'ready' && loadedSrc === normalizedSrc ? 'is-loaded' : '',
    imgClassName,
  ].filter(Boolean).join(' ');

  return (
    <span
      className={slotClassName}
      style={{ width, height }}
      aria-busy={status === 'loading' || undefined}
    >
      {normalizedSrc && status !== 'error' ? (
        <img
          {...imgProps}
          src={normalizedSrc}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          className={imageClassName}
          onLoad={() => {
            setLoadedSrc(normalizedSrc);
            setStatus('ready');
          }}
          onError={() => setStatus('error')}
        />
      ) : null}
    </span>
  );
};

export default CmsLogo;

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationFeedbackState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const loadingStartedAt = useRef<number | null>(null);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (loadingStartedAt.current === null) return;
    const remaining = Math.max(0, 350 - (Date.now() - loadingStartedAt.current));
    const timer = setTimeout(() => {
      loadingStartedAt.current = null;
      if (failSafeTimer.current) clearTimeout(failSafeTimer.current);
      failSafeTimer.current = null;
      setLoading(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [locationKey]);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}?${destination.searchParams.toString()}` === `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`) return;

      loadingStartedAt.current = Date.now();
      setLoading(true);
      if (failSafeTimer.current) clearTimeout(failSafeTimer.current);
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        loadingStartedAt.current = null;
        failSafeTimer.current = null;
        setLoading(false);
      }, 12_000);
      failSafeTimer.current = clearTimer;
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      if (clearTimer) clearTimeout(clearTimer);
      failSafeTimer.current = null;
    };
  }, []);

  return loading ? <>
    <div aria-hidden="true" className="navigation-progress"><span /></div>
    <span role="status" aria-live="polite" className="sr-only">Memuat halaman…</span>
  </> : null;
}

export function NavigationFeedback() {
  return <Suspense fallback={null}><NavigationFeedbackState /></Suspense>;
}

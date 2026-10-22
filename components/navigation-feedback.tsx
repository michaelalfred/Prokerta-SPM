'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationFeedbackState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const locationKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    setLoading(false);
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

      setLoading(true);
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => setLoading(false), 12_000);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      if (clearTimer) clearTimeout(clearTimer);
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

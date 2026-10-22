'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('tema', next ? 'gelap' : 'terang');
    setDark(next);
  }
  return <button type="button" onClick={toggle} aria-label={dark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700">{dark ? 'Terang' : 'Gelap'}</button>;
}

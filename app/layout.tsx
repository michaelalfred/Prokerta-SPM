import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Prokerta SPM', description: 'Pendataan dan evaluasi program kerja paroki' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('tema');var d=t?t==='gelap':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()` }} /></head><body>{children}</body></html>;
}

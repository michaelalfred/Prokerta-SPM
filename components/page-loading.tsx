type PageLoadingKind = 'list' | 'filtered-list' | 'form' | 'detail' | 'accounts' | 'periods' | 'strategy' | 'analysis' | 'password' | 'login';

const block = 'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700';

function Line({ className = '' }: { className?: string }) {
  return <div className={`${block} h-4 ${className}`} />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`grid min-w-0 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 ${className}`} aria-hidden="true">{children}</section>;
}

export function PageLoading({ title, kind }: { title: string; kind: PageLoadingKind }) {
  if (kind === 'login') return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6" aria-busy="true" aria-live="polite"><p className="sr-only">Memuat halaman {title}</p><div className="grid justify-items-center gap-3"><div className={`${block} h-24 w-24 rounded-full`} /><Line className="h-7 w-44" /></div><Card><Line className="w-24" /><Line className="h-10 w-full" /><Line className="w-24" /><Line className="h-10 w-full" /><Line className="h-10 w-full" /></Card></main>;

  return <section className="grid min-w-0 gap-5" aria-busy="true" aria-live="polite">
    <p className="sr-only">Memuat halaman {title}</p>
    <div className="flex min-h-8 items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{title}</h1>{kind === 'list' && <div className={`${block} h-10 w-32`} />}</div>

    {(kind === 'list' || kind === 'filtered-list') && <>
      {kind === 'filtered-list' && <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Line key={i} className="h-10 w-full" />)}</div><div className="flex gap-2"><Line className="h-10 w-28" /><Line className="h-10 w-24" /></div></Card>}
      <div className="grid gap-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Line className="h-5 w-2/3" /><Line className="w-1/2" /><Line className="w-3/4" /><Line className="h-10 w-28" /></Card>)}</div>
    </>}

    {kind === 'form' && <>{Array.from({ length: 5 }, (_, i) => <Card key={i}><Line className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-2"><Line className="h-10 w-full" /><Line className="h-10 w-full" /></div><Line className="h-20 w-full" /></Card>)}<Line className="h-11 w-36" /></>}

    {kind === 'detail' && <>{Array.from({ length: 3 }, (_, i) => <Card key={i}><Line className="h-6 w-48" /><div className="grid gap-4 sm:grid-cols-2"><Line className="h-16 w-full" /><Line className="h-16 w-full" /><Line className="h-16 w-full" /><Line className="h-16 w-full" /></div></Card>)}</>}

    {kind === 'accounts' && <><Card><Line className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-2"><Line className="h-10 w-full" /><Line className="h-10 w-full" /><Line className="h-10 w-full" /><Line className="h-10 w-full" /></div><Line className="h-10 w-32" /></Card><div className="grid gap-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Line className="h-5 w-1/2" /><Line className="w-3/4" /><Line className="h-10 w-36" /></Card>)}</div></>}

    {kind === 'periods' && <><Card><Line className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-3"><Line className="h-10 w-full" /><Line className="h-10 w-full" /><Line className="h-10 w-full" /></div><Line className="h-10 w-32" /></Card><div className="grid gap-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, j) => <Line key={j} className="h-10 w-full" />)}</div></Card>)}</div></>}

    {kind === 'strategy' && <><Card><Line className="h-6 w-24" /><Line className="h-24 w-full" /><Line className="h-10 w-32" /></Card><Card><Line className="h-6 w-56" /><Line className="h-10 w-full max-w-xl" /><Line className="h-32 w-full" /></Card></>}

    {kind === 'analysis' && <><Card><Line className="h-10 w-full sm:max-w-xs" /><Line className="h-10 w-full sm:max-w-xs" /><Line className="h-10 w-32" /></Card>{Array.from({ length: 4 }, (_, i) => <Card key={i}><Line className="h-6 w-56" /><Line className="h-12 w-full" /><Line className="h-20 w-full" /></Card>)}</>}

    {kind === 'password' && <Card className="mx-auto w-full max-w-md"><Line className="h-6 w-48" /><Line className="w-32" /><Line className="h-10 w-full" /><Line className="w-40" /><Line className="h-10 w-full" /><Line className="h-10 w-32" /></Card>}
  </section>;
}

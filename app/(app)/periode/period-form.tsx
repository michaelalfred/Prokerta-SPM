'use client';

import { useState } from 'react';
import { simpanPeriode } from './actions';
import type { InputPeriod } from '@/lib/rules/periode';

type Period = InputPeriod & { id: string };

export function PeriodForm({ periods }: { periods: Period[] }) {
  const [message, setMessage] = useState('');
  return <div className="grid min-w-0 gap-6">
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Tambah periode</h2><form action={async (form) => { const result = await simpanPeriode(form); setMessage(result.error || result.ok || ''); }} className="mt-4 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm">Tahun program<input name="tahun_program" type="number" min="2000" max="2100" required /></label><label className="grid gap-1 text-sm">Tanggal mulai<input name="tanggal_mulai" type="date" required /></label><label className="grid gap-1 text-sm">Tanggal selesai<input name="tanggal_selesai" type="date" required /></label><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:col-span-3 sm:justify-self-start">Tambah periode</button>{message && <p role="status" className="text-sm sm:col-span-3">{message}</p>}</form></section>
    <section><h2 className="mb-3 text-lg font-semibold">Daftar periode</h2>{periods.length === 0 ? <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--muted)]">Belum ada periode input</p> : <div className="grid gap-3">{periods.map((period) => <PeriodRow key={period.id} period={period} />)}</div>}</section>
  </div>;
}

function PeriodRow({ period }: { period: Period }) {
  const [message, setMessage] = useState('');
  return <form action={async (form) => { form.set('id', period.id); const result = await simpanPeriode(form); setMessage(result.error || result.ok || ''); }} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-4"><label className="grid gap-1 text-sm">Tahun program<input name="tahun_program" type="number" min="2000" max="2100" defaultValue={period.tahun_program} required /></label><label className="grid gap-1 text-sm">Tanggal mulai<input name="tanggal_mulai" type="date" defaultValue={period.tanggal_mulai} required /></label><label className="grid gap-1 text-sm">Tanggal selesai<input name="tanggal_selesai" type="date" defaultValue={period.tanggal_selesai} required /></label><div className="flex flex-col justify-end gap-2"><button className="min-h-10 rounded-lg border border-[var(--border)] px-4">Simpan perubahan</button>{message && <p role="status" className="text-sm">{message}</p>}</div></form>;
}

'use client';

import { useState, useTransition } from 'react';
import { simpanIzinKetua } from './actions';

type Division = { id: string; nama: string; lembaga_id: string; lembaga: { nama: string } };
type Chair = { id: string; username: string; bidang_id: string; bidang: { nama: string; lembaga: { nama: string } } };

export function PermissionForm({ chair, divisions, granted }: { chair: Chair; divisions: Division[]; granted: string[] }) {
  const [selected, setSelected] = useState<string[]>(granted);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function save() {
    const form = new FormData(); form.set('profile_id', chair.id); selected.forEach((id) => form.append('bidang_id', id));
    startTransition(async () => { const result = await simpanIzinKetua(form); setMessage(result.error ?? 'Izin berhasil disimpan.'); });
  }
  return <article className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div><h2 className="font-semibold">{chair.username}</h2><p className="text-sm text-[var(--muted)]">Bidang sendiri: {chair.bidang.lembaga.nama} · {chair.bidang.nama} (selalu diizinkan)</p></div><fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><legend className="mb-2 text-sm font-medium">Bidang lain yang dapat dilihat</legend>{divisions.map((division) => <label key={division.id} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm"><input type="checkbox" checked={selected.includes(division.id)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, division.id] : old.filter((id) => id !== division.id))} /><span>{division.lembaga.nama} · {division.nama}</span></label>)}</fieldset><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={pending} className="min-h-10 rounded-lg bg-blue-700 px-4 text-white disabled:opacity-60">{pending ? 'Menyimpan…' : 'Simpan izin'}</button>{message && <p role="status" className="text-sm">{message}</p>}</div></article>;
}

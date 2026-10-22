'use client';

import { useState } from 'react';
import { hapusMilestone, hapusMisi, simpanMilestone, simpanMisi, simpanVisi } from './actions';

type Milestone = { id: string; nomor: number; teks: string };
type Mission = { id: string; nomor: number; teks: string; outcome: string; milestones: Milestone[] };

function FormMessage({ value }: { value: string }) { return value ? <p role="status" className="text-sm text-[var(--muted)]">{value}</p> : null; }

export function VisiMisiEditor({ visi, missions }: { visi: string; missions: Mission[] }) {
  const [message, setMessage] = useState('');
  return <div className="grid gap-6">
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Visi</h2><form action={async (form) => { const result = await simpanVisi(form); setMessage(result.error || 'Visi disimpan.'); }} className="mt-3 grid gap-3"><textarea name="visi" defaultValue={visi} rows={4} required /><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:justify-self-start">Simpan visi</button><FormMessage value={message} /></form></section>
    <section><h2 className="mb-3 text-lg font-semibold">Misi dan Milestone</h2><div className="grid gap-5">{missions.map((mission) => <MissionEditor key={mission.id} mission={mission} />)}<NewMission onMessage={setMessage} /></div></section>
  </div>;
}

function MissionEditor({ mission }: { mission: Mission }) {
  const [message, setMessage] = useState('');
  async function saveMission(form: FormData) { form.set('id', mission.id); const result = await simpanMisi(form); setMessage(result.error || 'Misi disimpan.'); }
  async function deleteMission(form: FormData) { form.set('id', mission.id); const result = await hapusMisi(form); setMessage(result.error || 'Misi dan milestone dihapus.'); }
  return <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><form action={saveMission} className="grid gap-3 sm:grid-cols-[5rem_1fr]"><label className="grid gap-1 text-sm">Nomor<input type="number" name="nomor" min="1" defaultValue={mission.nomor} required /></label><label className="grid gap-1 text-sm sm:col-span-1">Teks misi<textarea name="teks" rows={3} defaultValue={mission.teks} required /></label><label className="grid gap-1 text-sm sm:col-span-2">Outcome<textarea name="outcome" rows={2} defaultValue={mission.outcome} required /></label><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:justify-self-start">Simpan misi</button></form><form action={deleteMission} className="mt-2"><button className="min-h-10 rounded-lg px-3 text-sm text-red-700">Hapus misi</button></form><FormMessage value={message} />
    <div className="mt-4 border-t border-[var(--border)] pt-4"><h3 className="font-medium">Milestone</h3><div className="mt-3 grid gap-3">{mission.milestones.map((item) => <MilestoneEditor key={item.id} item={item} missionId={mission.id} />)}<NewMilestone missionId={mission.id} /></div></div>
  </article>;
}

function MilestoneEditor({ item, missionId }: { item: Milestone; missionId: string }) {
  const [message, setMessage] = useState('');
  async function save(form: FormData) { form.set('id', item.id); form.set('misi_id', missionId); const result = await simpanMilestone(form); setMessage(result.error || 'Milestone disimpan.'); }
  async function remove(form: FormData) { form.set('id', item.id); const result = await hapusMilestone(form); setMessage(result.error || 'Milestone dihapus.'); }
  return <div className="rounded-lg border border-[var(--border)] p-3"><form action={save} className="grid gap-2 sm:grid-cols-[5rem_1fr_auto]"><label className="grid gap-1 text-sm">Nomor<input type="number" name="nomor" min="1" defaultValue={item.nomor} required /></label><label className="grid gap-1 text-sm">Teks milestone<textarea name="teks" rows={2} defaultValue={item.teks} required /></label><button className="min-h-10 self-end rounded-lg border border-[var(--border)] px-3">Simpan</button></form><form action={remove} className="mt-1"><button className="min-h-10 text-sm text-red-700">Hapus milestone</button></form><FormMessage value={message} /></div>;
}

function NewMission({ onMessage }: { onMessage: (value: string) => void }) {
  const [message, setMessage] = useState('');
  async function create(form: FormData) { const result = await simpanMisi(form); const text = result.error || 'Misi ditambahkan.'; setMessage(text); onMessage(text); if (!result.error) (document.getElementById('misi-baru') as HTMLFormElement)?.reset(); }
  return <article className="rounded-xl border border-dashed border-[var(--border)] p-5"><h3 className="font-semibold">Tambah misi</h3><form id="misi-baru" action={create} className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr]"><label className="grid gap-1 text-sm">Nomor<input type="number" name="nomor" min="1" required /></label><label className="grid gap-1 text-sm">Teks misi<textarea name="teks" rows={2} required /></label><label className="grid gap-1 text-sm sm:col-span-2">Outcome<textarea name="outcome" rows={2} required /></label><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:justify-self-start">Tambah misi</button><FormMessage value={message} /></form></article>;
}

function NewMilestone({ missionId }: { missionId: string }) {
  const [message, setMessage] = useState('');
  async function create(form: FormData) { form.set('misi_id', missionId); const result = await simpanMilestone(form); setMessage(result.error || 'Milestone ditambahkan.'); if (!result.error) (document.getElementById(`milestone-baru-${missionId}`) as HTMLFormElement)?.reset(); }
  return <form id={`milestone-baru-${missionId}`} action={create} className="grid gap-2 rounded-lg border border-dashed border-[var(--border)] p-3 sm:grid-cols-[5rem_1fr_auto]"><label className="grid gap-1 text-sm">Nomor<input type="number" name="nomor" min="1" required /></label><label className="grid gap-1 text-sm">Teks milestone<textarea name="teks" rows={2} required /></label><button className="min-h-10 self-end rounded-lg bg-blue-700 px-3 text-white">Tambah</button><div className="sm:col-span-3"><FormMessage value={message} /></div></form>;
}

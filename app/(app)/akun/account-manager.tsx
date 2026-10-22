'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { UndoableDeleteButton } from '@/components/undoable-delete-button';
import { buatAkun, hapusAkun, resetPassword, ubahAkun, ubahRole } from './actions';

type Division = { id: string; nama: string; lembaga_id: string };
type Institution = { id: string; nama: string };
type Account = { id: string; username: string; role: string; nama_koordinator: string | null; tim: { id: string; nama: string; bidang_id: string; lembaga_id: string; bidang: string; lembaga: string } };

function Feedback({ message }: { message: string }) { return message ? <p role="status" className="mt-2 text-sm text-[var(--muted)]">{message}</p> : null; }

function PasswordDialog({ password, close }: { password: string; close: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!password) return null;
  async function copy() { await navigator.clipboard.writeText(password); setCopied(true); }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="password-title" className="w-full max-w-md rounded-xl bg-[var(--surface)] p-6 shadow-xl"><h2 id="password-title" className="text-lg font-semibold">Password akun</h2><p className="mt-2 text-sm text-[var(--muted)]">Password hanya ditampilkan sekali. Salin dan bagikan dengan aman.</p><code className="mt-4 block rounded bg-slate-100 p-3 text-lg tracking-widest text-slate-900 dark:bg-slate-800 dark:text-white">{password}</code><div className="mt-4 flex gap-2"><button onClick={copy} className="min-h-10 rounded-lg bg-blue-700 px-4 text-white">{copied ? 'Tersalin' : 'Salin'}</button><button onClick={close} className="min-h-10 rounded-lg border border-[var(--border)] px-4">Tutup</button></div></section></div>;
}

function SelectBidang({ lembagaId, bidangId, institutions, divisions, onChange }: { lembagaId: string; bidangId: string; institutions: Institution[]; divisions: Division[]; onChange: (value: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Lembaga<select value={lembagaId} onChange={(event) => onChange(event.target.value)} required><option value="">Pilih lembaga</option>{institutions.map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}</select></label><label className="grid gap-1 text-sm">Bidang<select name="bidang_id" value={bidangId} onChange={(event) => onChange(`bidang:${event.target.value}`)} required><option value="">Pilih bidang</option>{divisions.filter((row) => row.lembaga_id === lembagaId).map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}</select></label></div>;
}

export function AccountManager({ accounts, institutions, divisions }: { accounts: Account[]; institutions: Institution[]; divisions: Division[] }) {
  const [selectedPassword, setSelectedPassword] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [newDivision, setNewDivision] = useState('');
  const [newError, setNewError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  async function create(data: FormData) {
    setNewError(''); setNewMessage('');
    const division = String(data.get('bidang_id') ?? '');
    data.set('lembaga_id', newInstitution);
    data.set('bidang_id', division.replace(/^bidang:/, ''));
    const result = await buatAkun(data);
    if (result.error) setNewError(result.error);
    else { setNewMessage('Akun berhasil dibuat.'); setSelectedPassword(result.password ?? ''); }
  }
  return <>
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Tambah akun</h2><form action={create} className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><SelectBidang lembagaId={newInstitution} bidangId={newDivision} institutions={institutions} divisions={divisions} onChange={(value) => { if (value.startsWith('bidang:')) setNewDivision(value.slice(7)); else { setNewInstitution(value); setNewDivision(''); } }} /></div>
      <label className="grid gap-1 text-sm">Nama tim kerja<input name="nama_tim" required /></label><label className="grid gap-1 text-sm">Username<input name="username" pattern="[a-z0-9._-]+" autoCapitalize="none" required /></label><label className="grid gap-1 text-sm">Nama koordinator<input name="nama_koordinator" /></label><label className="grid gap-1 text-sm">Peran<select name="role" defaultValue="user"><option value="user">Pengguna</option><option value="admin">Admin</option></select></label><input type="hidden" name="lembaga_id" value={newInstitution} /><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:col-span-2 sm:justify-self-start">Buat akun</button><div className="sm:col-span-2"><Feedback message={newError || newMessage} /></div>
    </form></section>
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Daftar akun</h2><div className="grid gap-3">{accounts.map((account) => <AccountCard key={account.id} account={account} institutions={institutions} divisions={divisions} onPassword={setSelectedPassword} />)}</div></section>
    <PasswordDialog password={selectedPassword} close={() => setSelectedPassword('')} />
  </>;
}

function AccountCard({ account, institutions, divisions, onPassword }: { account: Account; institutions: Institution[]; divisions: Division[]; onPassword: (value: string) => void }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [editInstitution, setEditInstitution] = useState(account.tim.lembaga_id);
  const [editDivision, setEditDivision] = useState(account.tim.bidang_id);
  async function edit(data: FormData) { data.set('profile_id', account.id); data.set('lembaga_id', editInstitution); data.set('bidang_id', editDivision); const result = await ubahAkun(data); setMessage(result.error || 'Perubahan disimpan.'); }
  async function changeRole(data: FormData) { data.set('profile_id', account.id); const result = await ubahRole(data); setMessage(result.error || 'Peran diperbarui.'); }
  async function remove() { const data = new FormData(); data.set('profile_id', account.id); data.set('konfirmasi', typedConfirmation); const result = await hapusAkun(data); if (!result.error) router.refresh(); return result; }
  async function reset() { const result = await resetPassword(account.id); if (result.error) setMessage(result.error); else onPassword(result.password ?? ''); }
  return <article className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1 break-words"><h3 className="break-words font-semibold">{account.tim.nama}</h3><p className="break-words text-sm text-[var(--muted)]">{account.tim.lembaga} · {account.tim.bidang} · {account.username} · {account.role === 'admin' ? 'Admin' : account.role === 'superadmin' ? 'Superadmin' : 'Pengguna'}</p><p className="break-words text-sm text-[var(--muted)]">Koordinator: {account.nama_koordinator || 'Belum diisi'}</p></div><button type="button" onClick={() => setResetOpen(true)} className="min-h-10 shrink-0 rounded-lg border border-[var(--border)] px-3 text-sm">Reset password</button></div>
    <details className="mt-3 border-t border-[var(--border)] pt-3"><summary className="cursor-pointer text-sm font-medium">Ubah akun</summary><form action={edit} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Username<input name="username" defaultValue={account.username} pattern="[a-z0-9._-]+" required /></label><label className="grid gap-1 text-sm">Nama koordinator<input name="nama_koordinator" defaultValue={account.nama_koordinator ?? ''} /></label><label className="grid gap-1 text-sm">Nama tim kerja<input name="nama_tim" defaultValue={account.tim.nama} required /></label><label className="grid gap-1 text-sm">Lembaga<select value={editInstitution} onChange={(event) => { setEditInstitution(event.target.value); setEditDivision(''); }} required><option value="">Pilih lembaga</option>{institutions.map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}</select></label><label className="grid gap-1 text-sm">Bidang<select name="bidang_id" value={editDivision} onChange={(event) => setEditDivision(event.target.value)} required><option value="">Pilih bidang</option>{divisions.filter((row) => row.lembaga_id === editInstitution).map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}</select></label><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:col-span-2 sm:justify-self-start">Simpan perubahan</button></form></details>
    {account.role !== 'superadmin' && <div className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2"><form action={changeRole} className="flex items-center gap-2"><label className="sr-only" htmlFor={`role-${account.id}`}>Peran akun</label><select id={`role-${account.id}`} name="role" defaultValue={account.role}><option value="user">Pengguna</option><option value="admin">Admin</option></select><button className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm">Ubah peran</button></form><details><summary className="flex min-h-10 cursor-pointer items-center text-sm text-red-700">Hapus akun</summary><div className="mt-2 grid gap-2"><p className="text-sm">Proker dan evaluasi tim ini ikut terhapus. Ketik <strong>{account.username}</strong> untuk konfirmasi.</p><input value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} aria-label="Ketik username untuk konfirmasi" required /><UndoableDeleteButton disabled={typedConfirmation !== account.username} label="Akun dan seluruh data tim" title="Hapus akun dan tim kerja?" message={`Proker, evaluasi, serta file milik tim ${account.tim.nama} akan dihapus setelah 10 detik. Anda dapat membatalkan penghapusan melalui notifikasi.`} onDelete={remove} className="min-h-10 rounded-lg bg-red-700 px-3 text-white disabled:opacity-50">Hapus akun</UndoableDeleteButton></div></details></div>}
    <Feedback message={message} />
    <ConfirmationDialog open={resetOpen} title="Reset password akun?" message={`Password untuk ${account.username} akan diganti dan password baru hanya ditampilkan sekali.`} confirmLabel="Reset password" danger onCancel={() => setResetOpen(false)} onConfirm={() => { setResetOpen(false); void reset(); }} />
  </article>;
}

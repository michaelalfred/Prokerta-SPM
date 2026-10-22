'use client';

import { useState } from 'react';
import { formatRupiah } from '@/lib/rules/anggaran';
import { formatSelisihRupiah, sortBudgetRows, summarizeBudget, type BudgetAnalysisRow, type BudgetSort } from '@/lib/rules/analisis-anggaran';

type Group<T> = { id: string; nama: string; rows: T[] };
const countEvaluated = (rows: BudgetAnalysisRow[]) => rows.filter((row) => row.evaluasi_id !== null).length;

function groupBy<T>(rows: T[], id: (row: T) => string, name: (row: T) => string): Group<T>[] {
  const groups = new Map<string, Group<T>>();
  for (const row of rows) {
    const key = id(row);
    const group = groups.get(key) ?? { id: key, nama: name(row), rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function SummaryLine({ label, rows }: { label: string; rows: BudgetAnalysisRow[] }) {
  const summary = summarizeBudget(rows);
  return <p className="text-sm"><strong>{label}:</strong> Rencana {formatRupiah(summary.rencana)} · Realisasi {formatRupiah(summary.realisasi)} · Selisih {formatSelisihRupiah(summary.selisih)} · Serapan {summary.serapan === null ? '—' : `${summary.serapan.toFixed(2)}%`}{summary.serapan !== null && summary.serapan > 100 && <span className="ml-1 font-semibold text-red-800 dark:text-red-300">Melebihi rencana</span>}</p>;
}

export function BudgetAnalysisView({ rows }: { rows: BudgetAnalysisRow[] }) {
  const [sort, setSort] = useState<BudgetSort>('selisih-desc');
  const approvedSummary = summarizeBudget(rows);
  const compared = rows.filter((row) => row.evaluasi_id !== null && row.anggaran_realisasi !== null);
  const institutions = groupBy(compared, (row) => row.lembaga_id, (row) => row.lembaga);

  return <div className="grid min-w-0 gap-4">
    {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Belum ada data untuk tahun program ini.</p> : <>
      <p className="rounded-lg border border-[var(--border)] p-3 text-sm"><strong>Ringkasan semua proker disetujui:</strong> Total rencana {formatRupiah(approvedSummary.rencana)} · Sudah dievaluasi {countEvaluated(rows)} dari {rows.length} proker.</p>
      {compared.length === 0 ? <p className="text-sm text-[var(--muted)]">Belum ada proker disetujui yang sudah dievaluasi untuk dibandingkan.</p> : <>
        <label className="grid max-w-md gap-1 text-sm">Urutkan proker<select value={sort} onChange={(event) => setSort(event.target.value as BudgetSort)}>
          <option value="selisih-desc">Selisih: terbesar ke terkecil</option>
          <option value="selisih-asc">Selisih: terkecil ke terbesar</option>
          <option value="serapan-desc">Serapan: tertinggi ke terendah</option>
          <option value="serapan-asc">Serapan: terendah ke tertinggi</option>
        </select></label>
        <div className="grid gap-3">{institutions.map((institution) => {
          const divisions = groupBy(institution.rows, (row) => row.bidang_id, (row) => row.bidang);
          return <section key={institution.id} className="grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-3">
            <SummaryLine label={institution.nama} rows={institution.rows} />
            {divisions.map((division) => {
              const teams = groupBy(division.rows, (row) => row.tim_kerja_id, (row) => row.tim_kerja);
              return <details key={division.id} className="min-w-0 rounded-lg border border-[var(--border)] p-3">
                <summary className="cursor-pointer"><strong>{division.nama}</strong><span className="ml-2 text-sm text-[var(--muted)]">{division.rows.length} proker dievaluasi</span></summary>
                <div className="mt-2"><SummaryLine label="Ringkasan bidang" rows={division.rows} /></div>
                <div className="mt-3 grid gap-2">{teams.map((team) => <details key={team.id} className="min-w-0 rounded border border-[var(--border)] p-3">
                  <summary className="cursor-pointer"><strong>{team.nama}</strong><span className="ml-2 text-sm text-[var(--muted)]">{team.rows.length} proker dievaluasi</span></summary>
                  <div className="mt-2"><SummaryLine label="Ringkasan tim kerja" rows={team.rows} /></div>
                  <div className="mt-3 min-w-0 overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full min-w-[720px] text-left text-sm"><thead><tr>{['Proker','Rencana','Realisasi','Selisih','Serapan'].map((heading) => <th key={heading} scope="col" className="border-b border-[var(--border)] p-2">{heading}</th>)}</tr></thead>
                      <tbody>{sortBudgetRows(team.rows, sort).map((row) => {
                        const summary = summarizeBudget([row]);
                        return <tr key={row.proker_id} className="align-top"><th scope="row" className="max-w-sm border-b border-[var(--border)] p-2 font-medium">{row.nama_kegiatan}</th><td className="border-b border-[var(--border)] p-2">{formatRupiah(summary.rencana)}</td><td className="border-b border-[var(--border)] p-2">{formatRupiah(summary.realisasi)}</td><td className="border-b border-[var(--border)] p-2">{formatSelisihRupiah(summary.selisih)}</td><td className="border-b border-[var(--border)] p-2">{summary.serapan === null ? '—' : <>{summary.serapan.toFixed(2)}%{summary.serapan > 100 && <span className="block font-semibold text-red-800 dark:text-red-300">Melebihi rencana</span>}</>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                </details>)}</div>
              </details>;
            })}
          </section>;
        })}</div>
      </>}
    </>}
  </div>;
}

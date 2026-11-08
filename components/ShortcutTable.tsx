"use client";
import { CheckCircle2 } from "lucide-react";
import { useProgress } from "./Providers";
import { SHORTCUTS, prettyCombo } from "@/lib/shortcuts";

export function ShortcutTable() {
  const { state } = useProgress();
  const learned = SHORTCUTS.filter((s) => state.shortcuts[s.id]?.learned).length;
  return (
    <section aria-labelledby="all">
      <h2 id="all">All 40 core shortcuts</h2>
      <p className="mt-1 text-neutral-700">You have pressed {learned} of 40 correctly at least once.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left card border-collapse" style={{ minWidth: 560 }}>
          <caption className="sr-only">Excel shortcuts for Windows and Mac</caption>
          <thead>
            <tr className="bg-neutral-100">
              <th scope="col" className="p-2">What it does</th>
              <th scope="col" className="p-2">Windows</th>
              <th scope="col" className="p-2">Mac</th>
              <th scope="col" className="p-2">Your speed</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((s) => {
              const st = state.shortcuts[s.id];
              return (
                <tr key={s.id} className="border-t border-neutral-200">
                  <th scope="row" className="p-2 font-normal">{s.name}</th>
                  <td className="p-2"><kbd className="font-mono text-sm">{prettyCombo(s.windows, "windows")}</kbd></td>
                  <td className="p-2"><kbd className="font-mono text-sm">{prettyCombo(s.mac, "mac")}</kbd></td>
                  <td className="p-2 text-sm text-neutral-700">{st?.learned ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={20} className="text-success" aria-hidden /> {(st.avgMs / 1000).toFixed(1)} s</span> : "Not yet"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-neutral-700">Ctrl+W, Ctrl+N, Ctrl+PageDown and a few others are reserved by browsers, so the trainer asks you to pick them rather than press them.</p>
    </section>
  );
}

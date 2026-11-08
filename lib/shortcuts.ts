import data from "@/content/shortcuts/shortcuts.json";

export type Shortcut = {
  id: string; name: string; prompt: string; windows: string; mac: string;
  reservedWindows: boolean; reservedMac: boolean; category: string;
};
export type Platform = "windows" | "mac";

export const SHORTCUTS = data as Shortcut[];

const KEY_NAMES: Record<string, string> = {
  ArrowDown: "down", ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right", Space: "space", Escape: "escape", Enter: "enter",
  NumpadEnter: "enter", PageDown: "pagedown", PageUp: "pageup", Backquote: "`", Semicolon: ";", Equal: "=", Minus: "-",
  Home: "home", End: "end", Tab: "tab", Backspace: "backspace", Delete: "delete",
};

/** Turn a keyboard event into the same string format as the shortcut data, independent of keyboard layout quirks. */
export function eventToCombo(e: { code: string; key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code.toLowerCase();
  else if (KEY_NAMES[e.code]) key = KEY_NAMES[e.code];
  if (!key) return null; // a lone modifier key
  const mods = [e.ctrlKey && "ctrl", e.metaKey && "cmd", e.altKey && "alt", e.shiftKey && "shift"].filter(Boolean) as string[];
  return [...mods, key].join("+");
}

export function comboFor(s: Shortcut, p: Platform) {
  return p === "mac" ? s.mac : s.windows;
}
export function isReserved(s: Shortcut, p: Platform) {
  return p === "mac" ? s.reservedMac : s.reservedWindows;
}

const PRETTY: Record<string, string> = { ctrl: "Ctrl", cmd: "Cmd", alt: "Alt", shift: "Shift", space: "Space", down: "Down", up: "Up", left: "Left", right: "Right", escape: "Esc", enter: "Enter", pagedown: "Page Down", pageup: "Page Up" };
export function prettyCombo(combo: string, p: Platform): string {
  return combo.split("+").map((k) => {
    if (p === "mac" && k === "ctrl") return "Control";
    if (p === "mac" && k === "alt") return "Option";
    if (p === "mac" && k === "cmd") return "Cmd";
    return PRETTY[k] ?? (k.length === 1 ? k.toUpperCase() : k.toUpperCase());
  }).join(" + ");
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "mac" : "windows";
}

/** Distractor combos for the confirm-by-button exercise used for browser-reserved shortcuts. */
export function choicesFor(s: Shortcut, p: Platform, all: Shortcut[], seed: number): string[] {
  const right = comboFor(s, p);
  const others = all.filter((x) => x.id !== s.id).map((x) => comboFor(x, p)).filter((c, i, a) => c !== right && a.indexOf(c) === i);
  const picks: string[] = [];
  for (let i = 0; picks.length < 2 && i < others.length; i++) picks.push(others[(seed * 7 + i * 13) % others.length]);
  const uniq = [...new Set(picks)].slice(0, 2);
  const choices = [right, ...uniq];
  const rot = seed % choices.length;
  return [...choices.slice(rot), ...choices.slice(0, rot)];
}

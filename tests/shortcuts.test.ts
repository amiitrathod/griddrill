import { describe, it, expect } from "vitest";
import { SHORTCUTS, eventToCombo, choicesFor, prettyCombo } from "../lib/shortcuts";

const ev = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ code, key: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

describe("shortcut trainer data", () => {
  it("has 40 shortcuts, each with a Windows and a Mac variant", () => {
    expect(SHORTCUTS.length).toBe(40);
    for (const s of SHORTCUTS) {
      expect(s.windows).toBeTruthy();
      expect(s.mac).toBeTruthy();
    }
  });
  it("ids are unique", () => expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(40));
  it("flags the browser-reserved shortcuts (Ctrl+W, Ctrl+N and similar)", () => {
    const reserved = SHORTCUTS.filter((s) => s.reservedWindows).map((s) => s.windows);
    expect(reserved).toContain("ctrl+w");
    expect(reserved).toContain("ctrl+n");
  });
});
describe("eventToCombo", () => {
  it("reads letters", () => expect(eventToCombo(ev("KeyC", { ctrlKey: true }))).toBe("ctrl+c"));
  it("reads shift plus a digit by key position, not by the symbol it types", () => expect(eventToCombo(ev("Digit4", { ctrlKey: true, shiftKey: true }))).toBe("ctrl+shift+4"));
  it("reads symbols and function keys", () => {
    expect(eventToCombo(ev("Equal", { altKey: true }))).toBe("alt+=");
    expect(eventToCombo(ev("F4"))).toBe("f4");
    expect(eventToCombo(ev("Backquote", { ctrlKey: true }))).toBe("ctrl+`");
  });
  it("ignores a lone modifier key", () => expect(eventToCombo(ev("ControlLeft", { ctrlKey: true }))).toBeNull());
  it("matches every non-reserved Windows shortcut it should", () => {
    expect(eventToCombo(ev("ArrowDown", { ctrlKey: true, shiftKey: true }))).toBe("ctrl+shift+down");
  });
});
describe("confirm-by-button choices", () => {
  it("always includes the right answer once and has 3 choices", () => {
    for (const s of SHORTCUTS.filter((x) => x.reservedWindows)) {
      const c = choicesFor(s, "windows", SHORTCUTS, 3);
      expect(c.filter((x) => x === s.windows).length).toBe(1);
      expect(c.length).toBe(3);
    }
  });
  it("prints Mac modifier names", () => expect(prettyCombo("ctrl+alt+enter", "mac")).toBe("Control + Option + Enter"));
});

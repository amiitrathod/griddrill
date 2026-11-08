"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Keyboard, Timer, User } from "lucide-react";

const ITEMS = [
  { href: "/lessons", label: "Lessons", Icon: BookOpen },
  { href: "/shortcuts", label: "Shortcuts", Icon: Keyboard },
  { href: "/practice", label: "Practice", Icon: Timer },
  { href: "/account", label: "Me", Icon: User },
];

export function MobileNav() {
  const path = usePathname();
  // The lesson screen holds the task, the grid and Check. Nothing else (PRD principle 1).
  if (/^\/lessons\/[^/]+/.test(path) || /^\/practice\/test\/[^/]+/.test(path)) return null;
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-neutral-200 grid grid-cols-4">
      {ITEMS.map(({ href, label, Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-sm ${on ? "text-primary font-semibold" : "text-neutral-700"}`} style={{ minHeight: 56, textDecoration: "none" }}>
            <Icon size={20} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/pt/admin", label: "Visão geral" },
  { href: "/pt/admin/channels", label: "Canais" },
  { href: "/pt/admin/users", label: "Usuários" },
  { href: "/pt/admin/reminders", label: "Lembretes" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="tabs" aria-label="Painel admin">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

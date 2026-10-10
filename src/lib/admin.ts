import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@/db/schema";
import { getUser } from "./auth";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}

export function isAdmin(user: User | null): boolean {
  return Boolean(user && isAdminEmail(user.email));
}

/** Returns the signed-in admin, or answers 404 so the panel stays invisible to everyone else. */
export async function requireAdmin(): Promise<User> {
  const user = await getUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}

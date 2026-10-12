"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";

// F-03: signed-out visitors are bounced to the login page.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  if (!ready || !user) return null;
  return <>{children}</>;
}

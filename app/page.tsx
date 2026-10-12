"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

// Entry: send signed-in users to their pages, everyone else to login.
export default function Home() {
  const { ready, user } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (ready) router.replace(user ? "/pages" : "/login");
  }, [ready, user, router]);
  return null;
}

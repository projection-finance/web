"use client";

import type React from "react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import MainLayout from "../components/layout/mainLayout";
import ErrorBoundary from "../components/ErrorBoundary";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session } = useSession();

  useEffect(() => {
    document.body.removeAttribute("data-new-gr-c-s-check-loaded");
    document.body.removeAttribute("data-gr-ext-installed");
  }, []);

  return (
    <ErrorBoundary userId={session?.user?.id}>
      <MainLayout>{children}</MainLayout>
    </ErrorBoundary>
  );
}

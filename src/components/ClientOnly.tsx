"use client";

import { useEffect, useState } from "react";
import type React from "react"; // Added import for React

export default function ClientOnly({
  children,
  ...delegated
}: {
  children: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <div {...delegated}>{children}</div>;
}

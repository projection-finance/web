import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Wallets — Projection Finance",
  description:
    "View your favorite wallets with live Aave health factors at a glance.",
};

export default function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

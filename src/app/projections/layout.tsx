import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Projections — Projection Finance",
  description:
    "View, load and manage your saved Aave V3 simulations. Resume any projection right where you left off.",
};

export default function ProjectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

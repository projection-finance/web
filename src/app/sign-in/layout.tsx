import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Projection Finance",
  description:
    "Sign in to Projection Finance to access your saved projections, Pro features and account settings.",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

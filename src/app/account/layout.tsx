import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account — Projection Finance",
  description:
    "Manage your Projection Finance account, subscription plan and preferences.",
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Projection Finance",
  description:
    "Get in touch with the Projection Finance team. Questions, feedback or partnership inquiries.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import ClientLayout from "./clientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://projection.finance"),
  title: {
    default: "Projection Finance",
    template: "%s | Projection Finance",
  },
  description: "Simulate and stress-test your Aave V3 positions before you act.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/projection-finance-square.png", type: "image/png" },
    ],
    apple: "/projection-finance-square.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="b8110873-7528-4b08-adee-512370906f2c"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.className} antialiased bg-slate-50`}>
        <SessionProvider>
          <ClientLayout>{children}</ClientLayout>
        </SessionProvider>
      </body>
    </html>
  );
}

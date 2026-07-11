import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "tclock",
  description: "Retro clock TUI ported to the web",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg)', fontFamily: 'var(--font-mono)' }}>
        {children}
      </body>
    </html>
  );
}

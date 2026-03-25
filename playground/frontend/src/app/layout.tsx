import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAM Audio Playground",
  description: "Isolate sounds using SAM Audio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UI-Finder",
  description:
    "Sketch a rough wireframe and find real, live websites whose sections match its layout structure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

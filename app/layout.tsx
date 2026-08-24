import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Severe Database Group Lookup",
  description: "Check a database-listed Roblox profile's membership in a Roblox group.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


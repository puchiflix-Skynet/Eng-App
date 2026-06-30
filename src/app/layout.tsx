import type { Metadata } from "next";
import { Orbitron, Outfit } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({ 
  subsets: ["latin"],
  variable: "--font-orbitron"
});
const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "Eng-Troubleshooting Guide(ETG)",
  description: "Mobile-first diagnostic wizard for operations troubleshooting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${outfit.variable} font-outfit antialiased`}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "../components/NavBar";
import { ToastProvider } from "../components/Providers";
import { isLoggedInServer } from "../lib/server-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Task manager with microservice auth",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authed = await isLoggedInServer();
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-100 bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950">
        <ToastProvider initialAuthed={authed}>
          <NavBar initialAuthed={authed} />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
          <footer className="text-center text-xs text-slate-400 py-6">
            TaskFlow · {new Date().getFullYear()}
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

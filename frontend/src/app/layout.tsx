import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// A warm optical serif for the wordmark and headings. It carries most of the
// personality, so the interface does not read as a default template.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "Duka Akili | Grounded answers from your own business documents",
  description:
    "Ask questions in English or Kiswahili about your duka's contracts, staff handbook, pricing policy and KRA guide. Every answer cites the document it came from.",
  applicationName: "Duka Akili",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#14110d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Resolves the theme before first paint so there is no light flash on load.
const THEME_INIT = `(function(){try{var s=localStorage.getItem('duka-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s==='dark'||s==='light'?s:(m?'dark':'light'));}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

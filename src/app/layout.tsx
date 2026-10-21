import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { InactivityReload } from "./InactivityReload";

export const metadata: Metadata = {
  title: "A Danish Boy in Theresienstadt — A Drawn Testimony",
  description: "An interactive visual testimony following Steen Metz's memories of Theresienstadt.",
};

const inter = Inter({ weight: "400", subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={inter.className} lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oooh+Baby&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="grid overflow-hidden myText text-gray-950">
        <InactivityReload />
        {children}
      </body>
    </html>
  );
}

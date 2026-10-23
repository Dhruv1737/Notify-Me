import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Change Detector",
  description: "Get an email when a web page changes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={publicSans.className}>{children}</body>
    </html>
  );
}
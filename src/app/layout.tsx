import "./globals.css";
import Navbar from "./components/Navbar";
import BidsSample from "./samples/bids/page";
import { RidiBatang } from "./fonts";

export const metadata = {
  icons: {
    icon: "/mydea_favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head />
      <body className={RidiBatang.variable}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}

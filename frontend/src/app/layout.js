import "./globals.css";

export const metadata = {
  title: "Zenith Leave Hub - Enterprise Employee Leave Management System",
  description: "3-Tier Employee Leave Management System with FastAPI, Next.js, and PostgreSQL",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}

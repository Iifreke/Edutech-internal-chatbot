import './globals.css';
import { AuthProvider } from './context/AuthContext';

export const metadata = {
  title: 'EduAssist — Edutech Global AI Assistant',
  description: 'Your internal AI knowledge assistant for Edutech Global. Ask any question about the organization, products, and policies to get instant answers.',
  keywords: ['EduAssist', 'Edutech Global', 'AI Assistant', 'Knowledge Base', 'Internal Assistant'],
  icons: {
    icon: '/edutech-logo-white.png',
    shortcut: '/edutech-logo-white.png',
    apple: '/edutech-logo-white.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#111111" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

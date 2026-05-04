import './globals.css';

export const metadata = {
  title: 'Edutech Global — AI Assistant',
  description: 'Your intelligent knowledge base assistant for Edutech Global. Ask any question about the organization and get instant answers.',
  keywords: ['Edutech Global', 'AI Assistant', 'Knowledge Base', 'Onboarding'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0a1a" />
      </head>
      <body>{children}</body>
    </html>
  );
}

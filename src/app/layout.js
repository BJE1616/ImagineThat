import './globals.css'
import Navbar from '../components/Navbar'
import { ThemeProvider } from '@/lib/ThemeContext'

export const metadata = {
  title: 'ImagineThat - Creative Advertising Platform',
  description: 'Play games, win prizes, and advertise your business!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
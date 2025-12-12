import './globals.css'
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'ImagineThat - Creative Advertising Platform',
  description: 'Play games, win prizes, and advertise your business!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('is_admin')
                    .eq('id', authUser.id)
                    .single()

                setIsAdmin(userData?.is_admin || false)
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setIsAdmin(false)
        router.push('/game')
    }

    // Don't show navbar on admin pages (admin has its own sidebar)
    if (pathname?.startsWith('/admin')) {
        return null
    }

    return (
        <nav className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/game" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-lg">
                            IT
                        </div>
                        <span className="text-white font-bold text-xl hidden sm:block">ImagineThat</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link
                            href="/game"
                            className={`px-3 py-2 rounded-lg font-medium transition-all ${pathname === '/game'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            🎮 Play Game
                        </Link>

                        {user && (
                            <Link
                                href="/dashboard"
                                className={`px-3 py-2 rounded-lg font-medium transition-all ${pathname === '/dashboard'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                                    }`}
                            >
                                📊 Dashboard
                            </Link>
                        )}

                        {user && (
                            <Link
                                href="/cards"
                                className={`px-3 py-2 rounded-lg font-medium transition-all ${pathname === '/cards'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                                    }`}
                            >
                                🃏 My Cards
                            </Link>
                        )}

                        {isAdmin && (
                            <Link
                                href="/admin"
                                className="px-3 py-2 rounded-lg font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
                            >
                                ⚙️ Admin
                            </Link>
                        )}
                    </div>

                    {/* User Section */}
                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all"
                            >
                                Logout
                            </button>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="px-4 py-2 text-slate-300 hover:text-white transition-all"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-semibold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden p-2 text-slate-300 hover:text-white"
                    >
                        {menuOpen ? '✕' : '☰'}
                    </button>
                </div>

                {/* Mobile Menu */}
                {menuOpen && (
                    <div className="md:hidden py-4 border-t border-slate-700">
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/game"
                                onClick={() => setMenuOpen(false)}
                                className={`px-3 py-2 rounded-lg font-medium ${pathname === '/game'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-slate-300'
                                    }`}
                            >
                                🎮 Play Game
                            </Link>

                            {user && (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setMenuOpen(false)}
                                    className={`px-3 py-2 rounded-lg font-medium ${pathname === '/dashboard'
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'text-slate-300'
                                        }`}
                                >
                                    📊 Dashboard
                                </Link>
                            )}

                            {user && (
                                <Link
                                    href="/cards"
                                    onClick={() => setMenuOpen(false)}
                                    className={`px-3 py-2 rounded-lg font-medium ${pathname === '/cards'
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'text-slate-300'
                                        }`}
                                >
                                    🃏 My Cards
                                </Link>
                            )}

                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMenuOpen(false)}
                                    className="px-3 py-2 rounded-lg font-medium text-amber-400"
                                >
                                    ⚙️ Admin
                                </Link>
                            )}

                            <div className="border-t border-slate-700 mt-2 pt-2">
                                {user ? (
                                    <button
                                        onClick={() => {
                                            handleLogout()
                                            setMenuOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-2 text-slate-300 rounded-lg"
                                    >
                                        Logout
                                    </button>
                                ) : (
                                    <>
                                        <Link
                                            href="/auth/login"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3 py-2 text-slate-300"
                                        >
                                            Login
                                        </Link>
                                        <Link
                                            href="/auth/register"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3 py-2 text-amber-400 font-semibold"
                                        >
                                            Sign Up
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
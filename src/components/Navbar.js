'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        checkUser()
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                const { data: userDataResult } = await supabase
                    .from('users')
                    .select('username, first_name, last_name, is_admin')
                    .eq('id', authUser.id)
                    .single()

                setUserData(userDataResult)
                setIsAdmin(userDataResult?.is_admin || false)
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setUserData(null)
        setIsAdmin(false)
        setDropdownOpen(false)
        router.push('/game')
    }

    const getFullName = () => {
        if (!userData) return ''
        const firstName = userData.first_name || ''
        const lastName = userData.last_name || ''
        if (firstName && lastName) {
            return `${firstName} ${lastName}`
        }
        return firstName || userData.username || ''
    }

    const getInitial = () => {
        if (!userData) return ''
        if (userData.first_name) {
            return userData.first_name.charAt(0).toUpperCase()
        }
        return userData.username?.charAt(0).toUpperCase() || ''
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

                        {user && (
                            <Link
                                href="/advertise"
                                className={`px-3 py-2 rounded-lg font-medium transition-all ${pathname === '/advertise'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                                    }`}
                            >
                                📢 Advertise
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
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600 hover:bg-slate-700 transition-all cursor-pointer"
                                >
                                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-sm">
                                        {getInitial()}
                                    </div>
                                    <span className="text-white font-medium">{getFullName()}</span>
                                    <svg
                                        className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-50">
                                        <div className="px-4 py-2 border-b border-slate-700">
                                            <p className="text-sm text-slate-400">Signed in as</p>
                                            <p className="text-white font-medium truncate">{getFullName()}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                                        >
                                            🚪 Logout
                                        </button>
                                    </div>
                                )}
                            </div>
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
                        {/* Mobile User Info */}
                        {user && userData && (
                            <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-slate-700/50 rounded-lg mx-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-sm">
                                    {getInitial()}
                                </div>
                                <span className="text-white font-medium">{getFullName()}</span>
                            </div>
                        )}

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

                            {user && (
                                <Link
                                    href="/advertise"
                                    onClick={() => setMenuOpen(false)}
                                    className={`px-3 py-2 rounded-lg font-medium ${pathname === '/advertise'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-slate-300'
                                        }`}
                                >
                                    📢 Advertise
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
                                        className="w-full text-left px-3 py-2 text-slate-300 rounded-lg hover:bg-slate-700"
                                    >
                                        🚪 Logout
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
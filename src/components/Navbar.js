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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUser(session.user)
                checkUser()
            } else {
                setUser(null)
                setUserData(null)
                setIsAdmin(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

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

    const getDisplayName = () => {
        if (!userData) return ''
        return userData.first_name || userData.username || ''
    }

    const getInitial = () => {
        if (!userData) return ''
        if (userData.first_name) {
            return userData.first_name.charAt(0).toUpperCase()
        }
        return userData.username?.charAt(0).toUpperCase() || ''
    }

    if (pathname?.startsWith('/admin')) {
        return null
    }

    return (
        <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex justify-between items-center h-12">
                    {/* Logo */}
                    <Link href="/game" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded flex items-center justify-center text-slate-900 font-bold text-xs">
                            IT
                        </div>
                        <span className="text-white font-semibold text-sm hidden sm:block">ImagineThat</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        <Link
                            href="/game"
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/game'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            Play Games
                        </Link>

                        {user && (
                            <>
                                <Link
                                    href="/dashboard"
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/dashboard'
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Dashboard
                                </Link>

                                <Link
                                    href="/advertise"
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/advertise'
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    Advertise
                                </Link>
                            </>
                        )}

                        {isAdmin && (
                            <Link
                                href="/admin"
                                className="px-3 py-1.5 rounded text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all"
                            >
                                Admin
                            </Link>
                        )}
                    </div>

                    {/* User Section */}
                    <div className="hidden md:flex items-center gap-3">
                        {user ? (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                        {getInitial()}
                                    </div>
                                    <span className="text-slate-300 text-sm">{getDisplayName()}</span>
                                    <svg
                                        className={`w-3 h-3 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded shadow-lg py-1 z-50">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-all"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="px-3 py-1.5 bg-amber-500 text-slate-900 font-semibold text-sm rounded hover:bg-amber-400 transition-all"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden p-1.5 text-slate-400 hover:text-white"
                    >
                        {menuOpen ? '✕' : '☰'}
                    </button>
                </div>

                {/* Mobile Menu */}
                {menuOpen && (
                    <div className="md:hidden py-2 border-t border-slate-800">
                        {user && userData && (
                            <div className="flex items-center gap-2 px-2 py-2 mb-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                    {getInitial()}
                                </div>
                                <span className="text-white text-sm">{getDisplayName()}</span>
                            </div>
                        )}

                        <div className="flex flex-col">
                            <Link
                                href="/game"
                                onClick={() => setMenuOpen(false)}
                                className={`px-2 py-2 text-sm font-medium ${pathname === '/game' ? 'text-amber-400' : 'text-slate-400'}`}
                            >
                                Play Games
                            </Link>

                            {user && (
                                <>
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setMenuOpen(false)}
                                        className={`px-2 py-2 text-sm font-medium ${pathname === '/dashboard' ? 'text-amber-400' : 'text-slate-400'}`}
                                    >
                                        Dashboard
                                    </Link>

                                    <Link
                                        href="/advertise"
                                        onClick={() => setMenuOpen(false)}
                                        className={`px-2 py-2 text-sm font-medium ${pathname === '/advertise' ? 'text-amber-400' : 'text-slate-400'}`}
                                    >
                                        Advertise
                                    </Link>
                                </>
                            )}

                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMenuOpen(false)}
                                    className="px-2 py-2 text-sm font-medium text-amber-400"
                                >
                                    Admin
                                </Link>
                            )}

                            <div className="border-t border-slate-800 mt-2 pt-2">
                                {user ? (
                                    <button
                                        onClick={() => {
                                            handleLogout()
                                            setMenuOpen(false)
                                        }}
                                        className="w-full text-left px-2 py-2 text-sm text-slate-400"
                                    >
                                        Logout
                                    </button>
                                ) : (
                                    <>
                                        <Link
                                            href="/auth/login"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-2 py-2 text-sm text-slate-400"
                                        >
                                            Login
                                        </Link>
                                        <Link
                                            href="/auth/register"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-2 py-2 text-sm text-amber-400 font-semibold"
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
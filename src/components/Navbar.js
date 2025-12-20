'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [hasUnclaimedRewards, setHasUnclaimedRewards] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [gamesDropdownOpen, setGamesDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)
    const gamesDropdownRef = useRef(null)

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
                setHasUnclaimedRewards(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // Re-check for unclaimed rewards when route changes
    useEffect(() => {
        if (user) {
            const checkRewards = async () => {
                const { data: unclaimedRewards } = await supabase
                    .from('daily_leaderboard_results')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('claimed', false)
                    .limit(1)

                setHasUnclaimedRewards(unclaimedRewards && unclaimedRewards.length > 0)
            }
            checkRewards()
        }
    }, [pathname, user])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false)
            }
            if (gamesDropdownRef.current && !gamesDropdownRef.current.contains(event.target)) {
                setGamesDropdownOpen(false)
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

                // Check for unclaimed leaderboard rewards
                const { data: unclaimedRewards } = await supabase
                    .from('daily_leaderboard_results')
                    .select('id')
                    .eq('user_id', authUser.id)
                    .eq('claimed', false)
                    .limit(1)

                setHasUnclaimedRewards(unclaimedRewards && unclaimedRewards.length > 0)
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
        setHasUnclaimedRewards(false)
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

    const isGamesPage = pathname === '/game' || pathname === '/slots' || pathname === '/card-gallery'

    if (pathname?.startsWith('/admin')) {
        return null
    }

    // Badge component for unclaimed rewards
    const RewardBadge = () => (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 animate-pulse shadow-lg shadow-red-500/50"
            style={{ borderColor: currentTheme.mode === 'dark' ? '#1e293b' : '#ffffff', boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.6)' }} />
    )

    return (
        <nav className={`bg-${currentTheme.bg} border-b border-${currentTheme.card} sticky top-0 z-50`}>
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex justify-between items-center h-12">
                    {/* Logo */}
                    <Link href="/game" className="flex items-center gap-2">
                        <div className={`w-7 h-7 bg-gradient-to-br from-${currentTheme.accentHover} to-orange-500 rounded flex items-center justify-center text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold text-xs`}>
                            IT
                        </div>
                        <span className={`text-${currentTheme.text} font-semibold text-sm hidden sm:block`}>ImagineThat</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {/* Games Dropdown */}
                        <div className="relative" ref={gamesDropdownRef}>
                            <button
                                onClick={() => setGamesDropdownOpen(!gamesDropdownOpen)}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-1 relative ${isGamesPage
                                    ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                    : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                    }`}
                            >
                                Games
                                {hasUnclaimedRewards && <RewardBadge />}
                                <svg
                                    className={`w-3 h-3 transition-transform ${gamesDropdownOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {gamesDropdownOpen && (
                                <div className={`absolute left-0 mt-1 w-44 bg-${currentTheme.card} border border-${currentTheme.border} rounded shadow-lg py-1 z-50`}>
                                    <Link
                                        href="/game"
                                        onClick={() => setGamesDropdownOpen(false)}
                                        className={`block px-3 py-2 text-sm transition-all ${pathname === '/game'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🎮 Match Game
                                    </Link>
                                    <Link
                                        href="/card-gallery"
                                        onClick={() => setGamesDropdownOpen(false)}
                                        className={`block px-3 py-2 text-sm transition-all ${pathname === '/card-gallery'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🖼️ Card Gallery
                                    </Link>
                                    <Link
                                        href="/slots"
                                        onClick={() => setGamesDropdownOpen(false)}
                                        className={`block px-3 py-2 text-sm transition-all relative ${pathname === '/slots'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🎰 Slots
                                        {hasUnclaimedRewards && (
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                                                Reward!
                                            </span>
                                        )}
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Store Link */}
                        <Link
                            href="/merch"
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/merch'
                                ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                }`}
                        >
                            🛍️ Store
                        </Link>

                        {user && (
                            <>
                                <Link
                                    href="/dashboard"
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/dashboard'
                                        ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                        }`}
                                >
                                    Dashboard
                                </Link>

                                <Link
                                    href="/advertise"
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${pathname === '/advertise'
                                        ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                        }`}
                                >
                                    Advertise
                                </Link>
                            </>
                        )}

                        {isAdmin && (
                            <Link
                                href="/admin"
                                className={`px-3 py-1.5 rounded text-sm font-medium text-${currentTheme.accentHover} hover:bg-${currentTheme.accent}/10 transition-all`}
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
                                    className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-${currentTheme.card} transition-all cursor-pointer`}
                                >
                                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                        {getInitial()}
                                    </div>
                                    <span className={`text-${currentTheme.textMuted} text-sm`}>{getDisplayName()}</span>
                                    <svg
                                        className={`w-3 h-3 text-${currentTheme.textMuted} transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {dropdownOpen && (
                                    <div className={`absolute right-0 mt-1 w-40 bg-${currentTheme.card} border border-${currentTheme.border} rounded shadow-lg py-1 z-50`}>
                                        <button
                                            onClick={handleLogout}
                                            className={`w-full text-left px-3 py-1.5 text-sm text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text} transition-all`}
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
                                    className={`px-3 py-1.5 text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} transition-all`}
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className={`px-3 py-1.5 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-semibold text-sm rounded hover:bg-${currentTheme.accentHover} transition-all`}
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className={`md:hidden p-1.5 text-${currentTheme.textMuted} hover:text-${currentTheme.text} relative`}
                    >
                        {menuOpen ? '✕' : '☰'}
                        {hasUnclaimedRewards && !menuOpen && <RewardBadge />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {menuOpen && (
                    <div className={`md:hidden py-2 border-t border-${currentTheme.card}`}>
                        {user && userData && (
                            <div className="flex items-center gap-2 px-2 py-2 mb-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                    {getInitial()}
                                </div>
                                <span className={`text-${currentTheme.text} text-sm`}>{getDisplayName()}</span>
                            </div>
                        )}

                        <div className="flex flex-col">
                            {/* Games Section */}
                            <div className={`px-2 py-1 text-xs font-semibold text-${currentTheme.textMuted} uppercase tracking-wide`}>Games</div>
                            <Link
                                href="/game"
                                onClick={() => setMenuOpen(false)}
                                className={`px-4 py-2 text-sm font-medium ${pathname === '/game' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                            >
                                🎮 Match Game
                            </Link>
                            <Link
                                href="/card-gallery"
                                onClick={() => setMenuOpen(false)}
                                className={`px-4 py-2 text-sm font-medium ${pathname === '/card-gallery' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                            >
                                🖼️ Card Gallery
                            </Link>
                            <Link
                                href="/slots"
                                onClick={() => setMenuOpen(false)}
                                className={`px-4 py-2 text-sm font-medium flex items-center ${pathname === '/slots' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                            >
                                🎰 Slots
                                {hasUnclaimedRewards && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                                        Reward!
                                    </span>
                                )}
                            </Link>

                            <div className={`border-t border-${currentTheme.card} mt-2 pt-2`}></div>

                            {/* Store Link */}
                            <Link
                                href="/merch"
                                onClick={() => setMenuOpen(false)}
                                className={`px-2 py-2 text-sm font-medium ${pathname === '/merch' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                            >
                                🛍️ Store
                            </Link>

                            {user && (
                                <>
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setMenuOpen(false)}
                                        className={`px-2 py-2 text-sm font-medium ${pathname === '/dashboard' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                                    >
                                        Dashboard
                                    </Link>

                                    <Link
                                        href="/advertise"
                                        onClick={() => setMenuOpen(false)}
                                        className={`px-2 py-2 text-sm font-medium ${pathname === '/advertise' ? `text-${currentTheme.accentHover}` : `text-${currentTheme.textMuted}`}`}
                                    >
                                        Advertise
                                    </Link>
                                </>
                            )}

                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMenuOpen(false)}
                                    className={`px-2 py-2 text-sm font-medium text-${currentTheme.accentHover}`}
                                >
                                    Admin
                                </Link>
                            )}

                            <div className={`border-t border-${currentTheme.card} mt-2 pt-2`}>
                                {user ? (
                                    <button
                                        onClick={() => {
                                            handleLogout()
                                            setMenuOpen(false)
                                        }}
                                        className={`w-full text-left px-2 py-2 text-sm text-${currentTheme.textMuted}`}
                                    >
                                        Logout
                                    </button>
                                ) : (
                                    <>
                                        <Link
                                            href="/auth/login"
                                            onClick={() => setMenuOpen(false)}
                                            className={`block px-2 py-2 text-sm text-${currentTheme.textMuted}`}
                                        >
                                            Login
                                        </Link>
                                        <Link
                                            href="/auth/register"
                                            onClick={() => setMenuOpen(false)}
                                            className={`block px-2 py-2 text-sm text-${currentTheme.accentHover} font-semibold`}
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
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
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [gamesDropdownOpen, setGamesDropdownOpen] = useState(false)
    const [advertiseDropdownOpen, setAdvertiseDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)
    const gamesDropdownRef = useRef(null)
    const advertiseDropdownRef = useRef(null)

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
            if (advertiseDropdownRef.current && !advertiseDropdownRef.current.contains(event.target)) {
                setAdvertiseDropdownOpen(false)
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

    const isGamesPage = pathname === '/game' || pathname === '/slots' || pathname === '/card-gallery' || pathname === '/solitaire'
    const isAdvertisePage = pathname === '/advertise'

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
            <div className="max-w-6xl mx-auto px-2 sm:px-4">
                <div className="flex justify-between items-center h-12">
                    {/* Logo - Glowing Text */}
                    <Link href="/" className="flex items-center shrink-0">
                        <span
                            className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-teal-400 bg-clip-text text-transparent"
                            style={{
                                textShadow: '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(236, 72, 153, 0.3), 0 0 60px rgba(20, 184, 166, 0.2)',
                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))'
                            }}
                        >
                            ImagineThat.icu
                        </span>
                    </Link>

                    {/* Navigation - Always visible, condensed on mobile */}
                    <div className="flex items-center gap-0.5 sm:gap-1">
                        {/* Games Dropdown - Hover */}
                        <div
                            className="relative"
                            ref={gamesDropdownRef}
                            onMouseEnter={() => {
                                setGamesDropdownOpen(true)
                                setAdvertiseDropdownOpen(false)
                                setDropdownOpen(false)
                            }}
                            onMouseLeave={() => setGamesDropdownOpen(false)}
                        >
                            <button
                                className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-all flex items-center gap-0.5 sm:gap-1 relative ${isGamesPage
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
                                <div className={`absolute left-0 mt-0 w-56 bg-${currentTheme.card} border border-${currentTheme.border} rounded shadow-lg py-1 z-50`}>
                                    <Link
                                        href="/game"
                                        className={`block px-3 py-2 text-sm transition-all ${pathname === '/game'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🃏 Memory Match Cards
                                    </Link>
                                    <Link
                                        href="/solitaire"
                                        className={`block px-3 py-2 text-sm transition-all ${pathname === '/solitaire'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🃏 Solitaire
                                    </Link>
                                    <Link
                                        href="/slots"
                                        className={`block px-3 py-2 text-sm transition-all relative ${pathname === '/slots'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🎰 Slot Machine
                                        {hasUnclaimedRewards && (
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                                                Reward!
                                            </span>
                                        )}
                                    </Link>
                                    <div className={`border-t border-${currentTheme.border} my-1`}></div>
                                    <Link
                                        href="/card-gallery"
                                        className={`block px-3 py-2 text-sm transition-all ${pathname === '/card-gallery'
                                            ? `text-${currentTheme.accentHover} bg-${currentTheme.accent}/10`
                                            : `text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`
                                            }`}
                                    >
                                        🎁 Card Gallery
                                        <span className={`block text-xs text-green-500`}>Earn Free Tokens!</span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Advertise Dropdown - Hover */}
                        <div
                            className="relative"
                            ref={advertiseDropdownRef}
                            onMouseEnter={() => {
                                setAdvertiseDropdownOpen(true)
                                setGamesDropdownOpen(false)
                                setDropdownOpen(false)
                            }}
                            onMouseLeave={() => setAdvertiseDropdownOpen(false)}
                        >
                            <button
                                className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-all flex items-center gap-0.5 sm:gap-1 ${isAdvertisePage
                                    ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                    : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                    }`}
                            >
                                Advertise
                                <svg
                                    className={`w-3 h-3 transition-transform ${advertiseDropdownOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {advertiseDropdownOpen && (
                                <div className={`absolute left-0 sm:left-auto sm:right-0 mt-0 w-56 bg-${currentTheme.card} border border-${currentTheme.border} rounded shadow-lg py-1 z-50`}>
                                    <Link
                                        href="/advertise"
                                        className={`block px-3 py-2 text-sm transition-all text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`}
                                    >
                                        📢 How It Works
                                    </Link>
                                    <Link
                                        href="/advertise/pricing"
                                        className={`block px-3 py-2 text-sm transition-all text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`}
                                    >
                                        💵 Pricing
                                    </Link>
                                    <Link
                                        href="/advertise/matrix"
                                        className={`block px-3 py-2 text-sm transition-all text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`}
                                    >
                                        🔄 Referral Matrix
                                        <span className={`block text-xs text-green-500`}>Earn $200 Back!</span>
                                    </Link>
                                    <div className={`border-t border-${currentTheme.border} my-1`}></div>
                                    <Link
                                        href="/advertise/start"
                                        className={`block px-3 py-2 text-sm font-medium transition-all text-${currentTheme.accentHover} hover:bg-${currentTheme.accent}/10`}
                                    >
                                        🚀 Start a Campaign
                                    </Link>
                                    <div className={`border-t border-${currentTheme.border} my-1`}></div>
                                    <Link
                                        href="/faq"
                                        className={`block px-3 py-2 text-sm transition-all text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text}`}
                                    >
                                        FAQ's (Frequently Asked Questions)
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Logged-in only links */}
                        {user && (
                            <>
                                <Link
                                    href="/merch"
                                    className={`hidden sm:block px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-all ${pathname === '/merch'
                                        ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                        }`}
                                >
                                    Store
                                </Link>

                                <Link
                                    href="/dashboard"
                                    className={`hidden sm:block px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-all ${pathname === '/dashboard'
                                        ? `bg-${currentTheme.accent}/10 text-${currentTheme.accentHover}`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.card}`
                                        }`}
                                >
                                    Dashboard
                                </Link>
                            </>
                        )}

                        {isAdmin && (
                            <Link
                                href="/admin"
                                className={`hidden sm:block px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium text-${currentTheme.accentHover} hover:bg-${currentTheme.accent}/10 transition-all`}
                            >
                                Admin
                            </Link>
                        )}
                    </div>

                    {/* User Section */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {user ? (
                            <div
                                className="relative"
                                ref={dropdownRef}
                                onMouseEnter={() => {
                                    setDropdownOpen(true)
                                    setGamesDropdownOpen(false)
                                    setAdvertiseDropdownOpen(false)
                                }}
                                onMouseLeave={() => setDropdownOpen(false)}
                            >
                                <button
                                    className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1 rounded hover:bg-${currentTheme.card} transition-all cursor-pointer`}
                                >
                                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                        {getInitial()}
                                    </div>
                                    <span className={`hidden sm:inline text-${currentTheme.textMuted} text-sm`}>{getDisplayName()}</span>
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
                                    <div className={`absolute right-0 mt-0 w-40 bg-${currentTheme.card} border border-${currentTheme.border} rounded shadow-lg py-1 z-50`}>
                                        {/* Mobile-only links */}
                                        <Link
                                            href="/merch"
                                            className={`sm:hidden block px-3 py-1.5 text-sm text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text} transition-all`}
                                        >
                                            🛍️ Store
                                        </Link>
                                        <Link
                                            href="/dashboard"
                                            className={`sm:hidden block px-3 py-1.5 text-sm text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text} transition-all`}
                                        >
                                            Dashboard
                                        </Link>
                                        {isAdmin && (
                                            <Link
                                                href="/admin"
                                                className={`sm:hidden block px-3 py-1.5 text-sm text-${currentTheme.accentHover} hover:bg-${currentTheme.border} transition-all`}
                                            >
                                                Admin
                                            </Link>
                                        )}
                                        <div className={`sm:hidden border-t border-${currentTheme.border} my-1`}></div>
                                        <Link
                                            href="/profile"
                                            className={`block px-3 py-1.5 text-sm text-${currentTheme.textMuted} hover:bg-${currentTheme.border} hover:text-${currentTheme.text} transition-all`}
                                        >
                                            ⚙️ Profile
                                        </Link>
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
                                    className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} transition-all`}
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className={`px-2 sm:px-3 py-1.5 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-semibold text-xs sm:text-sm rounded hover:bg-${currentTheme.accentHover} transition-all`}
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import Link from 'next/link'

export default function MyStatsPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState('today')

    // Stats state
    const [cardGalleryStats, setCardGalleryStats] = useState({
        viewsToday: 0,
        tokensEarnedToday: 0,
        entriesEarnedToday: 0,
        dailyLimit: 50,
        totalViews: 0,
        totalTokensEarned: 0,
        totalEntriesEarned: 0
    })

    const [slotsStats, setSlotsStats] = useState({
        spinsToday: 0,
        freeSpinsUsed: 0,
        paidSpins: 0,
        tokensWonToday: 0,
        tokensWageredToday: 0,
        entriesEarnedToday: 0,
        cardDisplaysToday: 0, // spins * 3 reels
        totalSpins: 0,
        totalTokensWon: 0
    })

    const [solitaireStats, setSolitaireStats] = useState({
        gamesPlayedToday: 0,
        gamesWonToday: 0,
        bannerAdsSeenToday: 0,
        cardBackAdsSeenToday: 0,
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        bestTime: null,
        bestScore: null
    })

    const [tokenBalance, setTokenBalance] = useState({
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0
    })

    const [weeklyEntries, setWeeklyEntries] = useState(0)

    useEffect(() => {
        checkUser()
    }, [])

    useEffect(() => {
        if (user) {
            loadAllStats()
        }
    }, [user, timeRange])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/auth/login')
                return
            }

            setUser(authUser)
        } catch (error) {
            console.error('Error checking user:', error)
            router.push('/auth/login')
        }
    }

    const getDateFilter = () => {
        const now = new Date()
        switch (timeRange) {
            case 'today':
                return now.toISOString().split('T')[0]
            case 'week':
                const weekAgo = new Date(now)
                weekAgo.setDate(weekAgo.getDate() - 7)
                return weekAgo.toISOString().split('T')[0]
            case 'month':
                const monthAgo = new Date(now)
                monthAgo.setMonth(monthAgo.getMonth() - 1)
                return monthAgo.toISOString().split('T')[0]
            case 'all':
            default:
                return null
        }
    }

    const loadAllStats = async () => {
        setLoading(true)
        await Promise.all([
            loadCardGalleryStats(),
            loadSlotsStats(),
            loadSolitaireStats(),
            loadTokenBalance(),
            loadWeeklyEntries(),
            loadGameSettings()
        ])
        setLoading(false)
    }

    const loadGameSettings = async () => {
        try {
            const { data } = await supabase
                .from('game_bb_settings')
                .select('daily_bb_cap')
                .eq('game_key', 'card_gallery')
                .maybeSingle()

            if (data) {
                setCardGalleryStats(prev => ({ ...prev, dailyLimit: data.daily_bb_cap || 50 }))
            }
        } catch (error) {
            console.log('Error loading game settings')
        }
    }

    const loadCardGalleryStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]
            const dateFilter = getDateFilter()

            // Today's stats
            const { data: todayData } = await supabase
                .from('user_daily_activity')
                .select('play_count, bb_earned, entries_earned')
                .eq('user_id', user.id)
                .eq('game_key', 'card_gallery')
                .eq('activity_date', today)
                .maybeSingle()

            // Total/range stats
            let query = supabase
                .from('user_daily_activity')
                .select('play_count, bb_earned, entries_earned')
                .eq('user_id', user.id)
                .eq('game_key', 'card_gallery')

            if (dateFilter && timeRange !== 'today') {
                query = query.gte('activity_date', dateFilter)
            }

            const { data: rangeData } = await query

            const totals = rangeData?.reduce((acc, day) => ({
                views: acc.views + (day.play_count || 0),
                tokens: acc.tokens + (day.bb_earned || 0),
                entries: acc.entries + (day.entries_earned || 0)
            }), { views: 0, tokens: 0, entries: 0 }) || { views: 0, tokens: 0, entries: 0 }

            setCardGalleryStats(prev => ({
                ...prev,
                viewsToday: todayData?.play_count || 0,
                tokensEarnedToday: todayData?.bb_earned || 0,
                entriesEarnedToday: todayData?.entries_earned || 0,
                totalViews: totals.views,
                totalTokensEarned: totals.tokens,
                totalEntriesEarned: totals.entries
            }))
        } catch (error) {
            console.error('Error loading card gallery stats:', error)
        }
    }

    const loadSlotsStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]
            const dateFilter = getDateFilter()

            // Today's stats
            const { data: todayData } = await supabase
                .from('user_daily_spins')
                .select('free_spins_used, paid_spins, tokens_won, tokens_wagered, drawing_entries')
                .eq('user_id', user.id)
                .eq('spin_date', today)
                .maybeSingle()

            // Total/range stats
            let query = supabase
                .from('user_daily_spins')
                .select('free_spins_used, paid_spins, tokens_won, tokens_wagered, drawing_entries')
                .eq('user_id', user.id)

            if (dateFilter && timeRange !== 'today') {
                query = query.gte('spin_date', dateFilter)
            }

            const { data: rangeData } = await query

            const totals = rangeData?.reduce((acc, day) => ({
                spins: acc.spins + (day.free_spins_used || 0) + (day.paid_spins || 0),
                tokensWon: acc.tokensWon + (day.tokens_won || 0),
                tokensWagered: acc.tokensWagered + (day.tokens_wagered || 0),
                entries: acc.entries + (day.drawing_entries || 0)
            }), { spins: 0, tokensWon: 0, tokensWagered: 0, entries: 0 }) || { spins: 0, tokensWon: 0, tokensWagered: 0, entries: 0 }

            const todaySpins = (todayData?.free_spins_used || 0) + (todayData?.paid_spins || 0)

            setSlotsStats({
                spinsToday: todaySpins,
                freeSpinsUsed: todayData?.free_spins_used || 0,
                paidSpins: todayData?.paid_spins || 0,
                tokensWonToday: todayData?.tokens_won || 0,
                tokensWageredToday: todayData?.tokens_wagered || 0,
                entriesEarnedToday: todayData?.drawing_entries || 0,
                cardDisplaysToday: todaySpins * 3, // 3 cards per spin
                totalSpins: totals.spins,
                totalTokensWon: totals.tokensWon
            })
        } catch (error) {
            console.error('Error loading slots stats:', error)
        }
    }

    const loadSolitaireStats = async () => {
        try {
            // Get stats from user_game_stats table
            const { data: gameStats } = await supabase
                .from('user_game_stats')
                .select('*')
                .eq('user_id', user.id)
                .eq('game_type', 'solitaire')
                .maybeSingle()

            // Get today's games from solitaire_scores
            const today = new Date().toISOString().split('T')[0]
            const { data: todayGames } = await supabase
                .from('solitaire_scores')
                .select('id, won')
                .eq('user_id', user.id)
                .gte('created_at', today)

            const todayPlayed = todayGames?.length || 0
            const todayWon = todayGames?.filter(g => g.won)?.length || 0

            // Estimate ads seen (8 banner ads per game, ~30 card backs shown per game)
            const bannerAdsToday = todayPlayed * 8
            const cardBackAdsToday = todayPlayed * 30

            setSolitaireStats({
                gamesPlayedToday: todayPlayed,
                gamesWonToday: todayWon,
                bannerAdsSeenToday: bannerAdsToday,
                cardBackAdsSeenToday: cardBackAdsToday,
                totalGamesPlayed: gameStats?.games_played || 0,
                totalGamesWon: gameStats?.games_won || 0,
                bestTime: gameStats?.best_time_seconds,
                bestScore: gameStats?.best_score
            })
        } catch (error) {
            console.error('Error loading solitaire stats:', error)
        }
    }

    const loadTokenBalance = async () => {
        try {
            const { data } = await supabase
                .from('bb_balances')
                .select('balance, lifetime_earned, lifetime_spent')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data) {
                setTokenBalance({
                    balance: data.balance || 0,
                    lifetimeEarned: data.lifetime_earned || 0,
                    lifetimeSpent: data.lifetime_spent || 0
                })
            }
        } catch (error) {
            console.error('Error loading token balance:', error)
        }
    }

    const loadWeeklyEntries = async () => {
        try {
            const weekStart = getWeekStart()
            const { data } = await supabase
                .from('user_daily_spins')
                .select('drawing_entries')
                .eq('user_id', user.id)
                .gte('spin_date', weekStart.toISOString().split('T')[0])

            const total = data?.reduce((sum, day) => sum + (day.drawing_entries || 0), 0) || 0
            setWeeklyEntries(total)
        } catch (error) {
            console.error('Error loading weekly entries:', error)
        }
    }

    const getWeekStart = () => {
        const now = new Date()
        const day = now.getDay()
        const diff = now.getDate() - day
        const weekStart = new Date(now.setDate(diff))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    const formatTime = (seconds) => {
        if (!seconds) return '--:--'
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Calculate total engagement score
    const totalEngagement = cardGalleryStats.totalViews + 
        (slotsStats.totalSpins * 3) + 
        (solitaireStats.totalGamesPlayed * 38) // ~38 ad impressions per solitaire game

    const todayEngagement = cardGalleryStats.viewsToday + 
        slotsStats.cardDisplaysToday + 
        solitaireStats.bannerAdsSeenToday + 
        solitaireStats.cardBackAdsSeenToday

    if (loading && !user) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} flex items-center justify-center`}>
                <p className={`text-${currentTheme.text}`}>Loading...</p>
            </div>
        )
    }

    const timeOptions = [
        { value: 'today', label: 'Today' },
        { value: 'week', label: '7 Days' },
        { value: 'month', label: '30 Days' },
        { value: 'all', label: 'All Time' }
    ]

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-4 px-4`}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className={`text-xl font-bold text-${currentTheme.text}`}>📊 My Ad Stats</h1>
                        <p className={`text-${currentTheme.textMuted} text-sm`}>Your engagement across all games</p>
                    </div>
                    <div className="flex gap-1">
                        {timeOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setTimeRange(opt.value)}
                                className={`px-3 py-1 text-xs rounded-full transition-all ${
                                    timeRange === opt.value
                                        ? `bg-${currentTheme.accent} text-white font-bold`
                                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className={`bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-center`}>
                        <p className="text-yellow-400 text-2xl font-bold">🪙 {tokenBalance.balance}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Token Balance</p>
                    </div>
                    <div className={`bg-purple-500/20 border border-purple-500/50 rounded-lg p-3 text-center`}>
                        <p className="text-purple-400 text-2xl font-bold">🎟️ {weeklyEntries}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Weekly Entries</p>
                    </div>
                    <div className={`bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 text-center`}>
                        <p className="text-blue-400 text-2xl font-bold">👁️ {todayEngagement}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Ads Seen Today</p>
                    </div>
                    <div className={`bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-center`}>
                        <p className="text-green-400 text-2xl font-bold">⭐ {totalEngagement}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Engagement</p>
                    </div>
                </div>

                {/* Game Stats Grid */}
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Card Gallery */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className={`text-${currentTheme.text} font-bold`}>🖼️ Card Gallery</h2>
                            <Link href="/card-gallery" className={`text-${currentTheme.accent} text-xs hover:underline`}>
                                Play →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {/* Today's Progress */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className={`text-${currentTheme.textMuted}`}>Today's Views</span>
                                    <span className={`text-${currentTheme.text}`}>
                                        {cardGalleryStats.viewsToday}
                                    </span>
                                </div>
                            </div>

                            {/* Token Progress */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className={`text-${currentTheme.textMuted}`}>Tokens Earned Today</span>
                                    <span className="text-yellow-400">
                                        {cardGalleryStats.tokensEarnedToday}/{cardGalleryStats.dailyLimit}
                                    </span>
                                </div>
                                <div className={`h-2 bg-${currentTheme.border} rounded-full overflow-hidden`}>
                                    <div 
                                        className="h-full bg-yellow-500 transition-all"
                                        style={{ width: `${Math.min((cardGalleryStats.tokensEarnedToday / cardGalleryStats.dailyLimit) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Entries */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Entries Earned Today</span>
                                <span className="text-purple-400">🎟️ {cardGalleryStats.entriesEarnedToday}</span>
                            </div>

                            {/* Totals */}
                            <div className={`pt-2 border-t border-${currentTheme.border}`}>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>
                                    {timeRange === 'today' ? 'Today' : timeRange === 'all' ? 'All Time' : `Last ${timeRange === 'week' ? '7 days' : '30 days'}`}
                                </p>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className={`text-${currentTheme.text} font-bold`}>{cardGalleryStats.totalViews}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Views</p>
                                    </div>
                                    <div>
                                        <p className="text-yellow-400 font-bold">{cardGalleryStats.totalTokensEarned}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Tokens</p>
                                    </div>
                                    <div>
                                        <p className="text-purple-400 font-bold">{cardGalleryStats.totalEntriesEarned}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Entries</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slots */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className={`text-${currentTheme.text} font-bold`}>🎰 Slots</h2>
                            <Link href="/slots" className={`text-${currentTheme.accent} text-xs hover:underline`}>
                                Play →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {/* Today's Spins */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Spins Today</span>
                                <span className={`text-${currentTheme.text}`}>{slotsStats.spinsToday}</span>
                            </div>

                            {/* Breakdown */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Free / Paid</span>
                                <span className={`text-${currentTheme.text}`}>
                                    {slotsStats.freeSpinsUsed} / {slotsStats.paidSpins}
                                </span>
                            </div>

                            {/* Cards Displayed */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Ad Cards Seen Today</span>
                                <span className="text-blue-400">👁️ {slotsStats.cardDisplaysToday}</span>
                            </div>

                            {/* Tokens */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Tokens Won Today</span>
                                <span className="text-yellow-400">🪙 {slotsStats.tokensWonToday}</span>
                            </div>

                            {/* Entries */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Entries Earned Today</span>
                                <span className="text-purple-400">🎟️ {slotsStats.entriesEarnedToday}</span>
                            </div>

                            {/* Totals */}
                            <div className={`pt-2 border-t border-${currentTheme.border}`}>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>
                                    {timeRange === 'today' ? 'Today' : timeRange === 'all' ? 'All Time' : `Last ${timeRange === 'week' ? '7 days' : '30 days'}`}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <p className={`text-${currentTheme.text} font-bold`}>{slotsStats.totalSpins}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Total Spins</p>
                                    </div>
                                    <div>
                                        <p className="text-yellow-400 font-bold">{slotsStats.totalTokensWon}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Tokens Won</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Solitaire */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className={`text-${currentTheme.text} font-bold`}>🃏 Solitaire</h2>
                            <Link href="/solitaire" className={`text-${currentTheme.accent} text-xs hover:underline`}>
                                Play →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {/* Today's Games */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Games Today</span>
                                <span className={`text-${currentTheme.text}`}>
                                    {solitaireStats.gamesPlayedToday} ({solitaireStats.gamesWonToday} won)
                                </span>
                            </div>

                            {/* Banner Ads */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Banner Ads Seen</span>
                                <span className="text-blue-400">👁️ ~{solitaireStats.bannerAdsSeenToday}</span>
                            </div>

                            {/* Card Back Ads */}
                            <div className="flex justify-between text-xs">
                                <span className={`text-${currentTheme.textMuted}`}>Card Back Ads</span>
                                <span className="text-blue-400">👁️ ~{solitaireStats.cardBackAdsSeenToday}</span>
                            </div>

                            {/* Best Stats */}
                            {(solitaireStats.bestTime || solitaireStats.bestScore) && (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className={`text-${currentTheme.textMuted}`}>Best Time</span>
                                        <span className="text-green-400">⏱️ {formatTime(solitaireStats.bestTime)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className={`text-${currentTheme.textMuted}`}>Best Score</span>
                                        <span className="text-green-400">🏆 {solitaireStats.bestScore || '--'}</span>
                                    </div>
                                </>
                            )}

                            {/* Totals */}
                            <div className={`pt-2 border-t border-${currentTheme.border}`}>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>All Time</p>
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <p className={`text-${currentTheme.text} font-bold`}>{solitaireStats.totalGamesPlayed}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Games</p>
                                    </div>
                                    <div>
                                        <p className="text-green-400 font-bold">{solitaireStats.totalGamesWon}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Wins</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lifetime Stats */}
                <div className={`mt-4 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <h2 className={`text-${currentTheme.text} font-bold mb-3`}>📈 Lifetime Token Stats</h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-yellow-400 text-2xl font-bold">{tokenBalance.lifetimeEarned}</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Total Earned</p>
                        </div>
                        <div>
                            <p className="text-red-400 text-2xl font-bold">{tokenBalance.lifetimeSpent}</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Total Spent</p>
                        </div>
                        <div>
                            <p className={`text-${currentTheme.accent} text-2xl font-bold`}>{tokenBalance.balance}</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Current Balance</p>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className={`mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3`}>
                    <p className="text-blue-400 text-sm">
                        💡 <strong>Tip:</strong> The more ads you view, the more you support our advertisers and earn rewards! 
                        Each card view in the gallery is a chance to win tokens or drawing entries.
                    </p>
                </div>
            </div>
        </div>
    )
}

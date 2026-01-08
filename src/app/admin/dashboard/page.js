'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminDashboardPage() {
    const { currentTheme } = useTheme()
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsersThisWeek: 0,
        gamesThisWeek: 0,
        totalGamesAllTime: 0,
        pendingPayouts: 0,
        pendingAmount: 0,
        paidToday: 0,
        paidTodayAmount: 0,
        topScoreThisWeek: null
    })
    const [recentWinners, setRecentWinners] = useState([])
    const [loading, setLoading] = useState(true)

    // Detailed stats state
    const [detailedStats, setDetailedStats] = useState({
        users: { total: 0, admins: 0, regular: 0, thisWeek: 0, thisMonth: 0 },
        campaigns: { total: 0, active: 0, queued: 0, pending: 0, completed: 0, cancelled: 0, thisWeek: 0, thisMonth: 0 },
        cards: { total: 0, regular: 0, house: 0, inUse: 0 },
        views: { total: 0, fromGame: 0, fromFlips: 0, fromCardBack: 0 }
    })
    const [showDetailedStats, setShowDetailedStats] = useState(false)
    const [detailedLoading, setDetailedLoading] = useState(false)
    const [detailedOpen, setDetailedOpen] = useState({
        users: false,
        campaigns: false,
        cards: false,
        views: false
    })

    useEffect(() => {
        loadDashboardData()
    }, [])

    const getWeekStart = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart.toISOString().split('T')[0]
    }

    const loadDashboardData = async () => {
        try {
            const weekStart = getWeekStart()
            const today = new Date().toISOString().split('T')[0]

            // Total users
            const { count: totalUsers } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })

            // Games this week
            const { data: weekGames, count: gamesThisWeek } = await supabase
                .from('leaderboard')
                .select('*', { count: 'exact' })
                .eq('week_start', weekStart)

            const uniquePlayers = weekGames ? [...new Set(weekGames.map(g => g.user_id))].length : 0

            // All-time games
            const { count: totalGamesAllTime } = await supabase
                .from('leaderboard')
                .select('*', { count: 'exact', head: true })

            // Pending payouts (from payout_queue)
            const { data: pendingPayouts } = await supabase
                .from('payout_queue')
                .select('amount')
                .eq('status', 'pending')

            const pendingCount = pendingPayouts?.length || 0
            const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

            // Paid today (from payout_history)
            const { data: paidToday } = await supabase
                .from('payout_history')
                .select('amount')
                .gte('paid_at', today)

            const paidTodayCount = paidToday?.length || 0
            const paidTodayAmount = paidToday?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

            // Top score this week
            const { data: topScore } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart)
                .order('score', { ascending: true })
                .limit(1)
                .single()

            // Recent winners
            const { data: winners } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart)
                .order('score', { ascending: true })
                .limit(5)

            let winnersWithUsers = []
            if (winners && winners.length > 0) {
                const userIds = winners.map(w => w.user_id)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email')
                    .in('id', userIds)

                winnersWithUsers = winners.map(w => ({
                    ...w,
                    user: usersData?.find(u => u.id === w.user_id) || { username: 'Unknown' }
                }))
            }

            setStats({
                totalUsers: totalUsers || 0,
                activeUsersThisWeek: uniquePlayers,
                gamesThisWeek: gamesThisWeek || 0,
                totalGamesAllTime: totalGamesAllTime || 0,
                pendingPayouts: pendingCount,
                pendingAmount: pendingAmount,
                paidToday: paidTodayCount,
                paidTodayAmount: paidTodayAmount,
                topScoreThisWeek: topScore?.score || null
            })

            setRecentWinners(winnersWithUsers)
        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadDetailedStats = async () => {
        if (detailedLoading) return
        setDetailedLoading(true)

        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        try {
            const [
                { data: users },
                { data: campaigns },
                { data: cards },
                { data: cardsInUse }
            ] = await Promise.all([
                supabase.from('users').select('id, is_admin, created_at'),
                supabase.from('ad_campaigns').select('id, status, views_from_game, views_from_flips, views_from_card_back, created_at'),
                supabase.from('business_cards').select('id, is_house_card'),
                supabase.from('ad_campaigns').select('business_card_id').in('status', ['active', 'queued'])
            ])

            const userStats = {
                total: users?.length || 0,
                admins: users?.filter(u => u.is_admin === true).length || 0,
                regular: users?.filter(u => u.is_admin !== true).length || 0,
                thisWeek: users?.filter(u => new Date(u.created_at) >= startOfWeek).length || 0,
                thisMonth: users?.filter(u => new Date(u.created_at) >= startOfMonth).length || 0
            }

            const campaignStats = {
                total: campaigns?.length || 0,
                active: campaigns?.filter(c => c.status === 'active').length || 0,
                queued: campaigns?.filter(c => c.status === 'queued').length || 0,
                pending: campaigns?.filter(c => c.status === 'pending_payment').length || 0,
                completed: campaigns?.filter(c => c.status === 'completed').length || 0,
                cancelled: campaigns?.filter(c => c.status === 'cancelled').length || 0,
                thisWeek: campaigns?.filter(c => new Date(c.created_at) >= startOfWeek).length || 0,
                thisMonth: campaigns?.filter(c => new Date(c.created_at) >= startOfMonth).length || 0
            }

            const uniqueCardsInUse = [...new Set(cardsInUse?.map(c => c.business_card_id) || [])]
            const cardStats = {
                total: cards?.length || 0,
                regular: cards?.filter(c => !c.is_house_card).length || 0,
                house: cards?.filter(c => c.is_house_card).length || 0,
                inUse: uniqueCardsInUse.length
            }

            const viewStats = {
                fromGame: campaigns?.reduce((sum, c) => sum + (c.views_from_game || 0), 0) || 0,
                fromFlips: campaigns?.reduce((sum, c) => sum + (c.views_from_flips || 0), 0) || 0,
                fromCardBack: campaigns?.reduce((sum, c) => sum + (c.views_from_card_back || 0), 0) || 0,
                total: 0
            }
            viewStats.total = viewStats.fromGame + viewStats.fromFlips + viewStats.fromCardBack

            setDetailedStats({
                users: userStats,
                campaigns: campaignStats,
                cards: cardStats,
                views: viewStats
            })
        } catch (error) {
            console.error('Error loading detailed stats:', error)
        } finally {
            setDetailedLoading(false)
        }
    }

    const toggleDetailedStats = () => {
        if (!showDetailedStats && !detailedLoading && detailedStats.users.total === 0) {
            loadDetailedStats()
        }
        setShowDetailedStats(!showDetailedStats)
    }

    const toggleDetailedSection = (section) => {
        setDetailedOpen(prev => ({ ...prev, [section]: !prev[section] }))
    }

    if (loading) {
        return (
            <div className="p-2">
                <div className="animate-pulse space-y-2">
                    <div className={`h-5 bg-${currentTheme.border} rounded w-32`}></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: '👥', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20', textColor: 'text-blue-400' },
        { label: 'Active This Week', value: stats.activeUsersThisWeek, icon: '🎮', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', textColor: 'text-green-400' },
        { label: 'Games This Week', value: stats.gamesThisWeek, icon: '🃏', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20', textColor: 'text-purple-400' },
        { label: 'Best Score', value: stats.topScoreThisWeek ?? '—', icon: '🏆', bgColor: `bg-${currentTheme.accent}/10`, borderColor: `border-${currentTheme.accent}/20`, textColor: `text-${currentTheme.accent}` },
        { label: 'Pending Payouts', value: `${stats.pendingPayouts} ($${stats.pendingAmount.toFixed(0)})`, icon: '⏳', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20', textColor: 'text-orange-400', alert: stats.pendingPayouts > 0 },
        { label: 'Paid Today', value: `${stats.paidToday} ($${stats.paidTodayAmount.toFixed(0)})`, icon: '✅', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', textColor: 'text-emerald-400' },
        { label: 'All-Time Games', value: stats.totalGamesAllTime, icon: '📊', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20', textColor: 'text-indigo-400' }
    ]

    function StatRow({ label, value, even }) {
        return (
            <div className={`flex justify-between px-2 py-1 ${even ? `bg-${currentTheme.card}` : `bg-${currentTheme.border}/50`}`}>
                <span className={`text-${currentTheme.textMuted} text-xs`}>{label}</span>
                <span className={`text-${currentTheme.text} font-medium text-xs`}>{value}</span>
            </div>
        )
    }

    function DetailedSection({ title, sectionKey, summary, children }) {
        const isOpen = detailedOpen[sectionKey]
        return (
            <div className="mb-1">
                <button
                    onClick={() => toggleDetailedSection(sectionKey)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 bg-${currentTheme.card} hover:bg-${currentTheme.border} rounded border border-${currentTheme.border} transition`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className={`text-${currentTheme.accent} text-[10px]`}>{isOpen ? '▼' : '▶'}</span>
                        <span className={`text-xs font-semibold text-${currentTheme.text}`}>{title}</span>
                    </div>
                    <span className={`text-[10px] text-${currentTheme.textMuted}`}>{summary}</span>
                </button>
                {isOpen && (
                    <div className={`mt-0.5 rounded overflow-hidden border border-${currentTheme.border}`}>
                        {children}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="p-2">
            <div className="mb-2">
                <h1 className={`text-base font-bold text-${currentTheme.text}`}>Dashboard</h1>
                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Welcome to the ImagineThat admin panel</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
                {statCards.map((stat, index) => (
                    <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded p-2 relative`}>
                        {stat.alert && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>{stat.label}</p>
                                <p className={`text-lg font-bold ${stat.textColor}`}>
                                    {typeof stat.value === 'number' && stat.value.toLocaleString ? stat.value.toLocaleString() : stat.value}
                                </p>
                            </div>
                            <span className="text-lg">{stat.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-2">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-1">
                        <Link href="/admin/winners" className={`flex items-center gap-1.5 p-1.5 bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded hover:bg-${currentTheme.accent}/20 transition-all group`}>
                            <span className="text-base">🏆</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-xs font-medium group-hover:text-${currentTheme.accent} transition-colors`}>View Winners</p>
                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Manage weekly prizes</p>
                            </div>
                        </Link>
                        <Link href="/admin/payout-queue" className="flex items-center gap-1.5 p-1.5 bg-green-500/10 border border-green-500/20 rounded hover:bg-green-500/20 transition-all group">
                            <span className="text-base">💰</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-xs font-medium group-hover:text-green-400 transition-colors`}>Payout Queue</p>
                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Process payments</p>
                            </div>
                        </Link>
                        <Link href="/admin/users" className="flex items-center gap-1.5 p-1.5 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-all group">
                            <span className="text-base">👥</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-xs font-medium group-hover:text-blue-400 transition-colors`}>Users</p>
                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Manage accounts</p>
                            </div>
                        </Link>
                        <Link href="/admin/campaigns" className="flex items-center gap-1.5 p-1.5 bg-purple-500/10 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-all group">
                            <span className="text-base">📋</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-xs font-medium group-hover:text-purple-400 transition-colors`}>Campaigns</p>
                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Ad management</p>
                            </div>
                        </Link>
                    </div>
                </div>

                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className={`text-xs font-bold text-${currentTheme.text}`}>This Week's Leaders</h2>
                        <Link href="/admin/winners" className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover} text-[10px] font-medium transition-colors`}>View all →</Link>
                    </div>
                    {recentWinners.length > 0 ? (
                        <div className="space-y-1">
                            {recentWinners.map((winner, index) => (
                                <div key={winner.id} className={`flex items-center gap-1.5 p-1.5 bg-${currentTheme.border}/50 rounded`}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${index === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` :
                                        index === 1 ? 'bg-slate-400 text-slate-900' :
                                            index === 2 ? 'bg-amber-700 text-white' :
                                                `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-${currentTheme.text} text-xs font-medium truncate`}>{winner.user.username}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>{winner.moves} moves • {winner.time_seconds}s</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.accent} text-xs font-bold`}>{winner.score}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[9px]`}>score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-3">
                            <p className={`text-${currentTheme.textMuted} text-xs`}>No games played this week yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Stats Section */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                <button
                    onClick={toggleDetailedStats}
                    className={`w-full flex items-center justify-between p-2 hover:bg-${currentTheme.border}/50 transition`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className={`text-${currentTheme.accent} text-xs`}>{showDetailedStats ? '▼' : '▶'}</span>
                        <h2 className={`text-xs font-bold text-${currentTheme.text}`}>📊 Detailed Platform Stats</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {detailedLoading && (
                            <div className={`w-3 h-3 border-2 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                        )}
                        <span className={`text-[10px] text-${currentTheme.textMuted}`}>
                            {showDetailedStats ? 'Click to collapse' : 'Click to expand'}
                        </span>
                    </div>
                </button>

                {showDetailedStats && (
                    <div className={`p-2 border-t border-${currentTheme.border}`}>
                        {detailedLoading ? (
                            <div className="flex items-center justify-center h-24">
                                <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-${currentTheme.accent}`}></div>
                            </div>
                        ) : (
                            <div className="max-w-md">
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Detailed breakdowns by category</p>
                                    <button
                                        onClick={loadDetailedStats}
                                        className={`text-[10px] bg-${currentTheme.border} hover:bg-${currentTheme.card} text-${currentTheme.textMuted} px-1.5 py-0.5 rounded transition`}
                                    >
                                        Refresh
                                    </button>
                                </div>

                                <DetailedSection title="Users" sectionKey="users" summary={`${detailedStats.users.total} total`}>
                                    <StatRow label="Total" value={detailedStats.users.total} even={false} />
                                    <StatRow label="Admins" value={detailedStats.users.admins} even={true} />
                                    <StatRow label="Regular" value={detailedStats.users.regular} even={false} />
                                    <StatRow label="New This Week" value={detailedStats.users.thisWeek} even={true} />
                                    <StatRow label="New This Month" value={detailedStats.users.thisMonth} even={false} />
                                </DetailedSection>

                                <DetailedSection title="Campaigns" sectionKey="campaigns" summary={`${detailedStats.campaigns.active} active`}>
                                    <StatRow label="Active" value={detailedStats.campaigns.active} even={false} />
                                    <StatRow label="Queued" value={detailedStats.campaigns.queued} even={true} />
                                    <StatRow label="Pending Payment" value={detailedStats.campaigns.pending} even={false} />
                                    <StatRow label="Completed" value={detailedStats.campaigns.completed} even={true} />
                                    <StatRow label="Cancelled" value={detailedStats.campaigns.cancelled} even={false} />
                                    <StatRow label="Total" value={detailedStats.campaigns.total} even={true} />
                                    <StatRow label="New This Week" value={detailedStats.campaigns.thisWeek} even={false} />
                                    <StatRow label="New This Month" value={detailedStats.campaigns.thisMonth} even={true} />
                                </DetailedSection>

                                <DetailedSection title="Business Cards" sectionKey="cards" summary={`${detailedStats.cards.total} total`}>
                                    <StatRow label="Total" value={detailedStats.cards.total} even={false} />
                                    <StatRow label="Regular" value={detailedStats.cards.regular} even={true} />
                                    <StatRow label="House Cards" value={detailedStats.cards.house} even={false} />
                                    <StatRow label="In Use" value={detailedStats.cards.inUse} even={true} />
                                </DetailedSection>

                                <DetailedSection title="Ad Views" sectionKey="views" summary={`${detailedStats.views.total.toLocaleString()} total`}>
                                    <StatRow label="Total" value={detailedStats.views.total.toLocaleString()} even={false} />
                                    <StatRow label="From Game" value={detailedStats.views.fromGame.toLocaleString()} even={true} />
                                    <StatRow label="From Flips" value={detailedStats.views.fromFlips.toLocaleString()} even={false} />
                                    <StatRow label="From Card Back" value={detailedStats.views.fromCardBack.toLocaleString()} even={true} />
                                </DetailedSection>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
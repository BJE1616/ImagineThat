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
        pendingPayments: 0,
        paidThisWeek: 0,
        topScoreThisWeek: null
    })
    const [recentWinners, setRecentWinners] = useState([])
    const [loading, setLoading] = useState(true)

    // Economy Health State
    const [economyHealth, setEconomyHealth] = useState({
        score: null,
        label: '',
        alerts: [],
        stats: {
            circulation: 0,
            burned: 0,
            burnRate: 0,
            activeCampaigns: 0
        }
    })

    useEffect(() => {
        loadDashboardData()
        loadEconomyHealth()
    }, [])

    const getWeekStart = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart.toISOString().split('T')[0]
    }

    // ===== LOAD ECONOMY HEALTH =====
    const loadEconomyHealth = async () => {
        try {
            // Get token balances
            const { data: balances } = await supabase.from('bb_balances').select('balance, lifetime_earned, lifetime_spent')
            const totalInCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalEverIssued = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0
            const totalSpent = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0
            const usersWithBalance = balances?.filter(b => b.balance > 0).length || 0

            // Get user count
            const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })

            // Get active campaigns
            const { data: campaigns } = await supabase.from('ad_campaigns').select('id').eq('status', 'active')

            // Get settings for warnings
            const { data: settings } = await supabase.from('economy_settings').select('*')

            // Calculate health factors
            const burnRate = totalEverIssued > 0 ? (totalSpent / totalEverIssued) * 100 : 50
            const engagementRate = totalUsers > 0 ? (usersWithBalance / totalUsers) * 100 : 0

            // Calculate scores
            let burnScore = burnRate >= 30 && burnRate <= 60 ? 100 : burnRate >= 20 ? 70 : burnRate >= 10 ? 40 : 20
            let engagementScore = Math.min(100, Math.round(engagementRate * 2))
            let campaignScore = campaigns?.length > 0 ? Math.min(100, campaigns.length * 20) : 0

            // Settings health
            const settingsWithWarnings = settings?.filter(s => {
                if (s.warning_threshold_low && s.setting_value < s.warning_threshold_low) return true
                if (s.warning_threshold_high && s.setting_value > s.warning_threshold_high) return true
                return false
            }).length || 0
            const settingsScore = settings?.length > 0 ? ((settings.length - settingsWithWarnings) / settings.length) * 100 : 100

            // Weighted average
            const totalScore = Math.round(
                (burnScore * 25 + engagementScore * 25 + campaignScore * 25 + settingsScore * 25) / 100
            )

            // Build alerts
            const alerts = []

            // Check for pending matrix payouts
            const { data: pendingPayouts } = await supabase
                .from('matrix_entries')
                .select('id')
                .eq('is_completed', true)
                .eq('payout_status', 'pending')

            if (pendingPayouts && pendingPayouts.length > 0) {
                alerts.push({
                    type: 'urgent',
                    message: `${pendingPayouts.length} matrix payout${pendingPayouts.length > 1 ? 's' : ''} pending`
                })
            }

            // Check for settings warnings
            if (settingsWithWarnings > 0) {
                alerts.push({
                    type: 'warning',
                    message: `${settingsWithWarnings} economy setting${settingsWithWarnings > 1 ? 's' : ''} outside safe range`
                })
            }

            // Check for no campaigns
            if (!campaigns || campaigns.length === 0) {
                alerts.push({
                    type: 'info',
                    message: 'No active ad campaigns'
                })
            }

            // Check burn rate
            if (totalEverIssued > 0 && burnRate < 20) {
                alerts.push({
                    type: 'warning',
                    message: `Low burn rate (${burnRate.toFixed(1)}%) - tokens accumulating`
                })
            }

            // Get health label
            let label = 'Critical'
            if (totalScore >= 80) label = 'Excellent'
            else if (totalScore >= 60) label = 'Good'
            else if (totalScore >= 40) label = 'Needs Attention'

            setEconomyHealth({
                score: totalScore,
                label,
                alerts,
                stats: {
                    circulation: totalInCirculation,
                    burned: totalSpent,
                    burnRate: totalEverIssued > 0 ? burnRate : 0,
                    activeCampaigns: campaigns?.length || 0
                }
            })
        } catch (error) {
            console.error('Error loading economy health:', error)
        }
    }

    const loadDashboardData = async () => {
        try {
            const weekStart = getWeekStart()

            const { count: totalUsers } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })

            const { data: weekGames, count: gamesThisWeek } = await supabase
                .from('leaderboard')
                .select('*', { count: 'exact' })
                .eq('week_start', weekStart)

            const uniquePlayers = weekGames ? [...new Set(weekGames.map(g => g.user_id))].length : 0

            const { count: totalGamesAllTime } = await supabase
                .from('leaderboard')
                .select('*', { count: 'exact', head: true })

            const { count: pendingPayments } = await supabase
                .from('prize_payments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')

            const { count: paidThisWeek } = await supabase
                .from('prize_payments')
                .select('*', { count: 'exact', head: true })
                .eq('week_start', weekStart)
                .eq('status', 'paid')

            const { data: topScore } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart)
                .order('score', { ascending: true })
                .limit(1)
                .single()

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
                pendingPayments: pendingPayments || 0,
                paidThisWeek: paidThisWeek || 0,
                topScoreThisWeek: topScore?.score || null
            })

            setRecentWinners(winnersWithUsers)
        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    // Health color helpers
    const getHealthColor = (score) => {
        if (score >= 80) return 'text-green-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-yellow-400'
        return 'text-red-400'
    }

    const getHealthBg = (score) => {
        if (score >= 80) return 'bg-green-500/10 border-green-500/30'
        if (score >= 60) return 'bg-blue-500/10 border-blue-500/30'
        if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/30'
        return 'bg-red-500/10 border-red-500/30'
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-36`}></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-16 bg-${currentTheme.card} rounded`}></div>
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
        { label: 'Pending Payments', value: stats.pendingPayments, icon: '⏳', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', textColor: 'text-red-400', alert: stats.pendingPayments > 0 },
        { label: 'Paid This Week', value: stats.paidThisWeek, icon: '✅', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', textColor: 'text-emerald-400' },
        { label: 'All-Time Games', value: stats.totalGamesAllTime, icon: '📊', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20', textColor: 'text-indigo-400' }
    ]

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Dashboard</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Welcome to the ImagineThat admin panel</p>
            </div>

            {/* ===== ECONOMY HEALTH WIDGET ===== */}
            <div className={`mb-4 border rounded-lg p-4 ${getHealthBg(economyHealth.score || 0)}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl">💰</div>
                        <div>
                            <h2 className={`text-${currentTheme.text} font-bold text-lg`}>Economy Health</h2>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Token economy status at a glance</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-5xl font-bold ${getHealthColor(economyHealth.score || 0)}`}>
                            {economyHealth.score !== null ? economyHealth.score : '—'}
                        </p>
                        <p className={`text-sm font-medium ${getHealthColor(economyHealth.score || 0)}`}>
                            {economyHealth.label || 'Loading...'}
                        </p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className={`bg-${currentTheme.card}/50 rounded-lg p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>In Circulation</p>
                        <p className="text-yellow-400 font-bold text-lg">🪙 {economyHealth.stats.circulation.toLocaleString()}</p>
                    </div>
                    <div className={`bg-${currentTheme.card}/50 rounded-lg p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Burned</p>
                        <p className="text-red-400 font-bold text-lg">🔥 {economyHealth.stats.burned.toLocaleString()}</p>
                    </div>
                    <div className={`bg-${currentTheme.card}/50 rounded-lg p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Burn Rate</p>
                        <p className={`font-bold text-lg ${economyHealth.stats.burnRate >= 30 && economyHealth.stats.burnRate <= 60 ? 'text-green-400' : economyHealth.stats.burnRate > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                            {economyHealth.stats.burnRate.toFixed(1)}%
                        </p>
                    </div>
                    <div className={`bg-${currentTheme.card}/50 rounded-lg p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Active Campaigns</p>
                        <p className="text-blue-400 font-bold text-lg">📢 {economyHealth.stats.activeCampaigns}</p>
                    </div>
                </div>

                {/* Alerts */}
                {economyHealth.alerts.length > 0 && (
                    <div className="mb-3 space-y-2">
                        {economyHealth.alerts.map((alert, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${alert.type === 'urgent' ? 'bg-red-500/20 border border-red-500/30' :
                                        alert.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                                            'bg-blue-500/20 border border-blue-500/30'
                                    }`}
                            >
                                <span className="text-lg">
                                    {alert.type === 'urgent' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                                </span>
                                <p className={`text-sm ${alert.type === 'urgent' ? 'text-red-300' :
                                        alert.type === 'warning' ? 'text-yellow-300' :
                                            'text-blue-300'
                                    }`}>
                                    {alert.message}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Link to full economy page */}
                <Link
                    href="/admin/economy"
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} text-sm font-medium hover:bg-${currentTheme.border}/50 transition-all`}
                >
                    View Full Economy Dashboard →
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {statCards.map((stat, index) => (
                    <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded p-3 relative`}>
                        {stat.alert && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>{stat.label}</p>
                                <p className={`text-xl font-bold ${stat.textColor}`}>
                                    {stat.value.toLocaleString ? stat.value.toLocaleString() : stat.value}
                                </p>
                            </div>
                            <span className="text-xl">{stat.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                    <h2 className={`text-sm font-bold text-${currentTheme.text} mb-3`}>Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <Link href="/admin/winners" className={`flex items-center gap-2 p-2 bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded hover:bg-${currentTheme.accent}/20 transition-all group`}>
                            <span className="text-lg">🏆</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-sm font-medium group-hover:text-${currentTheme.accent} transition-colors`}>View Winners</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage weekly prizes</p>
                            </div>
                        </Link>
                        <Link href="/admin/payments" className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded hover:bg-green-500/20 transition-all group">
                            <span className="text-lg">💰</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-sm font-medium group-hover:text-green-400 transition-colors`}>Payments</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Track payment history</p>
                            </div>
                        </Link>
                        <Link href="/admin/users" className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-all group">
                            <span className="text-lg">👥</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-sm font-medium group-hover:text-blue-400 transition-colors`}>Users</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage accounts</p>
                            </div>
                        </Link>
                        <Link href="/admin/archive" className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-all group">
                            <span className="text-lg">📚</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-sm font-medium group-hover:text-purple-400 transition-colors`}>Archive</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Historical winners</p>
                            </div>
                        </Link>
                    </div>
                </div>

                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className={`text-sm font-bold text-${currentTheme.text}`}>This Week's Leaders</h2>
                        <Link href="/admin/winners" className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover} text-xs font-medium transition-colors`}>View all →</Link>
                    </div>
                    {recentWinners.length > 0 ? (
                        <div className="space-y-1.5">
                            {recentWinners.map((winner, index) => (
                                <div key={winner.id} className={`flex items-center gap-2 p-2 bg-${currentTheme.border}/50 rounded`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` :
                                        index === 1 ? 'bg-slate-400 text-slate-900' :
                                            index === 2 ? 'bg-amber-700 text-white' :
                                                `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-${currentTheme.text} text-sm font-medium truncate`}>{winner.user.username}</p>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>{winner.moves} moves • {winner.time_seconds}s</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.accent} text-sm font-bold`}>{winner.score}</p>
                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className={`text-${currentTheme.textMuted} text-sm`}>No games played this week yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
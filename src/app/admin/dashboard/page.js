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
        { label: 'Pending Payouts', value: `${stats.pendingPayouts} ($${stats.pendingAmount.toFixed(0)})`, icon: '⏳', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20', textColor: 'text-orange-400', alert: stats.pendingPayouts > 0 },
        { label: 'Paid Today', value: `${stats.paidToday} ($${stats.paidTodayAmount.toFixed(0)})`, icon: '✅', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', textColor: 'text-emerald-400' },
        { label: 'All-Time Games', value: stats.totalGamesAllTime, icon: '📊', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20', textColor: 'text-indigo-400' }
    ]

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Dashboard</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Welcome to the ImagineThat admin panel</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {statCards.map((stat, index) => (
                    <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded p-3 relative`}>
                        {stat.alert && <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>{stat.label}</p>
                                <p className={`text-xl font-bold ${stat.textColor}`}>
                                    {typeof stat.value === 'number' && stat.value.toLocaleString ? stat.value.toLocaleString() : stat.value}
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
                        <Link href="/admin/payout-queue" className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded hover:bg-green-500/20 transition-all group">
                            <span className="text-lg">💰</span>
                            <div>
                                <p className={`text-${currentTheme.text} text-sm font-medium group-hover:text-green-400 transition-colors`}>Payout Queue</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Process payments</p>
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
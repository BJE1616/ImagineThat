'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdminDashboardPage() {
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

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-48"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-slate-800 rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
        { label: 'Active This Week', value: stats.activeUsersThisWeek, icon: '🎮', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' },
        { label: 'Games This Week', value: stats.gamesThisWeek, icon: '🃏', color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
        { label: 'Best Score', value: stats.topScoreThisWeek ?? '—', icon: '🏆', color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
        { label: 'Pending Payments', value: stats.pendingPayments, icon: '⏳', color: 'from-red-500 to-rose-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', alert: stats.pendingPayments > 0 },
        { label: 'Paid This Week', value: stats.paidThisWeek, icon: '✅', color: 'from-emerald-500 to-teal-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
        { label: 'All-Time Games', value: stats.totalGamesAllTime, icon: '📊', color: 'from-indigo-500 to-violet-500', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20' }
    ]

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-1">Welcome to the ImagineThat admin panel</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => (
                    <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-xl p-6 relative overflow-hidden`}>
                        {stat.alert && <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                                <p className={`text-3xl font-bold mt-2 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                                    {stat.value.toLocaleString ? stat.value.toLocaleString() : stat.value}
                                </p>
                            </div>
                            <span className="text-3xl">{stat.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/admin/winners" className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all group">
                            <span className="text-2xl">🏆</span>
                            <div>
                                <p className="text-white font-medium group-hover:text-amber-400 transition-colors">View Winners</p>
                                <p className="text-slate-400 text-sm">Manage weekly prizes</p>
                            </div>
                        </Link>
                        <Link href="/admin/payments" className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-all group">
                            <span className="text-2xl">💰</span>
                            <div>
                                <p className="text-white font-medium group-hover:text-green-400 transition-colors">Payments</p>
                                <p className="text-slate-400 text-sm">Track payment history</p>
                            </div>
                        </Link>
                        <Link href="/admin/users" className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all group">
                            <span className="text-2xl">👥</span>
                            <div>
                                <p className="text-white font-medium group-hover:text-blue-400 transition-colors">Users</p>
                                <p className="text-slate-400 text-sm">Manage accounts</p>
                            </div>
                        </Link>
                        <Link href="/admin/archive" className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all group">
                            <span className="text-2xl">📚</span>
                            <div>
                                <p className="text-white font-medium group-hover:text-purple-400 transition-colors">Archive</p>
                                <p className="text-slate-400 text-sm">Historical winners</p>
                            </div>
                        </Link>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">This Week's Leaders</h2>
                        <Link href="/admin/winners" className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors">View all →</Link>
                    </div>
                    {recentWinners.length > 0 ? (
                        <div className="space-y-3">
                            {recentWinners.map((winner, index) => (
                                <div key={winner.id} className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-500 text-slate-900' :
                                            index === 1 ? 'bg-slate-400 text-slate-900' :
                                                index === 2 ? 'bg-amber-700 text-white' :
                                                    'bg-slate-600 text-slate-300'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{winner.user.username}</p>
                                        <p className="text-slate-400 text-sm">{winner.moves} moves • {winner.time_seconds}s</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-amber-400 font-bold">{winner.score}</p>
                                        <p className="text-slate-500 text-xs">score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-slate-400">No games played this week yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
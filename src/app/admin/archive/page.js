'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminArchivePage() {
    const [archive, setArchive] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedWeek, setExpandedWeek] = useState(null)
    const [stats, setStats] = useState({
        totalWeeks: 0,
        totalGames: 0,
        totalPrizesPaid: 0,
        uniqueWinners: 0
    })

    useEffect(() => {
        loadArchive()
    }, [])

    const loadArchive = async () => {
        setLoading(true)
        try {
            const { data: allGames, error: gamesError } = await supabase
                .from('leaderboard')
                .select('*')
                .order('week_start', { ascending: false })

            if (gamesError) throw gamesError

            const weekMap = {}
            allGames?.forEach(game => {
                if (!weekMap[game.week_start]) {
                    weekMap[game.week_start] = {
                        week_start: game.week_start,
                        games: [],
                        totalGames: 0,
                        bestScore: Infinity
                    }
                }
                weekMap[game.week_start].games.push(game)
                weekMap[game.week_start].totalGames++
                if (game.score < weekMap[game.week_start].bestScore) {
                    weekMap[game.week_start].bestScore = game.score
                }
            })

            const weeks = Object.values(weekMap).map(week => ({
                ...week,
                games: week.games.sort((a, b) => a.score - b.score).slice(0, 20)
            }))

            const allUserIds = [...new Set(weeks.flatMap(w => w.games.map(g => g.user_id)))]
            const { data: usersData } = await supabase
                .from('users')
                .select('id, username, email')
                .in('id', allUserIds)

            weeks.forEach(week => {
                week.games = week.games.map(game => ({
                    ...game,
                    user: usersData?.find(u => u.id === game.user_id) || { username: 'Unknown' }
                }))
            })

            const { data: paymentsData } = await supabase
                .from('prize_payments')
                .select('*')

            const totalPrizesPaid = paymentsData?.filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + (p.prize_amount || 0), 0) || 0

            const uniqueWinners = new Set(
                weeks.flatMap(w => w.games.slice(0, 5).map(g => g.user_id))
            ).size

            setStats({
                totalWeeks: weeks.length,
                totalGames: allGames?.length || 0,
                totalPrizesPaid,
                uniqueWinners
            })

            setArchive(weeks)
        } catch (error) {
            console.error('Error loading archive:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatWeekRange = (weekStartStr) => {
        const weekStart = new Date(weekStartStr + 'T00:00:00')
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    const isCurrentWeek = (weekStartStr) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const currentWeekStart = new Date(today)
        currentWeekStart.setDate(today.getDate() - dayOfWeek)
        currentWeekStart.setHours(0, 0, 0, 0)
        return weekStartStr === currentWeekStart.toISOString().split('T')[0]
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-64"></div>
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>
                        ))}
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Winners Archive</h1>
                <p className="text-slate-400 mt-1">Historical record of all weekly competitions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Total Weeks</p>
                    <p className="text-3xl font-bold text-purple-400 mt-1">{stats.totalWeeks}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Total Games</p>
                    <p className="text-3xl font-bold text-blue-400 mt-1">{stats.totalGames.toLocaleString()}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Prizes Paid</p>
                    <p className="text-3xl font-bold text-green-400 mt-1">${stats.totalPrizesPaid.toLocaleString()}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Unique Winners</p>
                    <p className="text-3xl font-bold text-amber-400 mt-1">{stats.uniqueWinners}</p>
                </div>
            </div>

            <div className="space-y-4">
                {archive.length > 0 ? (
                    archive.map(week => (
                        <div key={week.week_start} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpandedWeek(expandedWeek === week.week_start ? null : week.week_start)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                                        <span className="text-xl">🏆</span>
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white font-semibold text-lg">
                                                {formatWeekRange(week.week_start)}
                                            </h3>
                                            {isCurrentWeek(week.week_start) && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-sm">
                                            {week.totalGames} games played • Best score: {week.bestScore}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="hidden md:flex items-center gap-2">
                                        {week.games.slice(0, 3).map((game, i) => (
                                            <div
                                                key={game.id}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-500 text-slate-900' :
                                                        i === 1 ? 'bg-slate-400 text-slate-900' :
                                                            'bg-amber-700 text-white'
                                                    }`}
                                                title={game.user.username}
                                            >
                                                {game.user.username?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        ))}
                                    </div>
                                    <span className={`text-slate-400 transition-transform ${expandedWeek === week.week_start ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </div>
                            </button>

                            {expandedWeek === week.week_start && (
                                <div className="border-t border-slate-700 p-6">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-slate-400 text-sm">
                                                <th className="text-left py-2">Rank</th>
                                                <th className="text-left py-2">Player</th>
                                                <th className="text-left py-2">Mode</th>
                                                <th className="text-left py-2">Moves</th>
                                                <th className="text-left py-2">Time</th>
                                                <th className="text-left py-2">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {week.games.map((game, index) => (
                                                <tr key={game.id} className="border-t border-slate-700/50">
                                                    <td className="py-3">
                                                        <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-sm ${index === 0 ? 'bg-amber-500 text-slate-900' :
                                                                index === 1 ? 'bg-slate-400 text-slate-900' :
                                                                    index === 2 ? 'bg-amber-700 text-white' :
                                                                        'bg-slate-600 text-slate-300'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-3">
                                                        <p className="text-white font-medium">{game.user.username}</p>
                                                        <p className="text-slate-500 text-xs">{game.user.email}</p>
                                                    </td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${game.game_mode === 'easy'
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {game.game_mode === 'easy' ? '12 Cards' : '16 Cards'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-slate-300">{game.moves}</td>
                                                    <td className="py-3 text-slate-300">{game.time_seconds}s</td>
                                                    <td className="py-3">
                                                        <span className="text-amber-400 font-bold">{game.score}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                        <p className="text-slate-400 text-lg">No archived weeks yet</p>
                        <p className="text-slate-500 text-sm mt-1">Historical data will appear here as weeks complete</p>
                    </div>
                )}
            </div>
        </div>
    )
}
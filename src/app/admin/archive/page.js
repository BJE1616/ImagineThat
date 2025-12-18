'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminArchivePage() {
    const { currentTheme } = useTheme()
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
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Winners Archive</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Historical record of all weekly competitions</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Weeks</p>
                    <p className="text-xl font-bold text-purple-400">{stats.totalWeeks}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Games</p>
                    <p className="text-xl font-bold text-blue-400">{stats.totalGames.toLocaleString()}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Prizes Paid</p>
                    <p className="text-xl font-bold text-green-400">${stats.totalPrizesPaid.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Unique Winners</p>
                    <p className={`text-xl font-bold text-${currentTheme.accent}`}>{stats.uniqueWinners}</p>
                </div>
            </div>

            <div className="space-y-2">
                {archive.length > 0 ? (
                    archive.map(week => (
                        <div key={week.week_start} className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                            <button
                                onClick={() => setExpandedWeek(expandedWeek === week.week_start ? null : week.week_start)}
                                className={`w-full px-3 py-2 flex items-center justify-between hover:bg-${currentTheme.border}/50 transition-colors`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 bg-gradient-to-br from-${currentTheme.accent} to-orange-500 rounded flex items-center justify-center`}>
                                        <span className="text-sm">🏆</span>
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <h3 className={`text-${currentTheme.text} font-semibold text-sm`}>
                                                {formatWeekRange(week.week_start)}
                                            </h3>
                                            {isCurrentWeek(week.week_start) && (
                                                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded-full">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>
                                            {week.totalGames} games • Best: {week.bestScore}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="hidden md:flex items-center gap-1">
                                        {week.games.slice(0, 3).map((game, i) => (
                                            <div
                                                key={game.id}
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` :
                                                    i === 1 ? 'bg-slate-400 text-slate-900' :
                                                        'bg-amber-700 text-white'
                                                    }`}
                                                title={game.user.username}
                                            >
                                                {game.user.username?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        ))}
                                    </div>
                                    <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${expandedWeek === week.week_start ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </div>
                            </button>

                            {expandedWeek === week.week_start && (
                                <div className={`border-t border-${currentTheme.border} p-3`}>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className={`text-${currentTheme.textMuted} text-xs`}>
                                                <th className="text-left py-1">Rank</th>
                                                <th className="text-left py-1">Player</th>
                                                <th className="text-left py-1">Mode</th>
                                                <th className="text-left py-1">Moves</th>
                                                <th className="text-left py-1">Time</th>
                                                <th className="text-left py-1">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {week.games.map((game, index) => (
                                                <tr key={game.id} className={`border-t border-${currentTheme.border}/50`}>
                                                    <td className="py-1.5">
                                                        <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full font-bold text-xs ${index === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` :
                                                            index === 1 ? 'bg-slate-400 text-slate-900' :
                                                                index === 2 ? 'bg-amber-700 text-white' :
                                                                    `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5">
                                                        <p className={`text-${currentTheme.text} font-medium text-xs`}>{game.user.username}</p>
                                                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>{game.user.email}</p>
                                                    </td>
                                                    <td className="py-1.5">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${game.game_mode === 'easy'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {game.game_mode === 'easy' ? '12' : '16'}
                                                        </span>
                                                    </td>
                                                    <td className={`py-1.5 text-${currentTheme.textMuted} text-xs`}>{game.moves}</td>
                                                    <td className={`py-1.5 text-${currentTheme.textMuted} text-xs`}>{game.time_seconds}s</td>
                                                    <td className="py-1.5">
                                                        <span className={`text-${currentTheme.accent} font-bold text-xs`}>{game.score}</span>
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
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-8 text-center`}>
                        <p className={`text-${currentTheme.textMuted} text-sm`}>No archived weeks yet</p>
                        <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>Historical data will appear here as weeks complete</p>
                    </div>
                )}
            </div>
        </div>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminWinnersPage() {
    const { currentTheme } = useTheme()
    const [leaderboard, setLeaderboard] = useState([])
    const [payments, setPayments] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [weekOffset, setWeekOffset] = useState(0)
    const [currentWeek, setCurrentWeek] = useState('')

    useEffect(() => {
        loadWeekData()
    }, [weekOffset])

    const getWeekStart = (offset = 0) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek - (offset * 7))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    const formatWeekRange = (weekStart) => {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    const loadWeekData = async () => {
        setLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStartStr)
                .order('score', { ascending: true })
                .limit(20)

            if (leaderboardError) throw leaderboardError

            if (leaderboardData && leaderboardData.length > 0) {
                const userIds = leaderboardData.map(entry => entry.user_id)
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                if (usersError) throw usersError

                const combined = leaderboardData.map(entry => ({
                    ...entry,
                    user: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown', email: '' }
                }))

                setLeaderboard(combined)

                const { data: paymentsData } = await supabase
                    .from('prize_payments')
                    .select('*')
                    .eq('week_start', weekStartStr)
                    .in('leaderboard_id', leaderboardData.map(e => e.id))

                const paymentsMap = {}
                paymentsData?.forEach(p => {
                    paymentsMap[p.leaderboard_id] = p
                })
                setPayments(paymentsMap)
            } else {
                setLeaderboard([])
                setPayments({})
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const sendPrizeWinnerEmail = async (entry, rank, prizeAmount) => {
        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'prize_winner',
                    to: entry.user.email,
                    data: {
                        username: entry.user.username,
                        rank: rank,
                        prize: `$${prizeAmount}`
                    }
                })
            })
        } catch (error) {
            console.error('Prize winner email error:', error)
        }
    }

    const togglePaymentStatus = async (entry, rank) => {
        setSaving(entry.id)
        const weekStartStr = getWeekStart(weekOffset).toISOString().split('T')[0]
        const prizeAmount = getPrizeAmount(rank)

        try {
            const existingPayment = payments[entry.id]

            if (existingPayment) {
                const newStatus = existingPayment.status === 'paid' ? 'pending' : 'paid'
                const { error } = await supabase
                    .from('prize_payments')
                    .update({
                        status: newStatus,
                        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingPayment.id)

                if (error) throw error

                if (newStatus === 'paid') {
                    await sendPrizeWinnerEmail(entry, rank, prizeAmount)
                }

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: { ...existingPayment, status: newStatus }
                }))
            } else {
                const { data, error } = await supabase
                    .from('prize_payments')
                    .insert([{
                        leaderboard_id: entry.id,
                        user_id: entry.user_id,
                        week_start: weekStartStr,
                        rank: rank,
                        prize_amount: prizeAmount,
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    }])
                    .select()
                    .single()

                if (error) throw error

                await sendPrizeWinnerEmail(entry, rank, prizeAmount)

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: data
                }))
            }
        } catch (error) {
            console.error('Error updating payment:', error)
            alert('Error updating payment status. The prize_payments table may need to be created.')
        } finally {
            setSaving(null)
        }
    }

    const getPrizeAmount = (rank) => {
        const prizes = { 1: 100, 2: 75, 3: 50, 4: 25, 5: 25 }
        return prizes[rank] || 0
    }

    const getRankBadge = (rank) => {
        if (rank === 1) return { emoji: '🥇', color: `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` }
        if (rank === 2) return { emoji: '🥈', color: 'bg-slate-400 text-slate-900' }
        if (rank === 3) return { emoji: '🥉', color: 'bg-amber-700 text-white' }
        return { emoji: rank.toString(), color: `bg-${currentTheme.border} text-${currentTheme.textMuted}` }
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Weekly Winners</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage prize payments for top players</p>
            </div>

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded hover:bg-${currentTheme.card} transition-colors`}
                    >
                        ← Prev
                    </button>
                    <div className="text-center">
                        <p className={`text-${currentTheme.text} font-semibold text-sm`}>{currentWeek}</p>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>
                            {weekOffset === 0 ? 'Current Week' : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}
                        </p>
                    </div>
                    <button
                        onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                        disabled={weekOffset === 0}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded hover:bg-${currentTheme.card} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        Next →
                    </button>
                </div>
            </div>

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b border-${currentTheme.border}`}>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Rank</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Mode</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Moves</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Time</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Score</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Prize</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length > 0 ? (
                                leaderboard.map((entry, index) => {
                                    const rank = index + 1
                                    const badge = getRankBadge(rank)
                                    const payment = payments[entry.id]
                                    const isPaid = payment?.status === 'paid'
                                    const prizeAmount = getPrizeAmount(rank)

                                    return (
                                        <tr key={entry.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 transition-colors`}>
                                            <td className="py-2 px-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${badge.color}`}>
                                                    {rank <= 3 ? badge.emoji : rank}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3">
                                                <p className={`text-${currentTheme.text} font-medium text-xs`}>{entry.user.username}</p>
                                                {entry.user.first_name && (
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>{entry.user.first_name} {entry.user.last_name}</p>
                                                )}
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                            <td className="py-2 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.game_mode === 'easy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {entry.game_mode === 'easy' ? '12' : '16'}
                                                </span>
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.moves}</td>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.time_seconds}s</td>
                                            <td className="py-2 px-3">
                                                <span className={`text-${currentTheme.accent} font-bold text-sm`}>{entry.score}</span>
                                            </td>
                                            <td className="py-2 px-3">
                                                {prizeAmount > 0 ? (
                                                    <span className="text-green-400 font-semibold text-xs">${prizeAmount}</span>
                                                ) : (
                                                    <span className={`text-${currentTheme.textMuted} text-xs`}>—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3">
                                                {prizeAmount > 0 ? (
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isPaid
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : `bg-${currentTheme.accent}/20 text-${currentTheme.accent} border border-${currentTheme.accent}/30`
                                                        }`}>
                                                        {isPaid ? '✓ Paid' : 'Pending'}
                                                    </span>
                                                ) : (
                                                    <span className={`text-${currentTheme.textMuted} text-xs`}>—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3">
                                                {prizeAmount > 0 && (
                                                    <button
                                                        onClick={() => togglePaymentStatus(entry, rank)}
                                                        disabled={saving === entry.id}
                                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${isPaid
                                                            ? `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                                            : 'bg-green-600 text-white hover:bg-green-500'
                                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {saving === entry.id ? '...' : isPaid ? 'Unpaid' : 'Paid'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan="10" className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                        <p className="text-sm">No games played this week</p>
                                        <p className="text-xs mt-1">Winners will appear here when players complete games</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {leaderboard.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Players</p>
                        <p className={`text-lg font-bold text-${currentTheme.text}`}>{leaderboard.length}</p>
                    </div>
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Prizes Pending</p>
                        <p className={`text-lg font-bold text-${currentTheme.accent}`}>
                            ${leaderboard.slice(0, 5).reduce((sum, _, i) => {
                                const payment = payments[leaderboard[i]?.id]
                                return payment?.status === 'paid' ? sum : sum + getPrizeAmount(i + 1)
                            }, 0)}
                        </p>
                    </div>
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Prizes Paid</p>
                        <p className="text-lg font-bold text-green-400">
                            ${leaderboard.slice(0, 5).reduce((sum, _, i) => {
                                const payment = payments[leaderboard[i]?.id]
                                return payment?.status === 'paid' ? sum + getPrizeAmount(i + 1) : sum
                            }, 0)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
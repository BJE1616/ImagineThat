'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminWinnersPage() {
    const { currentTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('slots')

    // ===== MATCH GAME STATE =====
    const [leaderboard, setLeaderboard] = useState([])
    const [payments, setPayments] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [weekOffset, setWeekOffset] = useState(0)
    const [currentWeek, setCurrentWeek] = useState('')

    // ===== SLOTS DRAWING STATE =====
    const [slotsPrize, setSlotsPrize] = useState(null)
    const [slotsEntries, setSlotsEntries] = useState([])
    const [slotsLoading, setSlotsLoading] = useState(true)
    const [selectedWinner, setSelectedWinner] = useState(null)
    const [announcing, setAnnouncing] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        if (activeTab === 'match') {
            loadWeekData()
        } else {
            loadSlotsDrawing()
        }
    }, [weekOffset, activeTab])

    // ===== MATCH GAME FUNCTIONS =====
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
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const combined = leaderboardData.map(entry => ({
                    ...entry,
                    user: usersData?.find(u => u.id === entry.user_id) || { username: 'Unknown', email: '' }
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

    // ===== SLOTS DRAWING FUNCTIONS =====
    const loadSlotsDrawing = async () => {
        setSlotsLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            // Load prize for this week
            const { data: prizeData } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('game_type', 'slots')
                .eq('week_start', weekStartStr)
                .single()

            setSlotsPrize(prizeData || null)

            // Load all entries for this week
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            const weekEndStr = weekEnd.toISOString().split('T')[0]

            const { data: entriesData } = await supabase
                .from('user_daily_spins')
                .select('user_id, drawing_entries, spin_date')
                .gte('spin_date', weekStartStr)
                .lte('spin_date', weekEndStr)
                .gt('drawing_entries', 0)

            if (entriesData && entriesData.length > 0) {
                // Aggregate entries by user
                const userEntries = {}
                entriesData.forEach(e => {
                    if (!userEntries[e.user_id]) {
                        userEntries[e.user_id] = 0
                    }
                    userEntries[e.user_id] += e.drawing_entries || 0
                })

                // Get user details
                const userIds = Object.keys(userEntries)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const entriesList = Object.entries(userEntries).map(([userId, entries]) => ({
                    user_id: userId,
                    entries: entries,
                    user: usersData?.find(u => u.id === userId) || { username: 'Unknown', email: '' }
                })).sort((a, b) => b.entries - a.entries)

                setSlotsEntries(entriesList)
            } else {
                setSlotsEntries([])
            }
        } catch (error) {
            console.error('Error loading slots drawing:', error)
        } finally {
            setSlotsLoading(false)
        }
    }

    const pickRandomWinner = () => {
        if (slotsEntries.length === 0) return

        // Weighted random selection based on entries
        const totalEntries = slotsEntries.reduce((sum, e) => sum + e.entries, 0)
        let random = Math.random() * totalEntries

        for (const entry of slotsEntries) {
            random -= entry.entries
            if (random <= 0) {
                setSelectedWinner(entry)
                return
            }
        }

        // Fallback to first entry
        setSelectedWinner(slotsEntries[0])
    }

    const confirmWinner = async () => {
        if (!selectedWinner || !slotsPrize) return
        setAnnouncing(true)

        try {
            // Update the prize with winner info
            const { error } = await supabase
                .from('weekly_prizes')
                .update({
                    winner_user_id: selectedWinner.user_id,
                    winner_selected_at: new Date().toISOString(),
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', slotsPrize.id)

            if (error) throw error

            setMessage({ type: 'success', text: `🎉 Winner confirmed: ${selectedWinner.user.username}!` })

            // Reload data
            loadSlotsDrawing()
            setSelectedWinner(null)
        } catch (error) {
            console.error('Error confirming winner:', error)
            setMessage({ type: 'error', text: 'Failed to confirm winner. Please try again.' })
        } finally {
            setAnnouncing(false)
        }
    }

    const clearSelection = () => {
        setSelectedWinner(null)
    }

    // ===== MATCH GAME FUNCTIONS (continued) =====
    const togglePaymentStatus = async (entry, rank) => {
        setSaving(entry.id)
        const weekStartStr = getWeekStart(weekOffset).toISOString().split('T')[0]
        const prizeAmount = getPrizeAmount(rank)

        try {
            const existingPayment = payments[entry.id]

            if (existingPayment) {
                const newStatus = existingPayment.status === 'paid' ? 'pending' : 'paid'
                await supabase
                    .from('prize_payments')
                    .update({
                        status: newStatus,
                        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingPayment.id)

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: { ...existingPayment, status: newStatus }
                }))
            } else {
                const { data } = await supabase
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

                setPayments(prev => ({
                    ...prev,
                    [entry.id]: data
                }))
            }
        } catch (error) {
            console.error('Error updating payment:', error)
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

    const getTotalEntries = () => slotsEntries.reduce((sum, e) => sum + e.entries, 0)

    const getPrizeDisplay = () => {
        if (!slotsPrize) return 'No prize set'
        if (slotsPrize.is_surprise) return '🎁 Surprise!'
        if (slotsPrize.prize_type === 'cash') return `$${slotsPrize.total_prize_pool}`
        return slotsPrize.prize_descriptions?.[0] || 'Special Prize'
    }

    // ===== RENDER =====
    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Weekly Winners</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage prize payments and drawing winners</p>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => setActiveTab('slots')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'slots'
                            ? 'bg-purple-500 text-white'
                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    🎰 Slots Drawing
                </button>
                <button
                    onClick={() => setActiveTab('match')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'match'
                            ? 'bg-green-500 text-white'
                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    🎮 Match Game
                </button>
            </div>

            {/* ===== WEEK NAVIGATION ===== */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded hover:bg-${currentTheme.card}`}
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
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded disabled:opacity-50`}
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-3 p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* ===== SLOTS DRAWING TAB ===== */}
            {activeTab === 'slots' && (
                <>
                    {slotsLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-32 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            {/* Prize Info */}
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>This Week's Prize</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{getPrizeDisplay()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Entries</p>
                                        <p className="text-purple-400 font-bold text-lg">🎟️ {getTotalEntries()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Participants</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{slotsEntries.length}</p>
                                    </div>
                                </div>

                                {slotsPrize?.winner_user_id && (
                                    <div className="mt-3 p-2 bg-green-500/20 border border-green-500/50 rounded">
                                        <p className="text-green-400 text-sm font-bold">✅ Winner Already Selected</p>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>
                                            Selected on {new Date(slotsPrize.winner_selected_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Winner Selection */}
                            {!slotsPrize?.winner_user_id && slotsEntries.length > 0 && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>🎲 Select Winner</h3>

                                    {selectedWinner ? (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-center">
                                                <p className="text-yellow-400 text-xs mb-1">Selected Winner:</p>
                                                <p className={`text-${currentTheme.text} font-bold text-lg`}>{selectedWinner.user.username}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>{selectedWinner.user.email}</p>
                                                <p className="text-purple-400 text-sm mt-1">🎟️ {selectedWinner.entries} entries</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={clearSelection}
                                                    className={`flex-1 py-2 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={pickRandomWinner}
                                                    className="flex-1 py-2 bg-purple-600 text-white rounded text-sm"
                                                >
                                                    🎲 Re-Pick
                                                </button>
                                                <button
                                                    onClick={confirmWinner}
                                                    disabled={announcing}
                                                    className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-bold"
                                                >
                                                    {announcing ? 'Confirming...' : '✅ Confirm Winner'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={pickRandomWinner}
                                            className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-bold text-sm hover:from-purple-400 hover:to-purple-500"
                                        >
                                            🎲 Pick Random Winner
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Entries List */}
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                <div className={`p-2 border-b border-${currentTheme.border} bg-${currentTheme.border}/30`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm`}>All Entries</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {slotsEntries.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className={`border-b border-${currentTheme.border}`}>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>#</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Entries</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Chance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {slotsEntries.map((entry, index) => {
                                                    const chance = ((entry.entries / getTotalEntries()) * 100).toFixed(1)
                                                    return (
                                                        <tr
                                                            key={entry.user_id}
                                                            className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 ${selectedWinner?.user_id === entry.user_id ? 'bg-yellow-500/20' : ''
                                                                }`}
                                                        >
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{index + 1}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>
                                                                {entry.user.username}
                                                                {selectedWinner?.user_id === entry.user_id && (
                                                                    <span className="ml-2 text-yellow-400">⭐</span>
                                                                )}
                                                            </td>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                            <td className="py-2 px-3 text-right">
                                                                <span className="text-purple-400 font-bold">🎟️ {entry.entries}</span>
                                                            </td>
                                                            <td className={`py-2 px-3 text-right text-${currentTheme.textMuted} text-xs`}>{chance}%</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                            <p className="text-sm">No entries yet this week</p>
                                            <p className="text-xs mt-1">Entries will appear when players spin the slots</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ===== MATCH GAME TAB ===== */}
            {activeTab === 'match' && (
                <>
                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className={`border-b border-${currentTheme.border}`}>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Rank</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
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
                                                        <tr key={entry.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                                            <td className="py-2 px-3">
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${badge.color}`}>
                                                                    {rank <= 3 ? badge.emoji : rank}
                                                                </div>
                                                            </td>
                                                            <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>{entry.user.username}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.accent} font-bold text-sm`}>{entry.score}</td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 ? (
                                                                    <span className="text-green-400 font-semibold text-xs">${prizeAmount}</span>
                                                                ) : (
                                                                    <span className={`text-${currentTheme.textMuted} text-xs`}>—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 ? (
                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                                        }`}>
                                                                        {isPaid ? '✓ Paid' : 'Pending'}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {prizeAmount > 0 && (
                                                                    <button
                                                                        onClick={() => togglePaymentStatus(entry, rank)}
                                                                        disabled={saving === entry.id}
                                                                        className={`px-2 py-1 rounded text-xs font-medium ${isPaid ? `bg-${currentTheme.border} text-${currentTheme.textMuted}` : 'bg-green-600 text-white'
                                                                            }`}
                                                                    >
                                                                        {saving === entry.id ? '...' : isPaid ? 'Undo' : 'Mark Paid'}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                                        <p className="text-sm">No games played this week</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
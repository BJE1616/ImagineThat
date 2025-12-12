'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function GamePage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [flippedCards, setFlippedCards] = useState([])
    const [matchedPairs, setMatchedPairs] = useState([])
    const [moves, setMoves] = useState(0)
    const [gameMode, setGameMode] = useState('easy')
    const [gameStarted, setGameStarted] = useState(false)
    const [startTime, setStartTime] = useState(null)
    const [endTime, setEndTime] = useState(null)
    const [loading, setLoading] = useState(true)
    const [leaderboard, setLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [weeklyPrize, setWeeklyPrize] = useState(null)

    useEffect(() => {
        checkUser()
        loadWeeklyPrize()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)
            await loadLeaderboard()
        } catch (error) {
            console.error('Error:', error)
            await loadLeaderboard()
        } finally {
            setLoading(false)
        }
    }

    const loadWeeklyPrize = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data, error } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('is_active', true)
                .single()

            if (data) {
                setWeeklyPrize(data)
            }
        } catch (error) {
            console.log('No prize set for this week')
        }
    }

    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    const loadLeaderboard = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .order('score', { ascending: true })
                .limit(20)

            if (leaderboardError) throw leaderboardError

            const userIds = leaderboardData.map(entry => entry.user_id)
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, username')
                .in('id', userIds)

            if (usersError) throw usersError

            const combined = leaderboardData.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            setLeaderboard(combined)
        } catch (error) {
            console.error('Error loading leaderboard:', error)
        }
    }

    const loadCards = async (mode) => {
        try {
            const limit = mode === 'easy' ? 6 : 8

            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .limit(limit)

            if (error) throw error

            const cardPairs = [...data, ...data].map((card, index) => ({
                ...card,
                uniqueId: index
            }))

            const shuffled = cardPairs.sort(() => Math.random() - 0.5)
            setCards(shuffled)
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const startGame = async (mode) => {
        setGameMode(mode)
        setGameStarted(true)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        setStartTime(Date.now())
        setEndTime(null)
        await loadCards(mode)
    }

    const saveScoreDirectly = async (finalMoves, finalTime, finalScore) => {
        if (!user) return

        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)

        try {
            const { error } = await supabase
                .from('leaderboard')
                .insert([{
                    user_id: user.id,
                    game_mode: gameMode,
                    moves: finalMoves,
                    time_seconds: finalTime,
                    score: finalScore,
                    week_start: weekStart.toISOString().split('T')[0]
                }])

            if (error) throw error

            await loadLeaderboard()
        } catch (error) {
            console.error('Error saving score:', error)
        }
    }

    const handleCardClick = (clickedCard) => {
        if (!gameStarted) return
        if (flippedCards.length === 2) return
        if (flippedCards.some(card => card.uniqueId === clickedCard.uniqueId)) return
        if (matchedPairs.includes(clickedCard.id)) return

        const newFlipped = [...flippedCards, clickedCard]
        setFlippedCards(newFlipped)

        if (newFlipped.length === 2) {
            const newMoves = moves + 1
            setMoves(newMoves)

            if (newFlipped[0].id === newFlipped[1].id) {
                const newMatched = [...matchedPairs, newFlipped[0].id]
                setMatchedPairs(newMatched)
                setTimeout(() => setFlippedCards([]), 500)

                const pairsNeeded = gameMode === 'easy' ? 6 : 8
                if (newMatched.length === pairsNeeded) {
                    const finalTime = Date.now()
                    setEndTime(finalTime)

                    if (user) {
                        setTimeout(() => {
                            const timeSeconds = Math.floor((finalTime - startTime) / 1000)
                            const finalScore = (newMoves * 2) + timeSeconds

                            saveScoreDirectly(newMoves, timeSeconds, finalScore)
                        }, 1000)
                    }
                }
            } else {
                setTimeout(() => setFlippedCards([]), 1000)
            }
        }
    }

    const isCardFlipped = (card) => {
        return flippedCards.some(c => c.uniqueId === card.uniqueId) || matchedPairs.includes(card.id)
    }

    const isGameComplete = () => {
        const pairsNeeded = gameMode === 'easy' ? 6 : 8
        return matchedPairs.length === pairsNeeded && gameStarted
    }

    const getElapsedTime = () => {
        if (!startTime) return 0
        const end = endTime || Date.now()
        return Math.floor((end - startTime) / 1000)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-gray-600">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Memory Card Game</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowLeaderboard(!showLeaderboard)}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                        >
                            🏆 Leaderboard
                        </button>
                        {user ? (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                            >
                                Dashboard
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => router.push('/auth/login')}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => router.push('/auth/register')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Sign Up
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Weekly Prize Banner */}
                {weeklyPrize && (
                    <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded-xl p-6 mb-6 text-center shadow-lg">
                        <p className="text-white font-bold mb-2">🏆 This Week's Prize 🏆</p>
                        {weeklyPrize.is_surprise ? (
                            <>
                                <p className="text-3xl font-bold text-white mb-2">🎁 Surprise Prize! 🎁</p>
                                <p className="text-white">Play to find out what you could win!</p>
                            </>
                        ) : (
                            <>
                                {weeklyPrize.prize_type === 'cash' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">${weeklyPrize.total_prize_pool}</p>
                                        {weeklyPrize.number_of_winners === 1 ? (
                                            <p className="text-white">Winner takes all!</p>
                                        ) : (
                                            <p className="text-white">Split among top {weeklyPrize.number_of_winners} players</p>
                                        )}
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'merchandise' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">🎽 Merchandise Prizes!</p>
                                        <div className="text-white">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'custom' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">🎁 Special Prize!</p>
                                        <div className="text-white">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {weeklyPrize.announcement_text && (
                            <p className="text-white mt-3 italic">"{weeklyPrize.announcement_text}"</p>
                        )}
                    </div>
                )}

                {showLeaderboard && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">🏆 This Week Top 20</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="text-gray-900">
                                    <tr className="border-b">
                                        <th className="text-left py-2">Rank</th>
                                        <th className="text-left py-2">Player</th>
                                        <th className="text-left py-2">Mode</th>
                                        <th className="text-left py-2">Moves</th>
                                        <th className="text-left py-2">Time</th>
                                        <th className="text-left py-2">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-900">
                                    {leaderboard.map((entry, index) => (
                                        <tr key={entry.id} className="border-b">
                                            <td className="py-2">{index + 1}</td>
                                            <td className="py-2">{entry.users.username}</td>
                                            <td className="py-2">{entry.game_mode === 'easy' ? '12 Cards' : '16 Cards'}</td>
                                            <td className="py-2">{entry.moves}</td>
                                            <td className="py-2">{entry.time_seconds}s</td>
                                            <td className="py-2 font-bold">{entry.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {leaderboard.length === 0 && (
                                <p className="text-center text-gray-500 py-4">No scores yet this week!</p>
                            )}
                        </div>
                    </div>
                )}

                {!user && !gameStarted && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-6 py-4 rounded-lg mb-6">
                        <p className="text-center">
                            <strong>Want to compete for prizes?</strong>
                            <button
                                onClick={() => router.push('/auth/register')}
                                className="ml-2 underline hover:text-blue-900"
                            >
                                Sign up now!
                            </button>
                        </p>
                    </div>
                )}

                {!gameStarted && (
                    <div className="text-center py-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Challenge!</h2>
                        <p className="text-lg text-gray-600 mb-8">
                            Match all pairs. Lower score wins! Score = (Moves × 2) + Seconds
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => startGame('easy')}
                                className="px-8 py-4 bg-green-600 text-white text-lg rounded-md hover:bg-green-700"
                            >
                                Easy Mode<br />
                                <span className="text-sm">12 Cards</span>
                            </button>
                            <button
                                onClick={() => startGame('challenge')}
                                className="px-8 py-4 bg-red-600 text-white text-lg rounded-md hover:bg-red-700"
                            >
                                Challenge<br />
                                <span className="text-sm">16 Cards</span>
                            </button>
                        </div>
                    </div>
                )}

                {gameStarted && (
                    <>
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div className="text-lg text-gray-900">
                                    <span className="font-bold">Mode:</span> {gameMode === 'easy' ? '12 Cards' : '16 Cards'}
                                </div>
                                <div className="text-lg text-gray-900">
                                    <span className="font-bold">Moves:</span> {moves}
                                </div>
                                <div className="text-lg text-gray-900">
                                    <span className="font-bold">Time:</span> {getElapsedTime()}s
                                </div>
                                <div className="text-lg text-gray-900">
                                    <span className="font-bold">Matches:</span> {matchedPairs.length} / {gameMode === 'easy' ? 6 : 8}
                                </div>
                                <button
                                    onClick={() => setGameStarted(false)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                                >
                                    Quit
                                </button>
                            </div>
                        </div>

                        {isGameComplete() && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg mb-6 text-center">
                                <h3 className="text-2xl font-bold mb-2">🎉 Congratulations!</h3>
                                <p className="text-lg mb-2">
                                    Moves: {moves} | Time: {getElapsedTime()}s | Score: {(moves * 2) + getElapsedTime()}
                                </p>
                                {user ? (
                                    <p className="text-base">Score saved to leaderboard!</p>
                                ) : (
                                    <p className="text-base">
                                        <button
                                            onClick={() => router.push('/auth/register')}
                                            className="underline"
                                        >
                                            Sign up
                                        </button> to save your score!
                                    </p>
                                )}
                            </div>
                        )}

                        <div className={`grid gap-4 ${gameMode === 'easy' ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-4'}`}>
                            {cards.map((card) => (
                                <div
                                    key={card.uniqueId}
                                    onClick={() => handleCardClick(card)}
                                    className="relative h-40 cursor-pointer"
                                >
                                    {!isCardFlipped(card) ? (
                                        // Card Back - Show custom image if available
                                        weeklyPrize?.card_back_image_url ? (
                                            <div className="w-full h-full rounded-lg shadow-lg overflow-hidden border-2 border-indigo-400 bg-indigo-600 flex items-center justify-center">
                                                <img
                                                    src={weeklyPrize.card_back_image_url}
                                                    alt="Card back"
                                                    className="max-w-full max-h-full object-contain p-2"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                                                <span className="text-5xl text-white">?</span>
                                            </div>
                                        )
                                    ) : (
                                        // Card Front - Show business card
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <div className="w-full h-full rounded-lg shadow-lg overflow-hidden">
                                                <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-full rounded-lg p-3 flex flex-col justify-between border-2 shadow-lg"
                                                style={{ backgroundColor: card.card_color || '#fff' }}
                                            >
                                                <h3 className="font-bold text-sm" style={{ color: '#1F2937' }}>{card.title}</h3>
                                                <p className="text-xs" style={{ color: '#6B7280' }}>{card.phone}</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
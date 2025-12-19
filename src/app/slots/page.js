'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ===== SLOT MACHINE PAGE =====
// Fun cartoon-style slot machine with business card symbols

export default function SlotMachinePage() {
    const router = useRouter()

    // ===== STATE =====
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [spinning, setSpinning] = useState(false)
    const [tokenBalance, setTokenBalance] = useState(0)
    const [selectedBet, setSelectedBet] = useState(1)
    const [freeSpinsLeft, setFreeSpinsLeft] = useState(0)
    const [dailyWinnings, setDailyWinnings] = useState(0)
    const [dailyWinCap, setDailyWinCap] = useState(100)
    const [maxFreeSpins, setMaxFreeSpins] = useState(5)
    const [houseEdge, setHouseEdge] = useState(11)
    const [reels, setReels] = useState([null, null, null])
    const [cards, setCards] = useState([])
    const [result, setResult] = useState(null)
    const [recentWinners, setRecentWinners] = useState([])
    const [celebration, setCelebration] = useState(null)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    // ===== LOAD ALL DATA =====
    const loadData = async () => {
        setLoading(true)
        await checkUser()
        await loadSettings()
        await loadCards()
        await loadRecentWinners()
        setLoading(false)
    }

    // ===== CHECK USER =====
    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/auth/login')
                return
            }
            setUser(authUser)

            // Load token balance
            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('balance')
                .eq('user_id', authUser.id)
                .single()
            setTokenBalance(balanceData?.balance || 0)

            // Load today's spin data
            const today = new Date().toISOString().split('T')[0]
            const { data: dailyData } = await supabase
                .from('user_daily_spins')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('spin_date', today)
                .single()

            if (dailyData) {
                setFreeSpinsLeft(Math.max(0, maxFreeSpins - (dailyData.free_spins_used || 0)))
                setDailyWinnings(dailyData.tokens_won || 0)
            } else {
                setFreeSpinsLeft(maxFreeSpins)
                setDailyWinnings(0)
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    // ===== LOAD SETTINGS =====
    const loadSettings = async () => {
        try {
            const { data } = await supabase
                .from('game_bb_settings')
                .select('*')
                .eq('game_key', 'slot_machine')
                .single()

            if (data) {
                setMaxFreeSpins(data.free_plays_per_day || 5)
                setDailyWinCap(data.daily_bb_cap || 100)
                setHouseEdge(100 - (data.bb_award_chance || 89))
            }

            // Also check economy settings
            const { data: econData } = await supabase
                .from('economy_settings')
                .select('*')
                .eq('setting_key', 'house_edge_percent')
                .single()

            if (econData) {
                setHouseEdge(econData.setting_value || 11)
            }
        } catch (error) {
            console.log('Using default slot settings')
        }
    }

    // ===== LOAD CARDS FOR REELS =====
    const loadCards = async () => {
        try {
            // Get cards from active campaigns
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('user_id')
                .eq('status', 'active')

            if (campaigns && campaigns.length > 0) {
                const advertiserIds = [...new Set(campaigns.map(c => c.user_id))]
                const { data: cardsData } = await supabase
                    .from('business_cards')
                    .select('*')
                    .in('user_id', advertiserIds)

                if (cardsData && cardsData.length > 0) {
                    setCards(cardsData)
                    // Set initial random reels
                    setReels([
                        cardsData[Math.floor(Math.random() * cardsData.length)],
                        cardsData[Math.floor(Math.random() * cardsData.length)],
                        cardsData[Math.floor(Math.random() * cardsData.length)]
                    ])
                    return
                }
            }

            // Fallback to house cards
            const { data: houseCards } = await supabase
                .from('business_cards')
                .select('*')
                .eq('is_house_card', true)

            if (houseCards && houseCards.length > 0) {
                setCards(houseCards)
                setReels([
                    houseCards[Math.floor(Math.random() * houseCards.length)],
                    houseCards[Math.floor(Math.random() * houseCards.length)],
                    houseCards[Math.floor(Math.random() * houseCards.length)]
                ])
            }
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    // ===== LOAD RECENT WINNERS =====
    const loadRecentWinners = async () => {
        try {
            const { data } = await supabase
                .from('slot_machine_spins')
                .select('win_amount, created_at, user_id')
                .gte('win_amount', 5)
                .order('created_at', { ascending: false })
                .limit(10)

            if (data && data.length > 0) {
                // Get usernames
                const userIds = [...new Set(data.map(d => d.user_id))]
                const { data: users } = await supabase
                    .from('users')
                    .select('id, username')
                    .in('id', userIds)

                const winnersWithNames = data.map(w => ({
                    ...w,
                    username: users?.find(u => u.id === w.user_id)?.username || 'Player'
                }))
                setRecentWinners(winnersWithNames)
            }
        } catch (error) {
            console.error('Error loading winners:', error)
        }
    }

    // ===== SPIN THE REELS =====
    const spin = async () => {
        if (spinning || cards.length === 0) return
        if (!user) {
            setMessage({ type: 'error', text: 'Please log in to play!' })
            return
        }

        const usingFreeSpin = freeSpinsLeft > 0
        const cost = usingFreeSpin ? 0 : selectedBet

        // Check if can afford
        if (!usingFreeSpin && tokenBalance < cost) {
            setMessage({ type: 'error', text: 'Not enough tokens!' })
            setTimeout(() => setMessage(null), 2000)
            return
        }

        // Check daily win cap
        if (dailyWinnings >= dailyWinCap) {
            setMessage({ type: 'error', text: `Daily win cap reached (${dailyWinCap} tokens)` })
            setTimeout(() => setMessage(null), 2000)
            return
        }

        setSpinning(true)
        setResult(null)
        setCelebration(null)

        // Deduct cost immediately if paid spin
        if (!usingFreeSpin) {
            setTokenBalance(prev => prev - cost)
        }

        // Animate reels
        const spinDuration = 2000
        const intervalTime = 100
        let elapsed = 0

        const spinInterval = setInterval(() => {
            setReels([
                cards[Math.floor(Math.random() * cards.length)],
                cards[Math.floor(Math.random() * cards.length)],
                cards[Math.floor(Math.random() * cards.length)]
            ])
            elapsed += intervalTime
            if (elapsed >= spinDuration) {
                clearInterval(spinInterval)
                finishSpin(usingFreeSpin, cost)
            }
        }, intervalTime)
    }

    // ===== FINISH SPIN =====
    const finishSpin = async (usingFreeSpin, cost) => {
        // Determine result based on house edge
        const random = Math.random() * 100
        const winChance = 100 - houseEdge

        let resultType = 'lose'
        let winMultiplier = 0
        let finalReels = []

        if (random < winChance) {
            // Win! Determine type
            const winRoll = Math.random() * 100
            if (winRoll < 50) {
                // Small win - 2 matching
                resultType = 'small'
                winMultiplier = 1
                const matchCard = cards[Math.floor(Math.random() * cards.length)]
                const otherCard = cards.filter(c => c.id !== matchCard.id)[Math.floor(Math.random() * (cards.length - 1))] || matchCard
                finalReels = [matchCard, matchCard, otherCard]
            } else if (winRoll < 85) {
                // Medium win - 3 matching
                resultType = 'medium'
                winMultiplier = 3
                const matchCard = cards[Math.floor(Math.random() * cards.length)]
                finalReels = [matchCard, matchCard, matchCard]
            } else {
                // Big win - 3 matching with bonus
                resultType = 'big'
                winMultiplier = 5
                const matchCard = cards[Math.floor(Math.random() * cards.length)]
                finalReels = [matchCard, matchCard, matchCard]
            }
        } else {
            // Lose - all different
            const shuffled = [...cards].sort(() => Math.random() - 0.5)
            finalReels = [
                shuffled[0] || cards[0],
                shuffled[1] || cards[Math.min(1, cards.length - 1)],
                shuffled[2] || cards[Math.min(2, cards.length - 1)]
            ]
            // Make sure they're different
            if (finalReels[0]?.id === finalReels[1]?.id || finalReels[1]?.id === finalReels[2]?.id) {
                finalReels = [
                    cards[0],
                    cards[Math.min(1, cards.length - 1)],
                    cards[Math.min(2, cards.length - 1)]
                ]
            }
        }

        setReels(finalReels)

        // Calculate winnings
        const betAmount = usingFreeSpin ? 1 : cost
        let winAmount = Math.floor(betAmount * winMultiplier)

        // Cap winnings at daily limit
        const remainingCap = dailyWinCap - dailyWinnings
        if (winAmount > remainingCap) {
            winAmount = remainingCap
        }

        // Update state
        setResult({ type: resultType, amount: winAmount })

        if (winAmount > 0) {
            setTokenBalance(prev => prev + winAmount)
            setDailyWinnings(prev => prev + winAmount)

            // Celebration for wins
            if (resultType === 'big') {
                setCelebration({ type: 'big', amount: winAmount })
            } else if (resultType === 'medium') {
                setCelebration({ type: 'medium', amount: winAmount })
            } else {
                setCelebration({ type: 'small', amount: winAmount })
            }
            setTimeout(() => setCelebration(null), 3000)
        }

        // Update free spins
        if (usingFreeSpin) {
            setFreeSpinsLeft(prev => prev - 1)
        }

        // Save to database
        await saveSpinResult(usingFreeSpin, cost, winAmount, resultType, finalReels)

        setSpinning(false)

        // Reload winners
        if (winAmount >= 5) {
            loadRecentWinners()
        }
    }

    // ===== SAVE SPIN RESULT =====
    const saveSpinResult = async (usingFreeSpin, cost, winAmount, resultType, finalReels) => {
        try {
            // Save spin record
            await supabase
                .from('slot_machine_spins')
                .insert([{
                    user_id: user.id,
                    bet_amount: usingFreeSpin ? 0 : cost,
                    win_amount: winAmount,
                    result_type: resultType,
                    reel_results: finalReels.map(r => r?.id)
                }])

            // Update daily tracking
            const today = new Date().toISOString().split('T')[0]
            const { data: existing } = await supabase
                .from('user_daily_spins')
                .select('*')
                .eq('user_id', user.id)
                .eq('spin_date', today)
                .single()

            if (existing) {
                await supabase
                    .from('user_daily_spins')
                    .update({
                        free_spins_used: usingFreeSpin ? existing.free_spins_used + 1 : existing.free_spins_used,
                        paid_spins: usingFreeSpin ? existing.paid_spins : existing.paid_spins + 1,
                        tokens_won: existing.tokens_won + winAmount,
                        tokens_wagered: existing.tokens_wagered + (usingFreeSpin ? 0 : cost)
                    })
                    .eq('id', existing.id)
            } else {
                await supabase
                    .from('user_daily_spins')
                    .insert([{
                        user_id: user.id,
                        spin_date: today,
                        free_spins_used: usingFreeSpin ? 1 : 0,
                        paid_spins: usingFreeSpin ? 0 : 1,
                        tokens_won: winAmount,
                        tokens_wagered: usingFreeSpin ? 0 : cost
                    }])
            }

            // Update token balance in database
            if (winAmount > 0 || !usingFreeSpin) {
                const netChange = winAmount - (usingFreeSpin ? 0 : cost)
                const { data: balanceData } = await supabase
                    .from('bb_balances')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (balanceData) {
                    await supabase
                        .from('bb_balances')
                        .update({
                            balance: balanceData.balance + netChange,
                            total_earned: winAmount > 0 ? balanceData.total_earned + winAmount : balanceData.total_earned,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', user.id)
                }

                // Record transaction
                if (winAmount > 0) {
                    await supabase
                        .from('bb_transactions')
                        .insert([{
                            user_id: user.id,
                            type: 'earn',
                            amount: winAmount,
                            source: 'slot_machine',
                            description: `Slot machine ${resultType} win`
                        }])
                }
                if (!usingFreeSpin && cost > 0) {
                    await supabase
                        .from('bb_transactions')
                        .insert([{
                            user_id: user.id,
                            type: 'spend',
                            amount: cost,
                            source: 'slot_machine',
                            description: 'Slot machine spin'
                        }])
                }
            }

            // Track ad views for cards shown
            for (const card of finalReels) {
                if (card?.user_id) {
                    const { data: campaign } = await supabase
                        .from('ad_campaigns')
                        .select('id, views_from_game')
                        .eq('user_id', card.user_id)
                        .eq('status', 'active')
                        .limit(1)
                        .single()

                    if (campaign) {
                        await supabase
                            .from('ad_campaigns')
                            .update({ views_from_game: (campaign.views_from_game || 0) + 1 })
                            .eq('id', campaign.id)
                    }
                }
            }
        } catch (error) {
            console.error('Error saving spin:', error)
        }
    }

    // ===== FORMAT TIME AGO =====
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    // ===== MASK USERNAME =====
    const maskUsername = (username) => {
        if (!username || username.length < 3) return '***'
        return username.substring(0, 3) + '***'
    }

    // ===== LOADING =====
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400">Loading slot machine...</p>
                </div>
            </div>
        )
    }

    // ===== RENDER =====
    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-900 via-slate-900 to-slate-900 pb-8">
            {/* ===== CELEBRATION OVERLAY ===== */}
            {celebration && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className={`text-center animate-bounce ${celebration.type === 'big' ? 'scale-150' : ''}`}>
                        <div className={`text-4xl sm:text-6xl font-bold drop-shadow-lg ${celebration.type === 'big' ? 'text-yellow-400' :
                                celebration.type === 'medium' ? 'text-green-400' : 'text-blue-400'
                            }`}>
                            +{celebration.amount} Tokens!
                        </div>
                        <div className="text-6xl mt-2">
                            {celebration.type === 'big' ? '🎉🎊🎉' : celebration.type === 'medium' ? '🎉' : '✨'}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== HEADER ===== */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 py-3 shadow-lg">
                <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        🎰 Lucky Cards
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="bg-black/30 rounded-lg px-3 py-1">
                            <span className="text-yellow-300 font-bold">🪙 {tokenBalance}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="max-w-2xl mx-auto px-4 pt-6">
                {/* Message */}
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-center text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* ===== SLOT MACHINE ===== */}
                <div className="bg-gradient-to-b from-red-800 to-red-900 rounded-3xl p-4 shadow-2xl border-4 border-yellow-500">
                    {/* Machine Top */}
                    <div className="text-center mb-4">
                        <div className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-600 text-red-900 font-bold text-lg px-6 py-1 rounded-full shadow-lg">
                            ⭐ LUCKY CARDS ⭐
                        </div>
                    </div>

                    {/* Reels Container */}
                    <div className="bg-black/50 rounded-2xl p-4 mb-4">
                        <div className="grid grid-cols-3 gap-2">
                            {reels.map((card, index) => (
                                <div
                                    key={index}
                                    className={`aspect-[3/4] rounded-lg overflow-hidden border-4 ${spinning ? 'border-yellow-400 animate-pulse' :
                                            result?.type === 'big' ? 'border-yellow-400 shadow-lg shadow-yellow-500/50' :
                                                result?.type === 'medium' ? 'border-green-400 shadow-lg shadow-green-500/50' :
                                                    result?.type === 'small' && index < 2 ? 'border-blue-400' :
                                                        'border-slate-600'
                                        } bg-white transition-all`}
                                >
                                    {card ? (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <img
                                                src={card.image_url}
                                                alt="Card"
                                                className={`w-full h-full object-cover ${spinning ? 'blur-sm' : ''}`}
                                            />
                                        ) : (
                                            <div
                                                className={`w-full h-full flex items-center justify-center p-2 ${spinning ? 'blur-sm' : ''}`}
                                                style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                            >
                                                <p className="text-xs font-bold text-center" style={{ color: card.text_color || '#FFFFFF' }}>
                                                    {card.title}
                                                </p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                            <span className="text-4xl">🎴</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Result Display */}
                        {result && !spinning && (
                            <div className={`mt-3 text-center py-2 rounded-lg ${result.type === 'big' ? 'bg-yellow-500/20 text-yellow-400' :
                                    result.type === 'medium' ? 'bg-green-500/20 text-green-400' :
                                        result.type === 'small' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-slate-700/50 text-slate-400'
                                }`}>
                                {result.type === 'lose' ? (
                                    <span>No match - Try again!</span>
                                ) : (
                                    <span className="font-bold">
                                        {result.type === 'big' ? '🎊 JACKPOT! ' : result.type === 'medium' ? '🎉 TRIPLE! ' : '✨ PAIR! '}
                                        Won {result.amount} tokens!
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="space-y-3">
                        {/* Free Spins / Daily Cap */}
                        <div className="flex justify-between text-sm">
                            <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                                🎁 Free Spins: {freeSpinsLeft}/{maxFreeSpins}
                            </div>
                            <div className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full">
                                Today: 🪙{dailyWinnings}/{dailyWinCap}
                            </div>
                        </div>

                        {/* Bet Selector (only if no free spins) */}
                        {freeSpinsLeft === 0 && (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-white text-sm">Bet:</span>
                                {[1, 5, 10].map(bet => (
                                    <button
                                        key={bet}
                                        onClick={() => setSelectedBet(bet)}
                                        disabled={spinning}
                                        className={`px-4 py-2 rounded-lg font-bold transition-all ${selectedBet === bet
                                                ? 'bg-yellow-500 text-slate-900 scale-110'
                                                : 'bg-slate-700 text-white hover:bg-slate-600'
                                            }`}
                                    >
                                        🪙{bet}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Spin Button */}
                        <button
                            onClick={spin}
                            disabled={spinning || cards.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-xl transition-all ${spinning
                                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500 shadow-lg hover:shadow-green-500/30 active:scale-95'
                                }`}
                        >
                            {spinning ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">🎰</span> Spinning...
                                </span>
                            ) : freeSpinsLeft > 0 ? (
                                <span>🎁 FREE SPIN!</span>
                            ) : (
                                <span>🎰 SPIN ({selectedBet} tokens)</span>
                            )}
                        </button>

                        {/* Pay Table */}
                        <div className="bg-black/30 rounded-lg p-3 text-xs">
                            <p className="text-yellow-400 font-bold mb-1 text-center">💰 Pay Table</p>
                            <div className="grid grid-cols-3 gap-2 text-center text-slate-300">
                                <div>🎴🎴❌<br />Pair = 1x</div>
                                <div>🎴🎴🎴<br />Triple = 3x</div>
                                <div>⭐⭐⭐<br />Jackpot = 5x</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== RECENT WINNERS ===== */}
                {recentWinners.length > 0 && (
                    <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                            🏆 Recent Winners
                        </h2>
                        <div className="space-y-2">
                            {recentWinners.slice(0, 5).map((winner, i) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-slate-700/30 rounded-lg px-3 py-2">
                                    <span className="text-slate-300">{maskUsername(winner.username)}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400 font-bold">🪙 {winner.win_amount}</span>
                                        <span className="text-slate-500 text-xs">{timeAgo(winner.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
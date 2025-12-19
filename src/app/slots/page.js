'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ===== SLOT MACHINE PAGE =====

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
    const [dailySpinsUsed, setDailySpinsUsed] = useState(0)
    const [maxFreeSpins, setMaxFreeSpins] = useState(5)
    const [reels, setReels] = useState([null, null, null])
    const [cards, setCards] = useState([])
    const [result, setResult] = useState(null)
    const [recentWinners, setRecentWinners] = useState([])
    const [weeklyEntries, setWeeklyEntries] = useState(0)
    const [celebration, setCelebration] = useState(null)
    const [message, setMessage] = useState(null)
    const [viewedAdvertisersToday, setViewedAdvertisersToday] = useState(new Set())

    // ===== LEADERBOARD STATE =====
    const [leaderboard, setLeaderboard] = useState([])
    const [userRank, setUserRank] = useState(null)
    const [unclaimedReward, setUnclaimedReward] = useState(null)
    const [claimingReward, setClaimingReward] = useState(false)

    // ===== ODDS SETTINGS =====
    const [odds, setOdds] = useState({
        loseChance: 55,
        pairChance: 30,
        tripleChance: 12,
        jackpotChance: 3,
        pairMultiplier: 1.0,
        tripleMultiplier: 2.0,
        jackpotMultiplier: 4.0
    })

    // ===== ENTRY MODE SETTINGS =====
    const entryRewards = {
        lose: 0,
        pair: 1,
        triple: 3,
        jackpot: 5
    }

    useEffect(() => {
        loadData()
    }, [])

    // ===== LOAD ALL DATA =====
    const loadData = async () => {
        setLoading(true)
        await loadSettings()
        await checkUser()
        await loadCards()
        await loadRecentWinners()
        await loadLeaderboard()
        setLoading(false)
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
                setOdds({
                    loseChance: data.lose_chance || 55,
                    pairChance: data.pair_chance || 30,
                    tripleChance: data.triple_chance || 12,
                    jackpotChance: data.jackpot_chance || 3,
                    pairMultiplier: data.pair_multiplier || 1.0,
                    tripleMultiplier: data.triple_multiplier || 2.0,
                    jackpotMultiplier: data.jackpot_multiplier || 4.0
                })
            }
        } catch (error) {
            console.log('Using default slot settings')
        }
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

            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('balance')
                .eq('user_id', authUser.id)
                .single()
            setTokenBalance(balanceData?.balance || 0)

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
                setDailySpinsUsed((dailyData.free_spins_used || 0) + (dailyData.paid_spins || 0))
            } else {
                setFreeSpinsLeft(maxFreeSpins)
                setDailyWinnings(0)
                setDailySpinsUsed(0)
            }

            // Load weekly entries (sum of drawing_entries from this week)
            const weekStart = getWeekStart()
            const { data: weeklyData } = await supabase
                .from('user_daily_spins')
                .select('drawing_entries')
                .eq('user_id', authUser.id)
                .gte('spin_date', weekStart.toISOString().split('T')[0])

            const totalEntries = weeklyData?.reduce((sum, day) => sum + (day.drawing_entries || 0), 0) || 0
            setWeeklyEntries(totalEntries)

            // Check for unclaimed rewards
            await checkUnclaimedRewards(authUser.id)

        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    // ===== CHECK UNCLAIMED REWARDS =====
    const checkUnclaimedRewards = async (userId) => {
        try {
            const { data } = await supabase
                .from('daily_leaderboard_results')
                .select('*')
                .eq('user_id', userId)
                .eq('claimed', false)
                .order('result_date', { ascending: false })
                .limit(1)
                .single()

            if (data) {
                setUnclaimedReward(data)
            }
        } catch (error) {
            // No unclaimed rewards
        }
    }

    // ===== CLAIM REWARD =====
    const claimReward = async () => {
        if (!unclaimedReward || claimingReward) return
        setClaimingReward(true)

        try {
            // Update balance
            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (balanceData) {
                await supabase
                    .from('bb_balances')
                    .update({
                        balance: balanceData.balance + unclaimedReward.bonus_tokens_awarded,
                        lifetime_earned: (balanceData.lifetime_earned || 0) + unclaimedReward.bonus_tokens_awarded,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)

                setTokenBalance(prev => prev + unclaimedReward.bonus_tokens_awarded)
            }

            // Add transaction record
            await supabase
                .from('bb_transactions')
                .insert([{
                    user_id: user.id,
                    type: 'earn',
                    amount: unclaimedReward.bonus_tokens_awarded,
                    source: 'leaderboard_reward',
                    description: `Daily leaderboard #${unclaimedReward.place} reward`
                }])

            // Add drawing entries to today's record
            const today = new Date().toISOString().split('T')[0]
            const { data: todayData } = await supabase
                .from('user_daily_spins')
                .select('*')
                .eq('user_id', user.id)
                .eq('spin_date', today)
                .single()

            if (todayData) {
                await supabase
                    .from('user_daily_spins')
                    .update({
                        drawing_entries: (todayData.drawing_entries || 0) + unclaimedReward.bonus_entries_awarded
                    })
                    .eq('id', todayData.id)
            } else {
                await supabase
                    .from('user_daily_spins')
                    .insert([{
                        user_id: user.id,
                        spin_date: today,
                        free_spins_used: 0,
                        paid_spins: 0,
                        tokens_won: 0,
                        tokens_wagered: 0,
                        drawing_entries: unclaimedReward.bonus_entries_awarded
                    }])
            }

            setWeeklyEntries(prev => prev + unclaimedReward.bonus_entries_awarded)

            // Mark as claimed
            await supabase
                .from('daily_leaderboard_results')
                .update({
                    claimed: true,
                    claimed_at: new Date().toISOString()
                })
                .eq('id', unclaimedReward.id)

            setCelebration({
                type: 'reward',
                tokens: unclaimedReward.bonus_tokens_awarded,
                entries: unclaimedReward.bonus_entries_awarded,
                place: unclaimedReward.place
            })
            setTimeout(() => setCelebration(null), 3000)

            setUnclaimedReward(null)
        } catch (error) {
            console.error('Error claiming reward:', error)
            setMessage({ type: 'error', text: 'Failed to claim reward. Please try again.' })
        }

        setClaimingReward(false)
    }

    // ===== LOAD LEADERBOARD =====
    const loadLeaderboard = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]

            // Get all users' spins for today
            const { data: spinsData } = await supabase
                .from('user_daily_spins')
                .select('user_id, free_spins_used, paid_spins')
                .eq('spin_date', today)
                .order('free_spins_used', { ascending: false })

            if (!spinsData || spinsData.length === 0) {
                setLeaderboard([])
                return
            }

            // Calculate total spins and sort
            const leaderboardData = spinsData.map(s => ({
                user_id: s.user_id,
                total_spins: (s.free_spins_used || 0) + (s.paid_spins || 0)
            })).sort((a, b) => b.total_spins - a.total_spins)

            // Get usernames
            const userIds = leaderboardData.map(l => l.user_id)
            const { data: users } = await supabase
                .from('users')
                .select('id, username')
                .in('id', userIds)

            const leaderboardWithNames = leaderboardData.map((l, index) => ({
                ...l,
                username: users?.find(u => u.id === l.user_id)?.username || 'Player',
                rank: index + 1
            }))

            // Determine how many to show: 3, 5, or 10
            let showCount = 3
            if (leaderboardWithNames.length >= 10) showCount = 10
            else if (leaderboardWithNames.length >= 5) showCount = 5

            setLeaderboard(leaderboardWithNames.slice(0, showCount))

            // Find current user's rank
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (authUser) {
                const userEntry = leaderboardWithNames.find(l => l.user_id === authUser.id)
                setUserRank(userEntry?.rank || null)
            }

        } catch (error) {
            console.error('Error loading leaderboard:', error)
        }
    }

    // ===== GET WEEK START =====
    const getWeekStart = () => {
        const now = new Date()
        const day = now.getDay()
        const diff = now.getDate() - day
        const weekStart = new Date(now.setDate(diff))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    // ===== LOAD CARDS =====
    const loadCards = async () => {
        try {
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
                    setReels([
                        cardsData[Math.floor(Math.random() * cardsData.length)],
                        cardsData[Math.floor(Math.random() * cardsData.length)],
                        cardsData[Math.floor(Math.random() * cardsData.length)]
                    ])
                    return
                }
            }

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

    // ===== CHECK IF CAN SPIN =====
    const hitWinCap = dailyWinnings >= dailyWinCap
    const hasFreeSpin = freeSpinsLeft > 0
    const canAffordPaidSpin = tokenBalance >= selectedBet

    // Entry mode: still costs tokens (not free anymore)
    const canSpin = hasFreeSpin || canAffordPaidSpin

    // ===== SPIN =====
    const spin = async () => {
        if (spinning || cards.length === 0 || !canSpin) return
        if (!user) {
            setMessage({ type: 'error', text: 'Please log in to play!' })
            return
        }

        // Free spin only if has free spins (entry mode now costs tokens)
        const usingFreeSpin = freeSpinsLeft > 0
        const cost = usingFreeSpin ? 0 : selectedBet

        setSpinning(true)
        setResult(null)
        setCelebration(null)

        if (!usingFreeSpin) {
            setTokenBalance(prev => prev - cost)
        }

        const spinDuration = 1500
        const intervalTime = 80
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
        const roll = Math.random() * 100

        let resultType = 'lose'
        let winMultiplier = 0
        let finalReels = []

        if (roll < odds.jackpotChance) {
            resultType = 'jackpot'
            winMultiplier = odds.jackpotMultiplier
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            finalReels = [matchCard, matchCard, matchCard]
        } else if (roll < odds.jackpotChance + odds.tripleChance) {
            resultType = 'triple'
            winMultiplier = odds.tripleMultiplier
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            finalReels = [matchCard, matchCard, matchCard]
        } else if (roll < odds.jackpotChance + odds.tripleChance + odds.pairChance) {
            resultType = 'pair'
            winMultiplier = odds.pairMultiplier
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            const otherCards = cards.filter(c => c.id !== matchCard.id)
            const otherCard = otherCards.length > 0 ? otherCards[Math.floor(Math.random() * otherCards.length)] : matchCard
            finalReels = [matchCard, matchCard, otherCard]
        } else {
            resultType = 'lose'
            winMultiplier = 0
            const shuffled = [...cards].sort(() => Math.random() - 0.5)
            if (shuffled.length >= 3) {
                finalReels = [shuffled[0], shuffled[1], shuffled[2]]
            } else {
                finalReels = [cards[0], cards[0], cards[0]]
            }
            if (finalReels[0]?.id === finalReels[1]?.id) {
                const diff = cards.find(c => c.id !== finalReels[0]?.id)
                if (diff) finalReels[1] = diff
            }
            if (finalReels[1]?.id === finalReels[2]?.id) {
                const diff = cards.find(c => c.id !== finalReels[1]?.id && c.id !== finalReels[0]?.id)
                if (diff) finalReels[2] = diff
            }
        }

        setReels(finalReels)

        // Calculate winnings
        const betAmount = usingFreeSpin ? 1 : cost
        let winAmount = 0
        let entriesEarned = 0

        if (hitWinCap) {
            // ENTRY MODE: Win tokens based on multiplier, but also earn bonus entries
            winAmount = Math.floor(betAmount * winMultiplier)
            entriesEarned = entryRewards[resultType]
        } else {
            // NORMAL MODE: Just win tokens
            winAmount = Math.floor(betAmount * winMultiplier)
            entriesEarned = 1 // Every spin = 1 entry in normal mode
        }

        // Cap winnings to remaining daily cap (only in normal mode)
        if (!hitWinCap) {
            const remainingCap = dailyWinCap - dailyWinnings
            if (winAmount > remainingCap) {
                winAmount = Math.max(0, remainingCap)
            }
        }

        setResult({
            type: resultType,
            amount: winAmount,
            entries: entriesEarned,
            entryMode: hitWinCap
        })

        if (winAmount > 0) {
            setTokenBalance(prev => prev + winAmount)
            if (!hitWinCap) {
                setDailyWinnings(prev => prev + winAmount)
            }

            if (resultType === 'jackpot') {
                setCelebration({ type: 'jackpot', amount: winAmount, entries: entriesEarned })
            } else if (resultType === 'triple') {
                setCelebration({ type: 'triple', amount: winAmount, entries: entriesEarned })
            } else if (resultType === 'pair') {
                setCelebration({ type: 'pair', amount: winAmount, entries: entriesEarned })
            }
            setTimeout(() => setCelebration(null), 2500)
        } else if (hitWinCap && entriesEarned > 0) {
            // Entry mode win but no tokens (pair = break even means 0 net)
            setCelebration({ type: 'entries', entries: entriesEarned })
            setTimeout(() => setCelebration(null), 2500)
        }

        if (freeSpinsLeft > 0) {
            setFreeSpinsLeft(prev => prev - 1)
        }

        setDailySpinsUsed(prev => prev + 1)
        setWeeklyEntries(prev => prev + entriesEarned)

        await saveSpinResult(usingFreeSpin, cost, winAmount, resultType, finalReels, entriesEarned)

        setSpinning(false)

        // Refresh leaderboard after spin
        loadLeaderboard()

        if (winAmount >= 5) {
            loadRecentWinners()
        }
    }

    // ===== SAVE SPIN =====
    const saveSpinResult = async (usingFreeSpin, cost, winAmount, resultType, finalReels, entriesEarned) => {
        try {
            await supabase
                .from('slot_machine_spins')
                .insert([{
                    user_id: user.id,
                    bet_amount: usingFreeSpin ? 0 : cost,
                    win_amount: winAmount,
                    result_type: resultType,
                    reel_results: finalReels.map(r => r?.id)
                }])

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
                        paid_spins: (!usingFreeSpin) ? existing.paid_spins + 1 : existing.paid_spins,
                        tokens_won: existing.tokens_won + winAmount,
                        tokens_wagered: existing.tokens_wagered + (usingFreeSpin ? 0 : cost),
                        drawing_entries: (existing.drawing_entries || 0) + entriesEarned
                    })
                    .eq('id', existing.id)
            } else {
                await supabase
                    .from('user_daily_spins')
                    .insert([{
                        user_id: user.id,
                        spin_date: today,
                        free_spins_used: usingFreeSpin ? 1 : 0,
                        paid_spins: (!usingFreeSpin) ? 1 : 0,
                        tokens_won: winAmount,
                        tokens_wagered: usingFreeSpin ? 0 : cost,
                        drawing_entries: entriesEarned
                    }])
            }

            // Update balance
            const netChange = winAmount - (usingFreeSpin ? 0 : cost)
            if (netChange !== 0) {
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
                            lifetime_earned: winAmount > 0 ? (balanceData.lifetime_earned || 0) + winAmount : balanceData.lifetime_earned,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', user.id)
                }
            }

            // Record transactions
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

            // Track ad views
            for (const card of finalReels) {
                if (card?.user_id) {
                    const isFirstView = !viewedAdvertisersToday.has(card.user_id)

                    const { data: campaign } = await supabase
                        .from('ad_campaigns')
                        .select('id, views_from_game, bonus_views')
                        .eq('user_id', card.user_id)
                        .eq('status', 'active')
                        .limit(1)
                        .single()

                    if (campaign) {
                        if (isFirstView) {
                            await supabase
                                .from('ad_campaigns')
                                .update({ views_from_game: (campaign.views_from_game || 0) + 1 })
                                .eq('id', campaign.id)

                            setViewedAdvertisersToday(prev => new Set([...prev, card.user_id]))
                        } else {
                            await supabase
                                .from('ad_campaigns')
                                .update({ bonus_views: (campaign.bonus_views || 0) + 1 })
                                .eq('id', campaign.id)
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error saving spin:', error)
        }
    }

    // ===== HELPERS =====
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h`
        return `${Math.floor(hours / 24)}d`
    }

    const maskUsername = (username) => {
        if (!username || username.length < 3) return '***'
        return username.substring(0, 3) + '***'
    }

    const getRankEmoji = (rank) => {
        if (rank === 1) return '🥇'
        if (rank === 2) return '🥈'
        if (rank === 3) return '🥉'
        return `#${rank}`
    }

    const getRewardForPlace = (place) => {
        if (place === 1) return { entries: 10, tokens: 50 }
        if (place === 2) return { entries: 5, tokens: 25 }
        if (place === 3) return { entries: 3, tokens: 10 }
        return { entries: 0, tokens: 0 }
    }

    const winCapPercent = Math.min(100, (dailyWinnings / dailyWinCap) * 100)

    // ===== LOADING =====
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-slate-900">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // ===== RENDER =====
    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-900 via-slate-900 to-slate-900 py-3 px-2">
            {/* ===== CELEBRATION ===== */}
            {celebration && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="text-center animate-bounce">
                        {celebration.type === 'reward' ? (
                            <>
                                <div className="text-3xl font-bold text-yellow-400 drop-shadow-lg">
                                    🎉 #{celebration.place} Reward Claimed!
                                </div>
                                <div className="text-xl text-white mt-2">
                                    +{celebration.tokens} 🪙 &nbsp; +{celebration.entries} 🎟️
                                </div>
                            </>
                        ) : celebration.type === 'entries' ? (
                            <>
                                <div className="text-2xl font-bold text-purple-400 drop-shadow-lg">
                                    🎟️ +{celebration.entries} Entries!
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={`text-3xl font-bold drop-shadow-lg ${celebration.type === 'jackpot' ? 'text-yellow-400 text-4xl' :
                                    celebration.type === 'triple' ? 'text-green-400' : 'text-blue-400'
                                    }`}>
                                    +{celebration.amount} Tokens!
                                </div>
                                {celebration.entries > 1 && (
                                    <div className="text-lg text-purple-400 mt-1">
                                        +{celebration.entries} 🎟️ Entries!
                                    </div>
                                )}
                                <div className="text-4xl mt-1">
                                    {celebration.type === 'jackpot' ? '🎉🎊🎉' : celebration.type === 'triple' ? '🎉' : '✨'}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-xs sm:max-w-sm md:max-w-md mx-auto">
                {/* ===== UNCLAIMED REWARD BANNER ===== */}
                {unclaimedReward && (
                    <div className="mb-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-lg p-3 text-center">
                        <p className="text-yellow-400 font-bold text-sm mb-1">
                            🎉 You placed #{unclaimedReward.place} yesterday!
                        </p>
                        <p className="text-yellow-200 text-xs mb-2">
                            Reward: +{unclaimedReward.bonus_tokens_awarded} 🪙 &nbsp; +{unclaimedReward.bonus_entries_awarded} 🎟️
                        </p>
                        <button
                            onClick={claimReward}
                            disabled={claimingReward}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:from-yellow-400 hover:to-orange-400 active:scale-95 transition-all"
                        >
                            {claimingReward ? 'Claiming...' : '🎁 Claim Reward!'}
                        </button>
                    </div>
                )}

                {/* ===== HEADER ===== */}
                <div className="text-center mb-2">
                    <h1 className="text-lg font-bold text-white">🎰 Lucky Cards</h1>
                    <div className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500 rounded-full px-3 py-1 mt-1">
                        <span className="text-yellow-200 text-xs">Your Token Balance:</span>
                        <span className="text-yellow-400 font-bold text-lg">🪙 {tokenBalance}</span>
                    </div>
                </div>

                {/* ===== MESSAGE ===== */}
                {message && (
                    <div className={`mb-2 p-2 rounded text-center text-xs ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* ===== WIN CAP MESSAGE ===== */}
                {hitWinCap && (
                    <div className="mb-2 p-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-center">
                        <p className="text-purple-400 text-xs font-bold">🎟️ Entry Mode Active!</p>
                        <p className="text-purple-300 text-[10px]">You've hit today's free token cap. Now your wins earn drawing entries instead!</p>
                    </div>
                )}

                {/* ===== SLOT MACHINE ===== */}
                <div className="bg-gradient-to-b from-red-700 to-red-900 rounded-xl p-2 shadow-xl border-2 border-yellow-500">
                    {/* Title */}
                    <div className="text-center mb-2">
                        <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-red-900 font-bold text-xs px-3 py-0.5 rounded-full">
                            ⭐ LUCKY CARDS ⭐
                        </span>
                    </div>

                    {/* Reels */}
                    <div className="bg-black/40 rounded-lg p-2 mb-2">
                        <div className="grid grid-cols-3 gap-1">
                            {reels.map((card, index) => (
                                <div
                                    key={index}
                                    className={`rounded overflow-hidden border-2 ${spinning ? 'border-yellow-400' :
                                        result?.type === 'jackpot' ? 'border-yellow-400 shadow-lg shadow-yellow-500/50' :
                                            result?.type === 'triple' ? 'border-green-400' :
                                                result?.type === 'pair' && index < 2 ? 'border-blue-400' :
                                                    'border-slate-600'
                                        } bg-white`}
                                    style={{ aspectRatio: '3.5 / 2' }}
                                >
                                    {card ? (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <img
                                                src={card.image_url}
                                                alt="Card"
                                                className={`w-full h-full object-contain bg-slate-100 ${spinning ? 'blur-sm' : ''}`}
                                            />
                                        ) : (
                                            <div
                                                className={`w-full h-full flex items-center justify-center p-1 ${spinning ? 'blur-sm' : ''}`}
                                                style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                            >
                                                <p className="text-[9px] font-bold text-center leading-tight break-words" style={{ color: card.text_color || '#FFF' }}>
                                                    {card.title}
                                                </p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                            <span className="text-lg">🎴</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Result */}
                        {result && !spinning && (
                            <div className={`mt-2 text-center py-1 rounded text-xs ${result.entryMode ? 'bg-purple-500/30 text-purple-400' :
                                result.type === 'jackpot' ? 'bg-yellow-500/30 text-yellow-400' :
                                    result.type === 'triple' ? 'bg-green-500/20 text-green-400' :
                                        result.type === 'pair' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-slate-700/50 text-slate-400'
                                }`}>
                                {result.entryMode ? (
                                    result.type === 'lose' ? '❌ No entries earned' :
                                        `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} +${result.entries} 🎟️${result.amount > 0 ? ` +${result.amount} 🪙` : ''}`
                                ) : (
                                    result.type === 'lose' ? 'No match - Try again!' :
                                        `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} Won ${result.amount} tokens!`
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-1 mb-2 text-[9px]">
                        <div className="bg-black/30 rounded p-1.5">
                            <div className="flex justify-between text-slate-300 mb-0.5">
                                <span>Bonus Tokens Won Today:</span>
                                <span className="text-yellow-400">{dailyWinnings}/{dailyWinCap}</span>
                            </div>
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 transition-all" style={{ width: `${winCapPercent}%` }}></div>
                            </div>
                            <p className="text-slate-500 text-[7px] mt-0.5">Max tokens you can win today</p>
                        </div>
                        <div className="bg-black/30 rounded p-1.5">
                            <div className="flex justify-between text-slate-300 mb-0.5">
                                <span>Total Spins Today:</span>
                                <span className="text-blue-400 font-bold">{dailySpinsUsed}</span>
                            </div>
                            <p className="text-slate-500 text-[7px] mt-0.5">Your total for the leaderboard</p>
                        </div>
                    </div>

                    {/* Free Spins + Weekly Entries */}
                    <div className="flex justify-between text-[10px] mb-2">
                        <div className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            🎁 Free: {freeSpinsLeft}/{maxFreeSpins}
                        </div>
                        <div className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                            🎟️ Entries: {weeklyEntries}
                        </div>
                    </div>

                    {/* Bet Selector - show when no free spins */}
                    {freeSpinsLeft === 0 && (
                        <div className="flex items-center justify-center gap-1 mb-2">
                            <span className="text-white text-[10px]">Bet:</span>
                            {[1, 5, 10].map(bet => (
                                <button
                                    key={bet}
                                    onClick={() => setSelectedBet(bet)}
                                    disabled={spinning}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-all ${selectedBet === bet
                                        ? hitWinCap ? 'bg-purple-500 text-white scale-105' : 'bg-yellow-500 text-slate-900 scale-105'
                                        : 'bg-slate-700 text-white hover:bg-slate-600'
                                        }`}
                                >
                                    🪙{bet}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Spin Cost Info */}
                    <div className="text-center text-[10px] text-slate-300 mb-2">
                        {freeSpinsLeft > 0 ? (
                            <span className="text-green-400">✨ This spin is FREE!</span>
                        ) : hitWinCap ? (
                            <span className="text-purple-300 font-bold">🎟️ Betting {selectedBet} token{selectedBet > 1 ? 's' : ''} to win the daily contest</span>
                        ) : (
                            <span>This spin costs <span className="text-yellow-400 font-bold">{selectedBet} token{selectedBet > 1 ? 's' : ''}</span></span>
                        )}
                    </div>

                    {/* Spin Button */}
                    <button
                        onClick={spin}
                        disabled={spinning || cards.length === 0 || !canSpin}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${spinning
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                            : !canSpin
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : hitWinCap
                                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-400 hover:to-purple-500 active:scale-95'
                                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500 active:scale-95'
                            }`}
                    >
                        {spinning ? '🎰 Spinning...' :
                            !canAffordPaidSpin && !hasFreeSpin ? '🪙 Need Tokens' :
                                freeSpinsLeft > 0 ? '🎁 FREE SPIN!' :
                                    hitWinCap ? `🎟️ SPIN FOR ENTRIES (${selectedBet} tokens)` :
                                        `🎰 SPIN (${selectedBet} tokens)`}
                    </button>

                    {/* Pay Table */}
                    <div className="mt-2 bg-black/30 rounded p-1.5">
                        <p className="text-yellow-400 font-bold text-[9px] text-center mb-1">💰 Pay Table</p>
                        <div className="grid grid-cols-3 gap-1 text-center text-slate-300 text-[8px]">
                            <div>🎴🎴❌<br />Pair = {odds.pairMultiplier}x</div>
                            <div>🎴🎴🎴<br />Triple = {odds.tripleMultiplier}x</div>
                            <div>⭐⭐⭐<br />Jackpot = {odds.jackpotMultiplier}x</div>
                        </div>
                        {hitWinCap && (
                            <div className="mt-1 pt-1 border-t border-slate-600">
                                <p className="text-purple-400 font-bold text-[9px] text-center mb-1">🎟️ Entry Mode Rewards</p>
                                <div className="grid grid-cols-3 gap-1 text-center text-purple-300 text-[8px]">
                                    <div>Pair<br />+1 entry</div>
                                    <div>Triple<br />+3 entries</div>
                                    <div>Jackpot<br />+5 entries</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== DAILY LEADERBOARD ===== */}
                {leaderboard.length > 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                        <h2 className="text-white font-bold text-xs mb-1">🏆 Today's Top Spinners</h2>
                        <div className="space-y-0.5">
                            {leaderboard.map((entry, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center justify-between text-[10px] rounded px-2 py-0.5 ${entry.user_id === user?.id
                                        ? 'bg-yellow-500/20 border border-yellow-500/50'
                                        : 'bg-slate-700/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{getRankEmoji(entry.rank)}</span>
                                        <span className={entry.user_id === user?.id ? 'text-yellow-400 font-bold' : 'text-slate-300'}>
                                            {entry.user_id === user?.id ? 'You' : maskUsername(entry.username)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold">{entry.total_spins} spins</span>
                                        {entry.rank <= 3 && (
                                            <span className="text-[9px] text-slate-500">
                                                (+{getRewardForPlace(entry.rank).tokens}🪙 +{getRewardForPlace(entry.rank).entries}🎟️)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {userRank && userRank > leaderboard.length && (
                            <div className="mt-1 text-center text-[10px] text-slate-400">
                                Your rank: #{userRank}
                            </div>
                        )}
                        <div className="mt-1 text-center text-xs text-slate-300">
                            Top 3 win bonus tokens + entries at midnight!
                        </div>
                    </div>
                )}

                {/* ===== NEED TOKENS? ===== */}
                {!canAffordPaidSpin && freeSpinsLeft === 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                        <p className="text-white font-bold text-xs mb-1">💡 Need more tokens?</p>
                        <div className="space-y-1">
                            <Link href="/card-gallery" className="flex items-center gap-2 text-[10px] text-blue-400 hover:text-blue-300">
                                🖼️ Card Gallery - View ads to earn tokens
                            </Link>
                            <Link href="/game" className="flex items-center gap-2 text-[10px] text-green-400 hover:text-green-300">
                                🎮 Match Game - Play to win prizes
                            </Link>
                        </div>
                    </div>
                )}

                {/* ===== RECENT WINNERS ===== */}
                {recentWinners.length > 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                        <h2 className="text-white font-bold text-xs mb-1">🏆 Recent Winners</h2>
                        <div className="space-y-0.5">
                            {recentWinners.slice(0, 5).map((winner, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px] bg-slate-700/30 rounded px-2 py-0.5">
                                    <span className="text-slate-300">{maskUsername(winner.username)}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400 font-bold">🪙{winner.win_amount}</span>
                                        <span className="text-slate-500 text-[9px]">{timeAgo(winner.created_at)}</span>
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
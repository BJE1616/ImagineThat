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

    // ===== WEEKLY PRIZE STATE =====
    const [weeklyPrize, setWeeklyPrize] = useState(null)

    // ===== UI STATE =====
    const [showRecentWinners, setShowRecentWinners] = useState(false)

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
        await loadWeeklyPrize()
        setLoading(false)
    }

    // ===== LOAD WEEKLY PRIZE =====
    const loadWeeklyPrize = async () => {
        try {
            const { data } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('game_type', 'slots')
                .eq('is_active', true)
                .order('week_start', { ascending: false })
                .limit(1)
                .single()

            if (data) {
                setWeeklyPrize(data)
            }
        } catch (error) {
            console.log('No active weekly prize')
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

            const weekStart = getWeekStart()
            const { data: weeklyData } = await supabase
                .from('user_daily_spins')
                .select('drawing_entries')
                .eq('user_id', authUser.id)
                .gte('spin_date', weekStart.toISOString().split('T')[0])

            const totalEntries = weeklyData?.reduce((sum, day) => sum + (day.drawing_entries || 0), 0) || 0
            setWeeklyEntries(totalEntries)

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

            await supabase
                .from('bb_transactions')
                .insert([{
                    user_id: user.id,
                    type: 'earn',
                    amount: unclaimedReward.bonus_tokens_awarded,
                    source: 'leaderboard_reward',
                    description: `Daily leaderboard #${unclaimedReward.place} reward`
                }])

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

            const { data: spinsData } = await supabase
                .from('user_daily_spins')
                .select('user_id, free_spins_used, paid_spins')
                .eq('spin_date', today)
                .order('free_spins_used', { ascending: false })

            if (!spinsData || spinsData.length === 0) {
                setLeaderboard([])
                return
            }

            const leaderboardData = spinsData.map(s => ({
                user_id: s.user_id,
                total_spins: (s.free_spins_used || 0) + (s.paid_spins || 0)
            })).sort((a, b) => b.total_spins - a.total_spins)

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

            let showCount = 3
            if (leaderboardWithNames.length >= 10) showCount = 10
            else if (leaderboardWithNames.length >= 5) showCount = 5

            setLeaderboard(leaderboardWithNames.slice(0, showCount))

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
    const canSpin = hasFreeSpin || canAffordPaidSpin

    // ===== SPIN =====
    const spin = async () => {
        if (spinning || cards.length === 0 || !canSpin) return
        if (!user) {
            setMessage({ type: 'error', text: 'Please log in to play!' })
            return
        }

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

        const betAmount = usingFreeSpin ? 1 : cost
        let winAmount = 0
        let entriesEarned = 0

        if (hitWinCap) {
            winAmount = Math.floor(betAmount * winMultiplier)
            entriesEarned = entryRewards[resultType]
        } else {
            winAmount = Math.floor(betAmount * winMultiplier)
            entriesEarned = 1
        }

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

    const getPrizeDisplay = () => {
        if (!weeklyPrize) return null
        if (weeklyPrize.is_surprise) return '🎁 Surprise!'
        if (weeklyPrize.prize_type === 'cash') return `$${weeklyPrize.total_prize_pool}`
        return weeklyPrize.prize_descriptions?.[0] || 'Special Prize!'
    }

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
        <div className="min-h-screen bg-gradient-to-b from-purple-900 via-slate-900 to-slate-900 py-2 px-2">
            {/* ===== CELEBRATION ===== */}
            {celebration && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="text-center animate-bounce">
                        {celebration.type === 'reward' ? (
                            <>
                                <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">🎉 #{celebration.place} Reward!</div>
                                <div className="text-lg text-white">+{celebration.tokens} 🪙 +{celebration.entries} 🎟️</div>
                            </>
                        ) : celebration.type === 'entries' ? (
                            <div className="text-xl font-bold text-purple-400 drop-shadow-lg">🎟️ +{celebration.entries} Entries!</div>
                        ) : (
                            <>
                                <div className={`text-2xl font-bold drop-shadow-lg ${celebration.type === 'jackpot' ? 'text-yellow-400' : celebration.type === 'triple' ? 'text-green-400' : 'text-blue-400'}`}>
                                    +{celebration.amount} 🪙
                                </div>
                                {celebration.entries > 1 && <div className="text-sm text-purple-400">+{celebration.entries} 🎟️</div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-xs sm:max-w-sm md:max-w-md mx-auto">
                {/* ===== UNCLAIMED REWARD BANNER ===== */}
                {unclaimedReward && (
                    <div className="mb-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-lg p-2 text-center">
                        <p className="text-yellow-400 font-bold text-xs">🎉 You placed #{unclaimedReward.place} yesterday!</p>
                        <button onClick={claimReward} disabled={claimingReward} className="mt-1 bg-yellow-500 text-slate-900 font-bold px-3 py-1 rounded text-xs">
                            {claimingReward ? '...' : `Claim +${unclaimedReward.bonus_tokens_awarded}🪙 +${unclaimedReward.bonus_entries_awarded}🎟️`}
                        </button>
                    </div>
                )}

                {/* ===== MESSAGE ===== */}
                {message && (
                    <div className={`mb-2 p-1.5 rounded text-center text-xs ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {message.text}
                    </div>
                )}

                {/* ===== SLOT MACHINE ===== */}
                <div className="bg-gradient-to-b from-red-700 to-red-900 rounded-xl p-2 shadow-xl border-2 border-yellow-500">
                    {/* Title + Balance + Prize Row */}
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-yellow-400 font-bold text-xs">🎰 Lucky Cards</span>
                        <div className="flex items-center gap-2">
                            {weeklyPrize && (
                                <span className="text-[10px] text-white bg-red-600 px-1.5 py-0.5 rounded">🏆 {getPrizeDisplay()}</span>
                            )}
                            <span className="text-yellow-400 font-bold text-sm">🪙 {tokenBalance}</span>
                        </div>
                    </div>

                    {/* Entry Mode Banner */}
                    {hitWinCap && (
                        <div className="mb-1 p-1 bg-purple-500/30 rounded text-center">
                            <span className="text-purple-300 text-[10px] font-bold">🎟️ Entry Mode: Wins earn drawing entries!</span>
                        </div>
                    )}

                    {/* Reels */}
                    <div className="bg-black/40 rounded-lg p-1.5 mb-1">
                        <div className="grid grid-cols-3 gap-1">
                            {reels.map((card, index) => (
                                <div
                                    key={index}
                                    className={`rounded overflow-hidden border-2 ${spinning ? 'border-yellow-400' :
                                        result?.type === 'jackpot' ? 'border-yellow-400 shadow-lg shadow-yellow-500/50' :
                                            result?.type === 'triple' ? 'border-green-400' :
                                                result?.type === 'pair' && index < 2 ? 'border-blue-400' : 'border-slate-600'
                                        } bg-white`}
                                    style={{ aspectRatio: '3.5 / 2' }}
                                >
                                    {card ? (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <img src={card.image_url} alt="Card" className={`w-full h-full object-contain bg-slate-100 ${spinning ? 'blur-sm' : ''}`} />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center p-1 ${spinning ? 'blur-sm' : ''}`} style={{ backgroundColor: card.card_color || '#4F46E5' }}>
                                                <p className="text-[8px] font-bold text-center leading-tight break-words" style={{ color: card.text_color || '#FFF' }}>{card.title}</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200"><span className="text-lg">🎴</span></div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Result */}
                        {result && !spinning && (
                            <div className={`mt-1 text-center py-0.5 rounded text-[10px] ${result.entryMode ? 'bg-purple-500/30 text-purple-400' :
                                result.type === 'jackpot' ? 'bg-yellow-500/30 text-yellow-400' :
                                    result.type === 'triple' ? 'bg-green-500/20 text-green-400' :
                                        result.type === 'pair' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'
                                }`}>
                                {result.entryMode ? (
                                    result.type === 'lose' ? '❌ No entries' : `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} +${result.entries}🎟️${result.amount > 0 ? ` +${result.amount}🪙` : ''}`
                                ) : (
                                    result.type === 'lose' ? 'No match - Try again!' : `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} +${result.amount}🪙`
                                )}
                            </div>
                        )}
                    </div>

                    {/* Compact Stats Row */}
                    <div className="flex items-center justify-between text-[9px] mb-1 px-1">
                        <span className="text-slate-300">Won: <span className="text-yellow-400">{dailyWinnings}/{dailyWinCap}</span></span>
                        <span className="text-slate-300">Spins: <span className="text-blue-400">{dailySpinsUsed}</span></span>
                        <span className="text-slate-300">Free: <span className="text-green-400">{freeSpinsLeft}/{maxFreeSpins}</span></span>
                        <span className="text-slate-300">Entries: <span className="text-purple-400">{weeklyEntries}</span></span>
                    </div>

                    {/* Bet Selector */}
                    {freeSpinsLeft === 0 && (
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <span className="text-white text-[9px]">Bet:</span>
                            {[1, 5, 10].map(bet => (
                                <button
                                    key={bet}
                                    onClick={() => setSelectedBet(bet)}
                                    disabled={spinning}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedBet === bet
                                        ? hitWinCap ? 'bg-purple-500 text-white' : 'bg-yellow-500 text-slate-900'
                                        : 'bg-slate-700 text-white'
                                        }`}
                                >
                                    {bet}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Spin Button */}
                    <button
                        onClick={spin}
                        disabled={spinning || cards.length === 0 || !canSpin}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${spinning ? 'bg-slate-600 text-slate-400' :
                            !canSpin ? 'bg-slate-600 text-slate-400' :
                                hitWinCap ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white active:scale-95' :
                                    'bg-gradient-to-r from-green-500 to-green-600 text-white active:scale-95'
                            }`}
                    >
                        {spinning ? '🎰 Spinning...' :
                            !canAffordPaidSpin && !hasFreeSpin ? '🪙 Need Tokens' :
                                freeSpinsLeft > 0 ? '🎁 FREE SPIN!' :
                                    hitWinCap ? `🎟️ SPIN (${selectedBet}🪙)` : `🎰 SPIN (${selectedBet}🪙)`}
                    </button>

                    {/* Compact Pay Table */}
                    <div className="mt-1 flex justify-center gap-3 text-[8px] text-slate-400">
                        <span>Pair={odds.pairMultiplier}x</span>
                        <span>Triple={odds.tripleMultiplier}x</span>
                        <span>Jackpot={odds.jackpotMultiplier}x</span>
                    </div>
                    {hitWinCap && (
                        <div className="flex justify-center gap-3 text-[8px] text-purple-400">
                            <span>Pair=+1🎟️</span>
                            <span>Triple=+3🎟️</span>
                            <span>Jackpot=+5🎟️</span>
                        </div>
                    )}
                </div>

                {/* ===== DAILY LEADERBOARD ===== */}
                {leaderboard.length > 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1.5">
                        <h2 className="text-white font-bold text-[10px] mb-1">🏆 Today's Top Spinners</h2>
                        <div className="space-y-0.5">
                            {leaderboard.slice(0, 3).map((entry, i) => (
                                <div key={i} className={`flex items-center justify-between text-[9px] rounded px-1.5 py-0.5 ${entry.user_id === user?.id ? 'bg-yellow-500/20' : 'bg-slate-700/30'}`}>
                                    <span>{getRankEmoji(entry.rank)} {entry.user_id === user?.id ? 'You' : maskUsername(entry.username)}</span>
                                    <span className="text-blue-400">{entry.total_spins} spins</span>
                                </div>
                            ))}
                        </div>
                        {userRank && userRank > 3 && <p className="text-[9px] text-slate-400 text-center mt-1">Your rank: #{userRank}</p>}
                    </div>
                )}

                {/* ===== NEED TOKENS? ===== */}
                {!canAffordPaidSpin && freeSpinsLeft === 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1.5">
                        <p className="text-white font-bold text-[10px] mb-1">💡 Need tokens?</p>
                        <div className="flex gap-2 text-[9px]">
                            <Link href="/card-gallery" className="text-blue-400">🖼️ Card Gallery</Link>
                            <Link href="/game" className="text-green-400">🎮 Match Game</Link>
                        </div>
                    </div>
                )}

                {/* ===== RECENT WINNERS (Expandable) ===== */}
                {recentWinners.length > 0 && (
                    <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1.5">
                        <button onClick={() => setShowRecentWinners(!showRecentWinners)} className="w-full flex items-center justify-between text-[10px]">
                            <span className="text-white font-bold">🏆 Recent Winners</span>
                            <span className="text-slate-400">{showRecentWinners ? '▲' : '▼'}</span>
                        </button>
                        {showRecentWinners && (
                            <div className="mt-1 space-y-0.5">
                                {recentWinners.slice(0, 5).map((winner, i) => (
                                    <div key={i} className="flex items-center justify-between text-[9px] bg-slate-700/30 rounded px-1.5 py-0.5">
                                        <span className="text-slate-300">{maskUsername(winner.username)}</span>
                                        <span className="text-yellow-400">🪙{winner.win_amount}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
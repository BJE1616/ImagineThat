'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

// ===== SLOT MACHINE PAGE =====

// Default values (fallback if database fails)
const DEFAULT_ODDS = {
    jackpotChance: 2,
    tripleChance: 8,
    pairChance: 25,
    jackpotTokens: 100,
    jackpotTickets: 25,
    tripleTokens: 25,
    tripleTickets: 5,
    pairTokens: 5,
    loseTokens: 1
}

export default function SlotMachinePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()

    // ===== STATE =====
    const [user, setUser] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
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

    // ===== ODDS SETTINGS (from admin_settings) =====
    const [odds, setOdds] = useState(DEFAULT_ODDS)
    const [usingFallbackOdds, setUsingFallbackOdds] = useState(false)

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
        await loadSlotOddsFromAdmin()
        await loadGameSettings()
        await checkUser()
        await loadCards()
        await loadRecentWinners()
        await loadLeaderboard()
        await loadWeeklyPrize()
        setLoading(false)
    }

    // ===== LOAD SLOT ODDS FROM ADMIN_SETTINGS =====
    const loadSlotOddsFromAdmin = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', [
                    'slot_jackpot_chance',
                    'slot_triple_chance',
                    'slot_pair_chance',
                    'slot_jackpot_tokens',
                    'slot_jackpot_tickets',
                    'slot_triple_tokens',
                    'slot_triple_tickets',
                    'slot_pair_tokens',
                    'slot_lose_tokens'
                ])

            if (error) throw error

            if (data && data.length > 0) {
                const settingsMap = {}
                data.forEach(item => {
                    settingsMap[item.setting_key] = parseInt(item.setting_value) || 0
                })

                setOdds({
                    jackpotChance: settingsMap.slot_jackpot_chance ?? DEFAULT_ODDS.jackpotChance,
                    tripleChance: settingsMap.slot_triple_chance ?? DEFAULT_ODDS.tripleChance,
                    pairChance: settingsMap.slot_pair_chance ?? DEFAULT_ODDS.pairChance,
                    jackpotTokens: settingsMap.slot_jackpot_tokens ?? DEFAULT_ODDS.jackpotTokens,
                    jackpotTickets: settingsMap.slot_jackpot_tickets ?? DEFAULT_ODDS.jackpotTickets,
                    tripleTokens: settingsMap.slot_triple_tokens ?? DEFAULT_ODDS.tripleTokens,
                    tripleTickets: settingsMap.slot_triple_tickets ?? DEFAULT_ODDS.tripleTickets,
                    pairTokens: settingsMap.slot_pair_tokens ?? DEFAULT_ODDS.pairTokens,
                    loseTokens: settingsMap.slot_lose_tokens ?? DEFAULT_ODDS.loseTokens
                })
                setUsingFallbackOdds(false)
                console.log('✅ Slot odds loaded from admin settings')
            } else {
                throw new Error('No slot settings found')
            }
        } catch (error) {
            console.warn('⚠️ Failed to load slot odds from admin_settings, using defaults:', error.message)
            setOdds(DEFAULT_ODDS)
            setUsingFallbackOdds(true)
        }
    }

    // ===== LOAD GAME SETTINGS (free spins, daily cap) =====
    const loadGameSettings = async () => {
        try {
            const { data } = await supabase
                .from('game_bb_settings')
                .select('*')
                .eq('game_key', 'slot_machine')
                .single()

            if (data) {
                setMaxFreeSpins(data.free_plays_per_day || 5)
                setDailyWinCap(data.daily_bb_cap || 100)
            }
        } catch (error) {
            console.log('Using default game settings')
        }
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

    // ===== CHECK USER =====
    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/auth/login')
                return
            }
            setUser(authUser)

            // Check if user is admin
            const { data: userData } = await supabase
                .from('users')
                .select('is_admin')
                .eq('id', authUser.id)
                .single()

            setIsAdmin(userData?.is_admin || false)

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
                .maybeSingle()

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
        let winAmount = 0
        let ticketsWon = 0
        let finalReels = []

        // Determine result based on admin-configured odds
        if (roll < odds.jackpotChance) {
            resultType = 'jackpot'
            winAmount = odds.jackpotTokens
            ticketsWon = odds.jackpotTickets
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            finalReels = [matchCard, matchCard, matchCard]
        } else if (roll < odds.jackpotChance + odds.tripleChance) {
            resultType = 'triple'
            winAmount = odds.tripleTokens
            ticketsWon = odds.tripleTickets
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            finalReels = [matchCard, matchCard, matchCard]
        } else if (roll < odds.jackpotChance + odds.tripleChance + odds.pairChance) {
            resultType = 'pair'
            winAmount = odds.pairTokens
            ticketsWon = 0
            const matchCard = cards[Math.floor(Math.random() * cards.length)]
            const otherCards = cards.filter(c => c.id !== matchCard.id)
            const otherCard = otherCards.length > 0 ? otherCards[Math.floor(Math.random() * otherCards.length)] : matchCard
            finalReels = [matchCard, matchCard, otherCard]
        } else {
            resultType = 'lose'
            winAmount = -odds.loseTokens
            ticketsWon = 0
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

        let entriesEarned = 0

        // Entry mode (hit win cap) - earn entries instead of tokens
        if (hitWinCap) {
            entriesEarned = entryRewards[resultType]
            // In entry mode, still deduct cost but no token winnings
            if (resultType !== 'lose') {
                winAmount = 0 // No token wins in entry mode
            }
        } else {
            // Normal mode - apply win cap limit
            if (winAmount > 0) {
                const remainingCap = dailyWinCap - dailyWinnings
                if (winAmount > remainingCap) {
                    winAmount = Math.max(0, remainingCap)
                }
            }
        }

        setResult({
            type: resultType,
            amount: winAmount,
            tickets: ticketsWon,
            entries: entriesEarned,
            entryMode: hitWinCap
        })

        // Update token balance
        if (winAmount > 0) {
            setTokenBalance(prev => prev + winAmount)
            setDailyWinnings(prev => prev + winAmount)
        } else if (winAmount < 0 && !usingFreeSpin) {
            // Loss deduction already happened at spin start via cost
            // Additional loss from lose_tokens setting
            const additionalLoss = Math.abs(winAmount)
            if (additionalLoss > 0 && usingFreeSpin) {
                setTokenBalance(prev => Math.max(0, prev - additionalLoss))
            }
        }

        // Celebration effects
        if (winAmount > 0 || ticketsWon > 0) {
            if (resultType === 'jackpot') {
                setCelebration({ type: 'jackpot', amount: winAmount, tickets: ticketsWon, entries: entriesEarned })
            } else if (resultType === 'triple') {
                setCelebration({ type: 'triple', amount: winAmount, tickets: ticketsWon, entries: entriesEarned })
            } else if (resultType === 'pair') {
                setCelebration({ type: 'pair', amount: winAmount, tickets: ticketsWon, entries: entriesEarned })
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
        setWeeklyEntries(prev => prev + entriesEarned + ticketsWon)

        await saveSpinResult(usingFreeSpin, cost, winAmount, resultType, finalReels, entriesEarned + ticketsWon)

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
                    win_amount: Math.max(0, winAmount),
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
                        tokens_won: existing.tokens_won + Math.max(0, winAmount),
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
                        tokens_won: Math.max(0, winAmount),
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

    const getPrizeDisplay = () => {
        if (!weeklyPrize) return null
        if (weeklyPrize.is_surprise) return '🎁 Surprise!'
        if (weeklyPrize.prize_type === 'cash') return `$${weeklyPrize.total_prize_pool}`
        return weeklyPrize.prize_descriptions?.[0] || 'Special Prize!'
    }

    // ===== LOADING =====
    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // ===== RENDER =====
    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-2 px-2`}>
            {/* ===== ADMIN FALLBACK WARNING ===== */}
            {isAdmin && usingFallbackOdds && (
                <div className="fixed top-14 left-2 right-2 z-50 bg-red-500/90 text-white text-xs p-2 rounded-lg text-center">
                    ⚠️ Admin Notice: Using default odds (database connection issue). Check console for details.
                </div>
            )}

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
                                    {celebration.amount > 0 && `+${celebration.amount} 🪙`}
                                </div>
                                {celebration.tickets > 0 && <div className="text-sm text-purple-400">+{celebration.tickets} 🎟️</div>}
                                {celebration.entries > 0 && <div className="text-sm text-purple-400">+{celebration.entries} entries</div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-sm mx-auto">
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

                {/* ===== SLOT MACHINE CABINET ===== */}
                <div className="relative">
                    {/* Outer Cabinet Frame */}
                    <div className="absolute -inset-1 bg-gradient-to-b from-yellow-600 via-yellow-500 to-yellow-700 rounded-2xl"></div>
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-yellow-400 via-amber-300 to-yellow-600 rounded-xl"></div>

                    {/* Inner Machine */}
                    <div className="relative bg-gradient-to-b from-red-800 via-red-900 to-red-950 rounded-xl p-3 shadow-2xl">

                        {/* Corner Lights */}
                        <div className={`absolute top-1 left-1 w-2 h-2 rounded-full ${spinning ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' : 'bg-yellow-600'}`}></div>
                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${spinning ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' : 'bg-yellow-600'}`}></div>
                        <div className={`absolute bottom-1 left-1 w-2 h-2 rounded-full ${spinning ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' : 'bg-yellow-600'}`}></div>
                        <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${spinning ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' : 'bg-yellow-600'}`}></div>

                        {/* Header with Neon Effect */}
                        <div className="text-center mb-2">
                            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 drop-shadow-lg" style={{ textShadow: '0 0 10px rgba(253, 224, 71, 0.5), 0 0 20px rgba(253, 224, 71, 0.3)' }}>
                                🎰 LUCKY CARDS 🎰
                            </h1>
                            <div className="flex items-center justify-center mt-1">
                                <span className="text-yellow-300 font-bold text-sm bg-black/30 px-3 py-0.5 rounded-full">Your Tokens: {tokenBalance} 🪙</span>
                            </div>
                        </div>

                        {/* Weekly Prize & Entries Banner */}
                        <div className="mb-2 bg-gradient-to-r from-purple-900/60 via-purple-800/60 to-purple-900/60 rounded-lg p-2 border border-purple-500/50 text-center">
                            <div className="text-yellow-300 font-bold text-xs mb-1">
                                🏆 THIS WEEK'S PRIZE: {getPrizeDisplay() || 'TBA'}
                            </div>
                            <div className="text-purple-200 text-[11px]">
                                You have <span className="text-yellow-400 font-bold text-sm mx-1 bg-yellow-500/20 px-1.5 py-0.5 rounded">{weeklyEntries}</span> {weeklyEntries === 1 ? 'entry' : 'entries'} into this week's drawing.
                            </div>
                        </div>

                        {/* Entry Mode Banner */}
                        {hitWinCap && (
                            <div className="mb-2 p-1.5 bg-purple-500/30 rounded-lg text-center border border-purple-400/50">
                                <span className="text-purple-200 text-[11px] font-bold">🎟️ ENTRY MODE: Wins earn drawing entries!</span>
                            </div>
                        )}

                        {/* Reel Window Frame */}
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-b from-gray-700 via-gray-800 to-gray-900 rounded-lg"></div>
                            <div className="relative bg-black/80 rounded-lg p-2 border-2 border-gray-600">
                                {/* Reels */}
                                <div className="grid grid-cols-3 gap-2">
                                    {reels.map((card, index) => (
                                        <div
                                            key={index}
                                            className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 ${spinning ? 'border-yellow-400 shadow-lg shadow-yellow-500/30' :
                                                result?.type === 'jackpot' ? 'border-yellow-400 shadow-lg shadow-yellow-500/50 animate-pulse' :
                                                    result?.type === 'triple' ? 'border-green-400 shadow-lg shadow-green-500/30' :
                                                        result?.type === 'pair' && index < 2 ? 'border-blue-400 shadow-lg shadow-blue-500/30' : 'border-gray-500'
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

                                {/* Result Display */}
                                {result && !spinning && (
                                    <div className={`mt-2 text-center py-1 rounded-lg text-xs font-bold ${result.entryMode ? 'bg-purple-500/40 text-purple-200 border border-purple-400/50' :
                                        result.type === 'jackpot' ? 'bg-yellow-500/40 text-yellow-200 border border-yellow-400/50' :
                                            result.type === 'triple' ? 'bg-green-500/30 text-green-200 border border-green-400/50' :
                                                result.type === 'pair' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50' : 'bg-gray-700/50 text-gray-300 border border-gray-500/50'
                                        }`}>
                                        {result.entryMode ? (
                                            result.type === 'lose' ? '❌ No entries' : `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} +${result.entries}🎟️${result.amount > 0 ? ` +${result.amount}🪙` : ''}`
                                        ) : (
                                            result.type === 'lose' ? `No match -${odds.loseTokens}🪙` :
                                                `${result.type === 'jackpot' ? '🎊 JACKPOT!' : result.type === 'triple' ? '🎉 TRIPLE!' : '✨ PAIR!'} +${result.amount}🪙${result.tickets > 0 ? ` +${result.tickets}🎟️` : ''}`
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center justify-center gap-4 text-[10px] mt-2 px-1 py-1.5 bg-black/30 rounded-lg">
                            <span className="text-gray-300">Today's Token Wins: <span className="text-yellow-400 font-bold">{dailyWinnings}/{dailyWinCap}</span></span>
                            <span className="text-gray-300">Free Spins Left: <span className="text-green-400 font-bold">{freeSpinsLeft}/{maxFreeSpins}</span></span>
                        </div>

                        {/* Bet Selector */}
                        {freeSpinsLeft === 0 && (
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <span className="text-yellow-200 text-xs font-medium">BET:</span>
                                {[1, 5, 10].map(bet => (
                                    <button
                                        key={bet}
                                        onClick={() => setSelectedBet(bet)}
                                        disabled={spinning}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedBet === bet
                                            ? hitWinCap ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/30'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {bet}🪙
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Spin Button */}
                        <div className="mt-2">
                            <button
                                onClick={spin}
                                disabled={spinning || cards.length === 0 || !canSpin}
                                className={`w-full py-3 rounded-xl font-bold text-base transition-all transform ${spinning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                                    !canSpin ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                                        hitWinCap ? 'bg-gradient-to-b from-purple-400 via-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/50 hover:from-purple-300 hover:to-purple-600 active:scale-95' :
                                            freeSpinsLeft > 0 ? 'bg-gradient-to-b from-green-400 via-green-500 to-green-700 text-white shadow-lg shadow-green-500/50 hover:from-green-300 hover:to-green-600 active:scale-95' :
                                                'bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-700 text-slate-900 shadow-lg shadow-yellow-500/50 hover:from-yellow-300 hover:to-yellow-600 active:scale-95'
                                    }`}
                                style={{ textShadow: spinning || !canSpin ? 'none' : '0 1px 2px rgba(0,0,0,0.3)' }}
                            >
                                {spinning ? '🎰 SPINNING...' :
                                    !canAffordPaidSpin && !hasFreeSpin ? '🪙 NEED TOKENS' :
                                        freeSpinsLeft > 0 ? '🎁 FREE SPIN!' :
                                            hitWinCap ? `🎟️ SPIN FOR ENTRIES (${selectedBet}🪙)` : `🎰 SPIN (${selectedBet}🪙)`}
                            </button>
                        </div>

                        {/* Pay Table */}
                        <div className="mt-2 text-center">
                            <div className="flex justify-center gap-4 text-[11px] text-yellow-200/80">
                                <span>Pair <span className="text-yellow-400">+{odds.pairTokens}🪙</span></span>
                                <span>Triple <span className="text-yellow-400">+{odds.tripleTokens}🪙</span></span>
                                <span>Jackpot <span className="text-yellow-400">+{odds.jackpotTokens}🪙</span></span>
                            </div>
                            {hitWinCap && (
                                <div className="flex justify-center gap-4 text-[10px] text-purple-300 mt-0.5">
                                    <span>Pair +1🎟️</span>
                                    <span>Triple +3🎟️</span>
                                    <span>Jackpot +5🎟️</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== DAILY LEADERBOARD ===== */}
                {leaderboard.length > 0 && (
                    <div className={`mt-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <h2 className={`text-${currentTheme.text} font-bold text-xs mb-1`}>🏆 Today's Top Spinners</h2>
                        <div className="space-y-1">
                            {leaderboard.slice(0, 3).map((entry, i) => (
                                <div key={i} className={`flex items-center justify-between text-[10px] rounded px-2 py-1 ${entry.user_id === user?.id ? 'bg-yellow-500/20' : `bg-${currentTheme.border}/30`}`}>
                                    <span className={`text-${currentTheme.text}`}>{getRankEmoji(entry.rank)} {entry.user_id === user?.id ? 'You' : maskUsername(entry.username)}</span>
                                    <span className="text-blue-400 font-medium">{entry.total_spins} spins</span>
                                </div>
                            ))}
                        </div>
                        {userRank && userRank > 3 && <p className={`text-[10px] text-${currentTheme.textMuted} text-center mt-1`}>Your rank: #{userRank}</p>}
                    </div>
                )}

                {/* ===== NEED TOKENS? ===== */}
                {!canAffordPaidSpin && freeSpinsLeft === 0 && (
                    <div className={`mt-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <p className={`text-${currentTheme.text} font-bold text-xs mb-1`}>💡 Need tokens?</p>
                        <div className="flex gap-3 text-[11px]">
                            <Link href="/card-gallery" className={`text-${currentTheme.accent} hover:underline`}>🖼️ Card Gallery</Link>
                            <Link href="/game" className={`text-${currentTheme.accent} hover:underline`}>🎮 Match Game</Link>
                        </div>
                    </div>
                )}

                {/* ===== RECENT WINNERS ===== */}
                {recentWinners.length > 0 && (
                    <div className={`mt-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <button onClick={() => setShowRecentWinners(!showRecentWinners)} className="w-full flex items-center justify-between text-xs">
                            <span className={`text-${currentTheme.text} font-bold`}>🏆 Recent Winners</span>
                            <span className={`text-${currentTheme.textMuted}`}>{showRecentWinners ? '▲' : '▼'}</span>
                        </button>
                        {showRecentWinners && (
                            <div className="mt-1 space-y-1">
                                {recentWinners.slice(0, 5).map((winner, i) => (
                                    <div key={i} className={`flex items-center justify-between text-[10px] bg-${currentTheme.border}/30 rounded px-2 py-1`}>
                                        <span className={`text-${currentTheme.textMuted}`}>{maskUsername(winner.username)}</span>
                                        <span className="text-yellow-400 font-medium">🪙{winner.win_amount}</span>
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
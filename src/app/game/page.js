'use client'
import { useEffect, useState, useRef } from 'react'
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
    const [gameComplete, setGameComplete] = useState(false)
    const [startTime, setStartTime] = useState(null)
    const [endTime, setEndTime] = useState(null)
    const [loading, setLoading] = useState(true)
    const [easyLeaderboard, setEasyLeaderboard] = useState([])
    const [challengeLeaderboard, setChallengeLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [weeklyPrize, setWeeklyPrize] = useState(null)
    const [cardBackSetting, setCardBackSetting] = useState(null)
    const [cardBackAdvertiser, setCardBackAdvertiser] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [viewingCard, setViewingCard] = useState(null)
    const trackedGameViews = useRef(new Set())
    const trackedFlipViews = useRef(new Set())
    const [sessionId, setSessionId] = useState(null)
    const trackedCardBackView = useRef(false)

    useEffect(() => {
        checkUser()
        loadWeeklyPrize()
        loadCardBackSetting()
        loadCardBackAdvertiser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)
            await loadLeaderboards()
        } catch (error) {
            console.error('Error:', error)
            await loadLeaderboards()
        } finally {
            setLoading(false)
        }
    }

    const loadCardBackSetting = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')
                .in('setting_key', ['card_back_logo_url', 'show_advertiser_cards'])

            if (data) {
                const settings = {}
                data.forEach(item => {
                    settings[item.setting_key] = item.setting_value
                })
                setCardBackSetting(settings)
            }
        } catch (error) {
            console.log('Error loading card back setting')
        }
    }

    const trackCardBackView = async (cardUserId, viewCount = 1) => {
        if (!cardUserId || trackedCardBackView.current) return
        trackedCardBackView.current = true

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_card_back')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                const campaign = campaigns[0]
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_card_back: (campaign.views_from_card_back || 0) + viewCount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }
        } catch (error) {
            console.log('Error tracking card back view')
        }
    }

    const loadCardBackAdvertiser = async () => {
        try {
            const { data: campaigns, error } = await supabase
                .from('ad_campaigns')
                .select('user_id, views_guaranteed, views_from_game, views_from_flips, bonus_views')
                .eq('status', 'active')

            if (error || !campaigns || campaigns.length === 0) return

            const eligibleCampaigns = campaigns.filter(c => {
                const totalViews = (c.views_from_game || 0) + (c.views_from_flips || 0)
                return totalViews < (c.views_guaranteed || 0) || (c.bonus_views || 0) > 0
            })

            if (eligibleCampaigns.length === 0) return

            const randomCampaign = eligibleCampaigns[Math.floor(Math.random() * eligibleCampaigns.length)]

            const { data: cards, error: cardError } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', randomCampaign.user_id)

            if (cards && cards.length > 0) {
                setCardBackAdvertiser(cards[0])
            } else {
                const userIds = eligibleCampaigns.map(c => c.user_id)
                const { data: anyCards } = await supabase
                    .from('business_cards')
                    .select('*')
                    .in('user_id', userIds)

                if (anyCards && anyCards.length > 0) {
                    setCardBackAdvertiser(anyCards[0])
                }
            }
        } catch (error) {
            console.log('Error loading card back advertiser')
        }
    }

    const loadWeeklyPrize = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('is_active', true)
                .maybeSingle()

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

    const loadLeaderboards = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data: easyData, error: easyError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('game_mode', 'easy')
                .order('score', { ascending: true })
                .limit(10)

            if (easyError) throw easyError

            const { data: challengeData, error: challengeError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('game_mode', 'challenge')
                .order('score', { ascending: true })
                .limit(10)

            if (challengeError) throw challengeError

            const allUserIds = [
                ...easyData.map(entry => entry.user_id),
                ...challengeData.map(entry => entry.user_id)
            ]
            const uniqueUserIds = [...new Set(allUserIds)]

            let usersData = []
            if (uniqueUserIds.length > 0) {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, username')
                    .in('id', uniqueUserIds)

                if (!error) usersData = data || []
            }

            const easyWithUsers = easyData.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            const challengeWithUsers = challengeData.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            setEasyLeaderboard(easyWithUsers)
            setChallengeLeaderboard(challengeWithUsers)
        } catch (error) {
            console.error('Error loading leaderboards:', error)
        }
    }

    // =============================================================================
    // FIXED: trackGameView - Now properly uses promo_card_views for unique tracking
    // =============================================================================
    const trackGameView = async (cardUserId, promoCardId) => {
        if (!cardUserId || trackedGameViews.current.has(cardUserId)) return
        trackedGameViews.current.add(cardUserId)

        try {
            // Get the active campaign for this advertiser
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_game, bonus_views')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (!campaigns || campaigns.length === 0) {
                // No active campaign - check for any campaign and add to bonus_views
                const { data: anyCampaigns } = await supabase
                    .from('ad_campaigns')
                    .select('id, bonus_views')
                    .eq('user_id', cardUserId)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (anyCampaigns && anyCampaigns.length > 0) {
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            bonus_views: (anyCampaigns[0].bonus_views || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', anyCampaigns[0].id)
                }
                return
            }

            const campaign = campaigns[0]
            const viewerUserId = user?.id || null

            // Check if this user has already viewed this promo card (unique view check)
            // For anonymous users, we skip the unique check and count as bonus
            let existingView = null
            if (viewerUserId) {
                const { data } = await supabase
                    .from('promo_card_views')
                    .select('id')
                    .eq('user_id', viewerUserId)
                    .eq('promo_card_id', promoCardId)
                    .maybeSingle()
                existingView = data
            }

            if (!existingView && viewerUserId) {
                // UNIQUE VIEW - First time this logged-in user is seeing this card
                // 1. Insert into promo_card_views to track this unique view
                await supabase
                    .from('promo_card_views')
                    .insert({
                        user_id: viewerUserId,
                        promo_card_id: promoCardId,
                        view_type: 'game_display',
                        game_type: 'memory'
                    })

                // 2. Increment views_from_game (counts toward guaranteed views)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_game: (campaign.views_from_game || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

            } else {
                // BONUS VIEW - User has seen this card before OR is anonymous
                // Only increment bonus_views (does NOT count toward guaranteed)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }

        } catch (error) {
            console.log('Error tracking game view:', error)
        }
    }

    // =============================================================================
    // FIXED: trackFlipView - Now properly uses promo_card_views for unique tracking
    // =============================================================================
    const trackFlipView = async (cardUserId, cardUniqueId, promoCardId) => {
        const trackKey = `${cardUserId}-${cardUniqueId}`
        if (!cardUserId || trackedFlipViews.current.has(trackKey)) return
        trackedFlipViews.current.add(trackKey)

        try {
            // Get the active campaign for this advertiser
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_flips, bonus_views')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (!campaigns || campaigns.length === 0) {
                // No active campaign - check for any campaign and add to bonus_views
                const { data: anyCampaigns } = await supabase
                    .from('ad_campaigns')
                    .select('id, bonus_views')
                    .eq('user_id', cardUserId)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (anyCampaigns && anyCampaigns.length > 0) {
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            bonus_views: (anyCampaigns[0].bonus_views || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', anyCampaigns[0].id)
                }
                return
            }

            const campaign = campaigns[0]
            const viewerUserId = user?.id || null

            // Check if this user has already viewed this promo card (unique view check)
            // For anonymous users, we skip the unique check and count as bonus
            let existingView = null
            if (viewerUserId) {
                const { data } = await supabase
                    .from('promo_card_views')
                    .select('id')
                    .eq('user_id', viewerUserId)
                    .eq('promo_card_id', promoCardId)
                    .maybeSingle()
                existingView = data
            }

            if (!existingView && viewerUserId) {
                // UNIQUE VIEW - First time this logged-in user is seeing this card
                // 1. Insert into promo_card_views to track this unique view
                await supabase
                    .from('promo_card_views')
                    .insert({
                        user_id: viewerUserId,
                        promo_card_id: promoCardId,
                        view_type: 'eyeball_click',
                        game_type: 'memory'
                    })

                // 2. Increment views_from_flips (counts toward guaranteed views)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_flips: (campaign.views_from_flips || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

            } else {
                // BONUS VIEW - User has seen this card before OR is anonymous
                // Only increment bonus_views (does NOT count toward guaranteed)
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)
            }

        } catch (error) {
            console.log('Error tracking flip view:', error)
        }
    }

    const loadCards = async (mode) => {
        try {
            const limit = mode === 'easy' ? 6 : 8
            trackedGameViews.current = new Set()
            trackedFlipViews.current = new Set()

            const { data: activeCampaigns, error: campaignError } = await supabase
                .from('ad_campaigns')
                .select('user_id')
                .eq('status', 'active')

            if (campaignError) throw campaignError

            const activeAdvertiserIds = [...new Set(activeCampaigns?.map(c => c.user_id) || [])]
            let cardsData = []

            if (activeAdvertiserIds.length > 0) {
                let query = supabase
                    .from('business_cards')
                    .select('*')
                    .in('user_id', activeAdvertiserIds)

                if (cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser?.user_id) {
                    query = query.neq('user_id', cardBackAdvertiser.user_id)
                }

                const { data, error } = await query
                if (error) throw error
                cardsData = data || []
            }

            if (cardsData.length < limit) {
                const { data: houseCards, error } = await supabase
                    .from('business_cards')
                    .select('*')
                    .eq('is_house_card', true)

                if (!error && houseCards && houseCards.length > 0) {
                    const shuffledHouse = houseCards.sort(() => Math.random() - 0.5)
                    while (cardsData.length < limit && shuffledHouse.length > 0) {
                        cardsData.push(shuffledHouse.pop())
                    }
                }
            }

            if (cardsData.length === 0) {
                alert('No business cards available yet. Check back soon!')
                setGameStarted(false)
                return
            }

            let selectedCards = []
            while (selectedCards.length < limit) {
                const shuffled = [...cardsData].sort(() => Math.random() - 0.5)
                selectedCards = [...selectedCards, ...shuffled].slice(0, limit)
            }

            const cardPairs = []
            selectedCards.forEach((card, pairIndex) => {
                cardPairs.push({ ...card, uniqueId: pairIndex * 2, pairId: pairIndex })
                cardPairs.push({ ...card, uniqueId: pairIndex * 2 + 1, pairId: pairIndex })
            })

            const shuffled = cardPairs.sort(() => Math.random() - 0.5)
            setCards(shuffled)

            const cardIds = selectedCards.map(card => card.id)
            await createGameSession(mode, cardIds)

            // FIXED: Pass both user_id AND card id to trackGameView
            selectedCards.forEach(card => {
                if (card.user_id) {
                    trackGameView(card.user_id, card.id)
                }
            })

        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const getDeviceType = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 'mobile' : 'desktop'
        }
        return 'unknown'
    }

    const createGameSession = async (mode, cardIds) => {
        try {
            const { data, error } = await supabase
                .from('game_sessions')
                .insert([{
                    user_id: user?.id || null,
                    game_mode: mode,
                    started_at: new Date().toISOString(),
                    cards_shown: cardIds,
                    device_type: getDeviceType()
                }])
                .select()
                .maybeSingle()

            if (!error && data) {
                setSessionId(data.id)
                return data.id
            }
        } catch (error) {
            console.error('Error creating game session:', error)
        }
        return null
    }

    const completeGameSession = async (finalMoves, finalScore) => {
        if (!sessionId) return

        try {
            await supabase
                .from('game_sessions')
                .update({
                    completed_at: new Date().toISOString(),
                    moves: finalMoves,
                    score: finalScore
                })
                .eq('id', sessionId)
        } catch (error) {
            console.error('Error completing game session:', error)
        }
    }

    const startGame = async (mode) => {
        if (cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser) {
            const viewCount = mode === 'easy' ? 12 : 16
            trackCardBackView(cardBackAdvertiser.user_id, viewCount)
        }

        setGameMode(mode)
        setGameStarted(true)
        setGameComplete(false)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        setStartTime(Date.now())
        setEndTime(null)
        await loadCards(mode)
    }

    const playAgain = () => {
        setGameStarted(false)
        setGameComplete(false)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        setCards([])
        setStartTime(null)
        setEndTime(null)
    }

    const saveScoreDirectly = async (finalMoves, finalTime, finalScore, mode) => {
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
                    game_mode: mode,
                    moves: finalMoves,
                    time_seconds: finalTime,
                    score: finalScore,
                    week_start: weekStart.toISOString().split('T')[0]
                }])

            if (error) throw error
            await loadLeaderboards()
        } catch (error) {
            console.error('Error saving score:', error)
        }
    }

    const handleCardClick = (clickedCard) => {
        if (!gameStarted || gameComplete) return
        if (flippedCards.length === 2) return
        if (flippedCards.some(card => card.uniqueId === clickedCard.uniqueId)) return
        if (matchedPairs.includes(clickedCard.pairId)) return

        // FIXED: Pass the card.id (promo_card_id) to trackFlipView
        if (clickedCard.user_id) {
            trackFlipView(clickedCard.user_id, clickedCard.uniqueId, clickedCard.id)
        }

        const newFlipped = [...flippedCards, clickedCard]
        setFlippedCards(newFlipped)

        if (newFlipped.length === 2) {
            const newMoves = moves + 1
            setMoves(newMoves)

            if (newFlipped[0].pairId === newFlipped[1].pairId) {
                const newMatched = [...matchedPairs, newFlipped[0].pairId]
                setMatchedPairs(newMatched)
                setTimeout(() => setFlippedCards([]), 500)

                const pairsNeeded = gameMode === 'easy' ? 6 : 8
                if (newMatched.length === pairsNeeded) {
                    const finalTime = Date.now()
                    setEndTime(finalTime)
                    setGameComplete(true)

                    if (user) {
                        const timeSeconds = Math.floor((finalTime - startTime) / 1000)
                        const finalScore = (newMoves * 2) + timeSeconds
                        saveScoreDirectly(newMoves, timeSeconds, finalScore, gameMode)
                        completeGameSession(newMoves, finalScore)
                    }
                }
            } else {
                setTimeout(() => setFlippedCards([]), 1000)
            }
        }
    }

    const trackCardClick = async (cardUserId) => {
        if (!cardUserId) return

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_clicks')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_clicks: (campaigns[0].views_from_clicks || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaigns[0].id)
            }
        } catch (error) {
            // Silently fail
        }
    }

    const isCardFlipped = (card) => {
        return flippedCards.some(c => c.uniqueId === card.uniqueId) || matchedPairs.includes(card.pairId)
    }

    useEffect(() => {
        let interval
        if (gameStarted && !gameComplete && startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [gameStarted, gameComplete, startTime])

    const getElapsedTime = () => {
        if (endTime && startTime) {
            return Math.floor((endTime - startTime) / 1000)
        }
        return elapsedTime
    }

    const CardBack = () => (
        <div className="absolute top-1 right-1 bg-amber-400 text-slate-900 text-[8px] font-bold px-1 rounded z-10">TAP</div>
    )

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {viewingCard && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingCard(null)}
                >
                    <div
                        className="max-w-sm w-full rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {viewingCard.card_type === 'uploaded' && viewingCard.image_url ? (
                            <div className="bg-slate-800">
                                <img
                                    src={viewingCard.image_url}
                                    alt="Card"
                                    className="w-full h-auto"
                                />
                                <button
                                    onClick={() => setViewingCard(null)}
                                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div
                                className="p-6"
                                style={{ backgroundColor: viewingCard.card_color || '#4F46E5' }}
                            >
                                <div className="text-center mb-4">
                                    <h2
                                        className="font-bold text-xl"
                                        style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                    >
                                        {viewingCard.title}
                                    </h2>
                                </div>
                                {viewingCard.message && (
                                    <div className="text-center mb-4">
                                        <p
                                            className="text-sm"
                                            style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                        >
                                            {viewingCard.message}
                                        </p>
                                    </div>
                                )}
                                <div
                                    className="text-center space-y-1"
                                    style={{ color: viewingCard.text_color || '#FFFFFF' }}
                                >
                                    {viewingCard.phone && <p className="text-sm">📞 {viewingCard.phone}</p>}
                                    {viewingCard.email && <p className="text-sm">✉️ {viewingCard.email}</p>}
                                </div>
                                <button
                                    onClick={() => setViewingCard(null)}
                                    className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-2 py-4 sm:px-6 lg:px-8">
                {weeklyPrize && !gameStarted && (
                    <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded-xl p-4 sm:p-6 mb-4 text-center shadow-lg">
                        <p className="text-white font-bold mb-1 text-sm sm:text-base">🏆 This Week's Prize 🏆</p>
                        {weeklyPrize.is_surprise ? (
                            <>
                                <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎁 Surprise Prize! 🎁</p>
                                <p className="text-white text-sm">Play to find out what you could win!</p>
                            </>
                        ) : (
                            <>
                                {weeklyPrize.prize_type === 'cash' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">${weeklyPrize.total_prize_pool}</p>
                                        {weeklyPrize.number_of_winners === 1 ? (
                                            <p className="text-white text-sm">Winner takes all!</p>
                                        ) : (
                                            <p className="text-white text-sm">Split among top {weeklyPrize.number_of_winners} players</p>
                                        )}
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'merchandise' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎽 Merchandise Prizes!</p>
                                        <div className="text-white text-sm">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {weeklyPrize.prize_type === 'custom' && (
                                    <>
                                        <p className="text-xl sm:text-3xl font-bold text-white mb-1">🎁 Special Prize!</p>
                                        <div className="text-white text-sm">
                                            {weeklyPrize.prize_descriptions?.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {weeklyPrize.announcement_text && (
                            <p className="text-white mt-2 italic text-sm">"{weeklyPrize.announcement_text}"</p>
                        )}
                    </div>
                )}

                {!gameStarted && (
                    <div className="flex justify-center mb-4">
                        <button
                            onClick={() => setShowLeaderboard(!showLeaderboard)}
                            className="px-4 py-2 sm:px-6 sm:py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all text-sm sm:text-base"
                        >
                            🏆 {showLeaderboard ? 'Hide' : 'Show'} Leaderboards
                        </button>
                    </div>
                )}

                {showLeaderboard && !gameStarted && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-green-400">🟢</span> Easy Mode (12 Cards)
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 text-slate-400">#</th>
                                            <th className="text-left py-2 text-slate-400">Player</th>
                                            <th className="text-left py-2 text-slate-400">Moves</th>
                                            <th className="text-left py-2 text-slate-400">Time</th>
                                            <th className="text-left py-2 text-slate-400">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {easyLeaderboard.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-slate-700/50">
                                                <td className="py-2 text-white">{index + 1}</td>
                                                <td className="py-2 text-white">{entry.users.username}</td>
                                                <td className="py-2 text-slate-300">{entry.moves}</td>
                                                <td className="py-2 text-slate-300">{entry.time_seconds}s</td>
                                                <td className="py-2 text-amber-400 font-bold">{entry.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {easyLeaderboard.length === 0 && (
                                    <p className="text-center text-slate-400 py-4 text-sm">No scores yet!</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-400">🔴</span> Challenge Mode (16 Cards)
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-2 text-slate-400">#</th>
                                            <th className="text-left py-2 text-slate-400">Player</th>
                                            <th className="text-left py-2 text-slate-400">Moves</th>
                                            <th className="text-left py-2 text-slate-400">Time</th>
                                            <th className="text-left py-2 text-slate-400">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {challengeLeaderboard.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-slate-700/50">
                                                <td className="py-2 text-white">{index + 1}</td>
                                                <td className="py-2 text-white">{entry.users.username}</td>
                                                <td className="py-2 text-slate-300">{entry.moves}</td>
                                                <td className="py-2 text-slate-300">{entry.time_seconds}s</td>
                                                <td className="py-2 text-amber-400 font-bold">{entry.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {challengeLeaderboard.length === 0 && (
                                    <p className="text-center text-slate-400 py-4 text-sm">No scores yet!</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!user && !gameStarted && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-lg mb-4 text-sm">
                        <p className="text-center">
                            <strong>Want to compete for prizes?</strong>
                            <button
                                onClick={() => router.push('/auth/register')}
                                className="ml-2 underline hover:text-amber-300"
                            >
                                Sign up now!
                            </button>
                        </p>
                    </div>
                )}

                {!gameStarted && (
                    <div className="text-center py-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Choose Your Challenge!</h2>
                        <p className="text-sm sm:text-lg text-slate-400 mb-6">
                            Match all pairs. Lower score wins!
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => startGame('easy')}
                                className="px-6 py-3 sm:px-8 sm:py-4 bg-green-600 text-white text-base sm:text-lg font-bold rounded-lg hover:bg-green-500 transition-all"
                            >
                                Easy Mode<br />
                                <span className="text-xs sm:text-sm font-normal">12 Cards</span>
                            </button>
                            <button
                                onClick={() => startGame('challenge')}
                                className="px-6 py-3 sm:px-8 sm:py-4 bg-red-600 text-white text-base sm:text-lg font-bold rounded-lg hover:bg-red-500 transition-all"
                            >
                                Challenge<br />
                                <span className="text-xs sm:text-sm font-normal">16 Cards</span>
                            </button>
                        </div>
                    </div>
                )}

                {gameStarted && (
                    <>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 sm:p-4 mb-3">
                            <div className="flex justify-between items-center text-xs sm:text-base">
                                <span className="text-white"><span className="text-slate-400">M:</span> {moves}</span>
                                <span className="text-white"><span className="text-slate-400">T:</span> {getElapsedTime()}s</span>
                                <span className="text-white"><span className="text-slate-400">✓:</span> {matchedPairs.length}/{gameMode === 'easy' ? 6 : 8}</span>
                                <button
                                    onClick={playAgain}
                                    className="px-2 py-1 sm:px-3 sm:py-1 bg-slate-700 text-white rounded hover:bg-slate-600 transition-all text-xs sm:text-sm"
                                >
                                    Quit
                                </button>
                            </div>
                        </div>

                        {gameComplete && (
                            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-3 text-center">
                                <h3 className="text-xl font-bold mb-1">🎉 Congratulations!</h3>
                                <p className="text-sm mb-2">
                                    Moves: {moves} | Time: {getElapsedTime()}s | Score: {(moves * 2) + getElapsedTime()}
                                </p>
                                {user ? (
                                    <p className="text-xs mb-3 animate-pulse font-bold text-green-300">
                                        ✓ Your score was saved to the leaderboard!
                                    </p>
                                ) : (
                                    <p className="text-xs mb-3">
                                        <button
                                            onClick={() => router.push('/auth/register')}
                                            className="underline"
                                        >
                                            Sign up
                                        </button>{' '}
                                        to save your score!
                                    </p>
                                )}
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={playAgain}
                                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all"
                                    >
                                        Play Again
                                    </button>
                                    <button
                                        onClick={() => {
                                            playAgain()
                                            setShowLeaderboard(true)
                                        }}
                                        className="px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all"
                                    >
                                        View Leaderboard
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`grid gap-1 sm:gap-2 ${gameMode === 'easy' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-4 lg:grid-cols-8'}`}>
                            {cards.map((card) => (
                                <div
                                    key={card.uniqueId}
                                    onClick={() => handleCardClick(card)}
                                    className="relative aspect-[4/3] cursor-pointer"
                                >
                                    {!isCardFlipped(card) ? (
                                        cardBackSetting?.show_advertiser_cards === 'true' && cardBackAdvertiser ? (
                                            cardBackAdvertiser.card_type === 'uploaded' && cardBackAdvertiser.image_url ? (
                                                <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden border-2 border-amber-400 bg-slate-800 flex items-center justify-center ring-2 ring-amber-400/50 relative">
                                                    <CardBack />
                                                    <img
                                                        src={cardBackAdvertiser.image_url}
                                                        alt="Advertiser card"
                                                        className="max-w-full max-h-full object-contain p-1"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-full h-full rounded-md sm:rounded-lg p-1 flex flex-col justify-center items-center border-2 border-amber-400 shadow-lg overflow-hidden ring-2 ring-amber-400/50 relative"
                                                    style={{ backgroundColor: cardBackAdvertiser.card_color || '#4F46E5' }}
                                                >
                                                    <CardBack />
                                                    <h3
                                                        className="font-bold text-xs text-center truncate w-full"
                                                        style={{ color: cardBackAdvertiser.text_color || '#FFFFFF' }}
                                                    >{cardBackAdvertiser.title}</h3>
                                                    {cardBackAdvertiser.message && (
                                                        <p
                                                            className="text-xs text-center line-clamp-2 mt-1"
                                                            style={{ color: cardBackAdvertiser.text_color || '#FFFFFF' }}
                                                        >{cardBackAdvertiser.message}</p>
                                                    )}
                                                </div>
                                            )
                                        ) : cardBackSetting?.card_back_logo_url ? (
                                            <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden border-2 border-amber-400 bg-indigo-600 flex items-center justify-center ring-2 ring-amber-400/50 relative">
                                                <CardBack />
                                                <img
                                                    src={cardBackSetting.card_back_logo_url}
                                                    alt="Card back"
                                                    className="max-w-full max-h-full object-contain p-1"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-indigo-600 rounded-md sm:rounded-lg flex items-center justify-center shadow-lg border-2 border-amber-400 ring-2 ring-amber-400/50 relative">
                                                <CardBack />
                                                <span className="text-3xl sm:text-5xl text-white">?</span>
                                            </div>
                                        )
                                    ) : (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <div className="w-full h-full rounded-md sm:rounded-lg shadow-lg overflow-hidden relative border border-slate-600">
                                                <img
                                                    src={card.image_url}
                                                    alt="Card"
                                                    className="w-full h-full object-contain"
                                                />
                                                {matchedPairs.includes(card.pairId) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setViewingCard(card)
                                                            trackCardClick(card.user_id)
                                                        }}
                                                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                                                    >
                                                        👁
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-full rounded-md sm:rounded-lg p-1 sm:p-2 flex flex-col justify-between border border-slate-600 shadow-lg overflow-hidden relative"
                                                style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                            >
                                                <div className="text-center overflow-hidden">
                                                    <h3
                                                        className="font-bold text-xs truncate"
                                                        style={{ color: card.text_color || '#FFFFFF' }}
                                                    >{card.title}</h3>
                                                </div>
                                                <div className="text-center flex-1 flex items-center justify-center overflow-hidden px-1">
                                                    {card.message && (
                                                        <p
                                                            className="text-xs line-clamp-2"
                                                            style={{ color: card.text_color || '#FFFFFF' }}
                                                        >{card.message}</p>
                                                    )}
                                                </div>
                                                {matchedPairs.includes(card.pairId) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setViewingCard(card)
                                                            trackCardClick(card.user_id)
                                                        }}
                                                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                                                    >
                                                        👁
                                                    </button>
                                                )}
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
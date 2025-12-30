'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

// Card constants
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-gray-900', spades: 'text-gray-900' }

// Create a standard 52-card deck
const createDeck = () => {
    const deck = []
    for (const suit of SUITS) {
        for (let i = 0; i < VALUES.length; i++) {
            deck.push({
                suit,
                value: VALUES[i],
                numericValue: i + 1,
                faceUp: false,
                id: `${suit}-${VALUES[i]}`
            })
        }
    }
    return deck
}

// Shuffle deck
const shuffleDeck = (deck) => {
    const shuffled = [...deck]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

// Check if card is red
const isRed = (suit) => suit === 'hearts' || suit === 'diamonds'

// Check if can stack on tableau (alternating colors, descending)
const canStackOnTableau = (card, targetCard) => {
    if (!targetCard) return card.value === 'K'
    if (isRed(card.suit) === isRed(targetCard.suit)) return false
    return card.numericValue === targetCard.numericValue - 1
}

// Check if can stack on foundation (same suit, ascending from A)
const canStackOnFoundation = (card, foundationPile) => {
    if (foundationPile.length === 0) return card.value === 'A'
    const topCard = foundationPile[foundationPile.length - 1]
    return card.suit === topCard.suit && card.numericValue === topCard.numericValue + 1
}

export default function SolitairePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [gameStarted, setGameStarted] = useState(false)
    const [gameComplete, setGameComplete] = useState(false)

    // Game state
    const [stock, setStock] = useState([])
    const [waste, setWaste] = useState([])
    const [foundations, setFoundations] = useState([[], [], [], []])
    const [tableau, setTableau] = useState([[], [], [], [], [], [], []])
    const [moves, setMoves] = useState(0)
    const [startTime, setStartTime] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [drawCount, setDrawCount] = useState(1) // 1 or 3

    // Selection state
    const [selectedCards, setSelectedCards] = useState(null)
    const [selectedFrom, setSelectedFrom] = useState(null)

    // Hint state
    const [hintCard, setHintCard] = useState(null)
    const [hintTarget, setHintTarget] = useState(null)

    // Undo state (max 3 moves)
    const [moveHistory, setMoveHistory] = useState([])

    // Auto-complete state
    const [autoCompleting, setAutoCompleting] = useState(false)

    // Pause state
    const [isPaused, setIsPaused] = useState(false)
    const [pausedTime, setPausedTime] = useState(0)

    // Restart same deal state
    const [initialDeck, setInitialDeck] = useState(null)

    // Advertiser state
    const [cardBackAdvertiser, setCardBackAdvertiser] = useState(null)
    const [winSponsor, setWinSponsor] = useState(null)
    const [displayAds, setDisplayAds] = useState([])
    const [viewingAd, setViewingAd] = useState(null)
    const [viewingPromoPopup, setViewingPromoPopup] = useState(null)
    const [urlClickable, setUrlClickable] = useState(false)
    const trackedCardBackView = useRef(false)
    const trackedDisplayAdViews = useRef(new Set())
    const [sessionId, setSessionId] = useState(null)

    // Sound refs
    const audioContext = useRef(null)

    // Double-click detection
    const clickTimeout = useRef(null)

    // Leaderboard
    const [leaderboard, setLeaderboard] = useState([])
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [weeklyPrize, setWeeklyPrize] = useState(null)

    // Settings
    const [showSettings, setShowSettings] = useState(false)
    const [settings, setSettings] = useState({
        soundEffects: true,
        animations: true,
        animationSpeed: 'normal', // 'fast', 'normal', 'slow'
        showPauseButton: true,
        showTimer: true
    })

    // Statistics
    const [stats, setStats] = useState({
        gamesPlayed: 0,
        gamesWon: 0,
        bestTime: null,
        bestScore: null,
        currentStreak: 0,
        bestStreak: 0
    })

    // Animation state
    const [animatingCards, setAnimatingCards] = useState([])

    useEffect(() => {
        checkUser()
        loadWeeklyPrize()
        loadCardBackAdvertiser()
        loadWinSponsor()
        loadDisplayAds()
        loadSettings()
        loadStats()

        // Initialize audio context on user interaction
        const initAudio = () => {
            if (!audioContext.current) {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
            }
            document.removeEventListener('click', initAudio)
        }
        document.addEventListener('click', initAudio)

        return () => document.removeEventListener('click', initAudio)
    }, [])

    // Load settings from localStorage
    const loadSettings = () => {
        try {
            const saved = localStorage.getItem('solitaire-settings')
            if (saved) {
                setSettings(JSON.parse(saved))
            }
        } catch (error) {
            console.log('Error loading settings')
        }
    }

    // Load stats (from Supabase for users, localStorage for guests)
    const loadStats = async () => {
        if (user) {
            try {
                const { data, error } = await supabase
                    .from('user_game_stats')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('game_type', 'solitaire')
                    .maybeSingle()

                if (data) {
                    setStats({
                        gamesPlayed: data.games_played || 0,
                        gamesWon: data.games_won || 0,
                        bestTime: data.best_time_seconds,
                        bestScore: data.best_score,
                        currentStreak: data.current_streak || 0,
                        bestStreak: data.best_streak || 0
                    })
                }
            } catch (error) {
                console.log('Error loading stats from database')
            }
        } else {
            try {
                const saved = localStorage.getItem('solitaire-stats')
                if (saved) {
                    setStats(JSON.parse(saved))
                }
            } catch (error) {
                console.log('Error loading stats from localStorage')
            }
        }
    }

    // Save stats (to Supabase for users, localStorage for guests)
    const saveStats = async (newStats) => {
        setStats(newStats)

        if (user) {
            try {
                const { data: existing } = await supabase
                    .from('user_game_stats')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('game_type', 'solitaire')
                    .maybeSingle()

                if (existing) {
                    await supabase
                        .from('user_game_stats')
                        .update({
                            games_played: newStats.gamesPlayed,
                            games_won: newStats.gamesWon,
                            best_time_seconds: newStats.bestTime,
                            best_score: newStats.bestScore,
                            current_streak: newStats.currentStreak,
                            best_streak: newStats.bestStreak,
                            last_played_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id)
                } else {
                    await supabase
                        .from('user_game_stats')
                        .insert([{
                            user_id: user.id,
                            game_type: 'solitaire',
                            games_played: newStats.gamesPlayed,
                            games_won: newStats.gamesWon,
                            best_time_seconds: newStats.bestTime,
                            best_score: newStats.bestScore,
                            current_streak: newStats.currentStreak,
                            best_streak: newStats.bestStreak,
                            last_played_at: new Date().toISOString()
                        }])
                }
            } catch (error) {
                console.log('Error saving stats to database')
            }
        } else {
            try {
                localStorage.setItem('solitaire-stats', JSON.stringify(newStats))
            } catch (error) {
                console.log('Error saving stats to localStorage')
            }
        }
    }

    // Update stats after a game
    const updateStatsAfterGame = (won, finalTime, finalScore) => {
        const newStats = {
            gamesPlayed: stats.gamesPlayed + 1,
            gamesWon: won ? stats.gamesWon + 1 : stats.gamesWon,
            bestTime: won ? (stats.bestTime === null ? finalTime : Math.min(stats.bestTime, finalTime)) : stats.bestTime,
            bestScore: won ? (stats.bestScore === null ? finalScore : Math.max(stats.bestScore, finalScore)) : stats.bestScore,
            currentStreak: won ? stats.currentStreak + 1 : 0,
            bestStreak: won ? Math.max(stats.bestStreak, stats.currentStreak + 1) : stats.bestStreak
        }
        saveStats(newStats)
    }

    // Save settings to localStorage
    const saveSettings = (newSettings) => {
        setSettings(newSettings)
        try {
            localStorage.setItem('solitaire-settings', JSON.stringify(newSettings))
        } catch (error) {
            console.log('Error saving settings')
        }
    }

    // Play sound effect using Web Audio API
    const playSound = (type) => {
        if (!settings.soundEffects || !audioContext.current) return

        try {
            const ctx = audioContext.current
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            switch (type) {
                case 'flip':
                    oscillator.frequency.setValueAtTime(800, ctx.currentTime)
                    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1)
                    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
                    oscillator.start(ctx.currentTime)
                    oscillator.stop(ctx.currentTime + 0.1)
                    break
                case 'place':
                    oscillator.frequency.setValueAtTime(300, ctx.currentTime)
                    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08)
                    gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
                    oscillator.start(ctx.currentTime)
                    oscillator.stop(ctx.currentTime + 0.08)
                    break
                case 'shuffle':
                    // Multiple quick sounds for shuffle effect
                    for (let i = 0; i < 5; i++) {
                        const osc = ctx.createOscillator()
                        const gain = ctx.createGain()
                        osc.connect(gain)
                        gain.connect(ctx.destination)
                        osc.frequency.setValueAtTime(200 + Math.random() * 400, ctx.currentTime + i * 0.05)
                        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.05)
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.05)
                        osc.start(ctx.currentTime + i * 0.05)
                        osc.stop(ctx.currentTime + i * 0.05 + 0.05)
                    }
                    break
                case 'win':
                    // Victory fanfare
                    const notes = [523, 659, 784, 1047] // C5, E5, G5, C6
                    notes.forEach((freq, i) => {
                        const osc = ctx.createOscillator()
                        const gain = ctx.createGain()
                        osc.connect(gain)
                        gain.connect(ctx.destination)
                        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
                        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
                        osc.start(ctx.currentTime + i * 0.15)
                        osc.stop(ctx.currentTime + i * 0.15 + 0.3)
                    })
                    break
                case 'draw':
                    oscillator.frequency.setValueAtTime(500, ctx.currentTime)
                    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05)
                    gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
                    oscillator.start(ctx.currentTime)
                    oscillator.stop(ctx.currentTime + 0.05)
                    break
                default:
                    break
            }
        } catch (error) {
            console.log('Error playing sound')
        }
    }

    // Get animation duration based on settings
    const getAnimationDuration = () => {
        if (!settings.animations) return 0
        switch (settings.animationSpeed) {
            case 'fast': return 100
            case 'slow': return 400
            default: return 200
        }
    }

    // Track display ad views when ads are loaded
    useEffect(() => {
        if (displayAds.length > 0) {
            displayAds.forEach(ad => {
                trackDisplayAdView(ad.user_id)
            })
        }
    }, [displayAds])

    useEffect(() => {
        let interval
        if (gameStarted && !gameComplete && startTime && !isPaused) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime - pausedTime) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [gameStarted, gameComplete, startTime, isPaused, pausedTime])

    // Check for win
    useEffect(() => {
        if (gameStarted && !gameComplete && !autoCompleting) {
            const totalInFoundations = foundations.reduce((sum, f) => sum + f.length, 0)
            if (totalInFoundations === 52) {
                setGameComplete(true)
                playSound('win')
                const finalTime = elapsedTime
                const score = Math.max(0, 10000 - (moves * 10) - (finalTime * 2))
                updateStatsAfterGame(true, finalTime, score)
                if (user) {
                    saveScore(moves, finalTime, score)
                    completeGameSession(moves, score)
                }
            }
        }
    }, [foundations, gameStarted, gameComplete, autoCompleting])

    // Auto-complete logic
    useEffect(() => {
        if (!autoCompleting) return

        const duration = getAnimationDuration()
        const timer = setTimeout(() => {
            // Find a card to move to foundation
            let moved = false

            // Check waste
            if (waste.length > 0) {
                const card = waste[waste.length - 1]
                for (let i = 0; i < 4; i++) {
                    if (canStackOnFoundation(card, foundations[i])) {
                        const newWaste = waste.slice(0, -1)
                        const newFoundations = foundations.map((f, idx) =>
                            idx === i ? [...f, card] : [...f]
                        )
                        setWaste(newWaste)
                        setFoundations(newFoundations)
                        setMoves(m => m + 1)
                        playSound('place')
                        moved = true
                        break
                    }
                }
            }

            // Check tableau piles
            if (!moved) {
                for (let pileIdx = 0; pileIdx < 7; pileIdx++) {
                    const pile = tableau[pileIdx]
                    if (pile.length > 0) {
                        const card = pile[pile.length - 1]
                        if (card.faceUp) {
                            for (let i = 0; i < 4; i++) {
                                if (canStackOnFoundation(card, foundations[i])) {
                                    const newTableau = tableau.map((p, idx) =>
                                        idx === pileIdx ? p.slice(0, -1) : [...p]
                                    )
                                    const newFoundations = foundations.map((f, idx) =>
                                        idx === i ? [...f, card] : [...f]
                                    )
                                    setTableau(newTableau)
                                    setFoundations(newFoundations)
                                    setMoves(m => m + 1)
                                    playSound('place')
                                    moved = true
                                    break
                                }
                            }
                        }
                    }
                    if (moved) break
                }
            }

            // Check if complete
            const totalInFoundations = foundations.reduce((sum, f) => sum + f.length, 0)
            if (totalInFoundations === 52 || !moved) {
                setAutoCompleting(false)
                if (totalInFoundations === 52) {
                    setGameComplete(true)
                    playSound('win')
                    if (user) {
                        const finalTime = elapsedTime
                        const score = Math.max(0, 10000 - (moves * 10) - (finalTime * 2))
                        saveScore(moves, finalTime, score)
                        completeGameSession(moves, score)
                    }
                }
            }
        }, Math.max(150, duration))

        return () => clearTimeout(timer)
    }, [autoCompleting, foundations, tableau, waste])

    // Check if auto-complete is available
    const canAutoComplete = () => {
        if (stock.length > 0) return false
        // All tableau cards must be face up
        for (const pile of tableau) {
            for (const card of pile) {
                if (!card.faceUp) return false
            }
        }
        return true
    }

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

    // Reload stats when user changes
    useEffect(() => {
        if (!loading) {
            loadStats()
        }
    }, [user, loading])

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
                .eq('game_type', 'solitaire')
                .eq('is_active', true)
                .maybeSingle()

            if (data) {
                setWeeklyPrize(data)
            }
        } catch (error) {
            console.log('No prize set for this week')
        }
    }

    const loadCardBackAdvertiser = async () => {
        try {
            const { data: campaigns, error } = await supabase
                .from('ad_campaigns')
                .select('user_id, views_guaranteed, views_from_game, views_from_flips, views_from_card_back, bonus_views')
                .eq('status', 'active')

            if (error || !campaigns || campaigns.length === 0) return

            const eligibleCampaigns = campaigns.filter(c => {
                const totalViews = (c.views_from_game || 0) + (c.views_from_flips || 0) + (c.views_from_card_back || 0)
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
            }
        } catch (error) {
            console.log('Error loading card back advertiser')
        }
    }

    const loadWinSponsor = async () => {
        try {
            const { data: campaigns, error } = await supabase
                .from('ad_campaigns')
                .select('user_id, views_guaranteed, views_from_game, views_from_flips, views_from_card_back, bonus_views')
                .eq('status', 'active')

            if (error || !campaigns || campaigns.length === 0) return

            const eligibleCampaigns = campaigns.filter(c => {
                const totalViews = (c.views_from_game || 0) + (c.views_from_flips || 0) + (c.views_from_card_back || 0)
                return totalViews < (c.views_guaranteed || 0) || (c.bonus_views || 0) > 0
            })

            if (eligibleCampaigns.length === 0) return

            let selectedCampaign = eligibleCampaigns[Math.floor(Math.random() * eligibleCampaigns.length)]

            const { data: cards } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', selectedCampaign.user_id)

            if (cards && cards.length > 0) {
                setWinSponsor(cards[0])
            }
        } catch (error) {
            console.log('Error loading win sponsor')
        }
    }

    const loadDisplayAds = async () => {
        try {
            // Load house card settings
            const { data: settings } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['house_card_frequency', 'house_card_fallback_enabled', 'card_url_clickable'])

            let frequency = 10
            let fallbackEnabled = true
            settings?.forEach(s => {
                if (s.setting_key === 'house_card_frequency') frequency = parseInt(s.setting_value) || 0
                if (s.setting_key === 'house_card_fallback_enabled') fallbackEnabled = s.setting_value === 'true'
                if (s.setting_key === 'card_url_clickable') setUrlClickable(s.setting_value === 'true')
            })

            const { data: campaigns, error } = await supabase
                .from('ad_campaigns')
                .select('user_id, views_guaranteed, views_from_game, views_from_flips, views_from_card_back, bonus_views')
                .eq('status', 'active')

            let advertiserCards = []

            if (!error && campaigns && campaigns.length > 0) {
                const eligibleCampaigns = campaigns.filter(c => {
                    const totalViews = (c.views_from_game || 0) + (c.views_from_flips || 0) + (c.views_from_card_back || 0)
                    return totalViews < (c.views_guaranteed || 0) || (c.bonus_views || 0) > 0
                })

                if (eligibleCampaigns.length > 0) {
                    const uniqueUserIds = [...new Set(eligibleCampaigns.map(c => c.user_id))]
                    const shuffledUserIds = uniqueUserIds.sort(() => Math.random() - 0.5)
                    const selectedUserIds = shuffledUserIds.slice(0, 8)

                    const { data: cards } = await supabase
                        .from('business_cards')
                        .select('*')
                        .in('user_id', selectedUserIds)

                    if (cards && cards.length > 0) {
                        const seenUsers = new Set()
                        for (const card of cards) {
                            if (!seenUsers.has(card.user_id)) {
                                advertiserCards.push(card)
                                seenUsers.add(card.user_id)
                            }
                        }
                    }
                }
            }

            // Load house cards
            const { data: houseCards } = await supabase
                .from('business_cards')
                .select('*')
                .eq('is_house_card', true)

            // Build final ad list
            let finalAds = []

            if (advertiserCards.length > 0) {
                finalAds = [...advertiserCards]

                // Mix in house cards based on frequency setting
                if (frequency > 0 && houseCards && houseCards.length > 0) {
                    const houseCardsToAdd = Math.ceil(advertiserCards.length / frequency)
                    for (let i = 0; i < houseCardsToAdd; i++) {
                        finalAds.push(houseCards[Math.floor(Math.random() * houseCards.length)])
                    }
                }
            } else if (fallbackEnabled && houseCards && houseCards.length > 0) {
                // No advertisers - use house cards as fallback
                finalAds = [...houseCards].sort(() => Math.random() - 0.5)
            }

            if (finalAds.length > 0) {
                setDisplayAds(finalAds.slice(0, 8))
            }
        } catch (error) {
            console.log('Error loading display ads')
        }
    }

    const refreshAds = async () => {
        trackedCardBackView.current = false
        trackedDisplayAdViews.current = new Set()
        await loadCardBackAdvertiser()
        await loadWinSponsor()
        await loadDisplayAds()
    }

    const trackDisplayAdView = async (cardUserId) => {
        if (!cardUserId || trackedDisplayAdViews.current.has(cardUserId)) return
        trackedDisplayAdViews.current.add(cardUserId)

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_game')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_game: (campaigns[0].views_from_game || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaigns[0].id)
            }
        } catch (error) {
            console.log('Error tracking display ad view')
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

    const trackWinSponsorView = async (cardUserId) => {
        if (!cardUserId) return

        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_game')
                .eq('user_id', cardUserId)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_game: (campaigns[0].views_from_game || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaigns[0].id)
            }
        } catch (error) {
            console.log('Error tracking win sponsor view')
        }
    }

    const trackSponsorClick = async (cardUserId) => {
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
            console.log('Error tracking sponsor click')
        }
    }

    // Log promo card view
    const logPromoCardView = async (card, viewType) => {
        if (!card?.is_house_card) return
        try {
            await supabase
                .from('promo_card_views')
                .insert([{
                    promo_card_id: card.id,
                    user_id: user?.id || null,
                    view_type: viewType,
                    game_type: 'solitaire'
                }])
        } catch (error) {
            console.error('Error logging promo view:', error)
        }
    }

    // Handle eyeball click - check for popup
    const handleEyeballClick = async (ad) => {
        if (ad.is_house_card) {
            await logPromoCardView(ad, 'eyeball_click')
            if (ad.has_popup && ad.popup_title && ad.popup_message) {
                setViewingPromoPopup(ad)
                return
            }
        } else {
            trackSponsorClick(ad.user_id)
        }
        setViewingAd(ad)
    }

    // Handle CTA click in popup
    const handleCtaClick = async (card, url) => {
        await logPromoCardView(card, 'cta_click')
        // Add https:// if no protocol specified
        const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
        window.open(fullUrl, '_blank', 'noopener,noreferrer')
    }

    const loadLeaderboard = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data, error } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('game_mode', 'solitaire')
                .order('score', { ascending: false })
                .limit(10)

            if (error) throw error

            const userIds = data.map(entry => entry.user_id)
            let usersData = []
            if (userIds.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id, username')
                    .in('id', userIds)
                if (users) usersData = users
            }

            const leaderboardWithUsers = data.map(entry => ({
                ...entry,
                users: usersData.find(u => u.id === entry.user_id) || { username: 'Unknown' }
            }))

            setLeaderboard(leaderboardWithUsers)
        } catch (error) {
            console.error('Error loading leaderboard:', error)
        }
    }

    const getDeviceType = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 'mobile' : 'desktop'
        }
        return 'unknown'
    }

    const createGameSession = async () => {
        try {
            const { data, error } = await supabase
                .from('game_sessions')
                .insert([{
                    user_id: user?.id || null,
                    game_mode: 'solitaire',
                    started_at: new Date().toISOString(),
                    device_type: getDeviceType()
                }])
                .select()
                .maybeSingle()

            if (!error && data) {
                setSessionId(data.id)
            }
        } catch (error) {
            console.error('Error creating game session:', error)
        }
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

    const saveScore = async (finalMoves, finalTime, finalScore) => {
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
                    game_mode: 'solitaire',
                    moves: finalMoves,
                    time_seconds: finalTime,
                    score: finalScore,
                    week_start: weekStart.toISOString().split('T')[0]
                }])

            if (error) {
                console.error('Supabase error details:', error.message, error.details, error.hint)
                throw error
            }
            await loadLeaderboard()
        } catch (error) {
            console.error('Error saving score:', error.message || error)
        }
    }

    // Save state for undo
    const saveStateForUndo = () => {
        const state = {
            stock: JSON.parse(JSON.stringify(stock)),
            waste: JSON.parse(JSON.stringify(waste)),
            foundations: JSON.parse(JSON.stringify(foundations)),
            tableau: JSON.parse(JSON.stringify(tableau)),
            moves: moves
        }
        setMoveHistory(prev => [...prev.slice(-2), state]) // Keep last 3
    }

    // Undo last move
    const undoMove = () => {
        if (moveHistory.length === 0) return
        const prevState = moveHistory[moveHistory.length - 1]
        setStock(prevState.stock)
        setWaste(prevState.waste)
        setFoundations(prevState.foundations)
        setTableau(prevState.tableau)
        setMoves(prevState.moves)
        setMoveHistory(prev => prev.slice(0, -1))
        setSelectedCards(null)
        setSelectedFrom(null)
        setHintCard(null)
        setHintTarget(null)
    }

    // Find a hint
    const findHint = () => {
        setHintCard(null)
        setHintTarget(null)

        // Check waste to foundation
        if (waste.length > 0) {
            const card = waste[waste.length - 1]
            for (let i = 0; i < 4; i++) {
                if (canStackOnFoundation(card, foundations[i])) {
                    setHintCard({ source: 'waste', id: card.id })
                    setHintTarget({ type: 'foundation', index: i })
                    return
                }
            }
        }

        // Check tableau to foundation
        for (let pileIdx = 0; pileIdx < 7; pileIdx++) {
            const pile = tableau[pileIdx]
            if (pile.length > 0) {
                const card = pile[pile.length - 1]
                if (card.faceUp) {
                    for (let i = 0; i < 4; i++) {
                        if (canStackOnFoundation(card, foundations[i])) {
                            setHintCard({ source: 'tableau', pileIndex: pileIdx, id: card.id })
                            setHintTarget({ type: 'foundation', index: i })
                            return
                        }
                    }
                }
            }
        }

        // Check waste to tableau
        if (waste.length > 0) {
            const card = waste[waste.length - 1]
            for (let pileIdx = 0; pileIdx < 7; pileIdx++) {
                const pile = tableau[pileIdx]
                const topCard = pile.length > 0 ? pile[pile.length - 1] : null
                if (canStackOnTableau(card, topCard)) {
                    setHintCard({ source: 'waste', id: card.id })
                    setHintTarget({ type: 'tableau', index: pileIdx })
                    return
                }
            }
        }

        // Check tableau to tableau
        for (let fromPileIdx = 0; fromPileIdx < 7; fromPileIdx++) {
            const fromPile = tableau[fromPileIdx]
            for (let cardIdx = 0; cardIdx < fromPile.length; cardIdx++) {
                const card = fromPile[cardIdx]
                if (!card.faceUp) continue

                for (let toPileIdx = 0; toPileIdx < 7; toPileIdx++) {
                    if (fromPileIdx === toPileIdx) continue
                    const toPile = tableau[toPileIdx]
                    const topCard = toPile.length > 0 ? toPile[toPile.length - 1] : null
                    if (canStackOnTableau(card, topCard)) {
                        // Don't suggest moving a King to an empty pile if it's already at the bottom
                        if (card.value === 'K' && cardIdx === 0 && toPile.length === 0) continue
                        setHintCard({ source: 'tableau', pileIndex: fromPileIdx, cardIndex: cardIdx, id: card.id })
                        setHintTarget({ type: 'tableau', index: toPileIdx })
                        return
                    }
                }
            }
        }

        // No hint found - suggest drawing
        if (stock.length > 0) {
            setHintCard({ source: 'stock' })
            setHintTarget({ type: 'draw' })
        }
    }

    // Toggle pause
    const togglePause = () => {
        if (isPaused) {
            // Resuming - add paused duration to total
            setPausedTime(prev => prev + (Date.now() - pauseStartRef.current))
            setIsPaused(false)
        } else {
            // Pausing - record when we paused
            pauseStartRef.current = Date.now()
            setIsPaused(true)
        }
    }
    const pauseStartRef = useRef(null)

    // Deal cards from a specific deck (for restart same deal)
    const dealFromDeck = (deck) => {
        // Deal tableau
        const newTableau = [[], [], [], [], [], [], []]
        let cardIndex = 0
        for (let col = 0; col < 7; col++) {
            for (let row = col; row < 7; row++) {
                const card = { ...deck[cardIndex], faceUp: row === col }
                newTableau[row].push(card)
                cardIndex++
            }
        }

        // Remaining cards go to stock
        const newStock = deck.slice(cardIndex).map(card => ({ ...card, faceUp: false }))

        return { newTableau, newStock }
    }

    const startGame = async (draw = 1, useExistingDeck = false) => {
        setDrawCount(draw)
        playSound('shuffle')

        // Track card back views (52 cards face down initially, minus 7 face up = 45)
        if (cardBackAdvertiser) {
            trackCardBackView(cardBackAdvertiser.user_id, 45)
        }

        let deck
        if (useExistingDeck && initialDeck) {
            // Use saved deck for restart
            deck = JSON.parse(JSON.stringify(initialDeck))
        } else {
            // Create and shuffle new deck
            deck = shuffleDeck(createDeck())
            // Save this deck for potential restart
            setInitialDeck(JSON.parse(JSON.stringify(deck)))
        }

        const { newTableau, newStock } = dealFromDeck(deck)

        setTableau(newTableau)
        setStock(newStock)
        setWaste([])
        setFoundations([[], [], [], []])
        setMoves(0)
        setMoveHistory([])
        setStartTime(Date.now())
        setElapsedTime(0)
        setPausedTime(0)
        setIsPaused(false)
        setGameStarted(true)
        setGameComplete(false)
        setSelectedCards(null)
        setSelectedFrom(null)
        setHintCard(null)
        setHintTarget(null)
        setAutoCompleting(false)
        trackedCardBackView.current = false

        if (!useExistingDeck) {
            await createGameSession()
        }
    }

    // Restart same deal
    const restartSameDeal = () => {
        if (!initialDeck) return
        startGame(drawCount, true)
    }

    const startNewGame = async () => {
        await refreshAds()
        setGameStarted(false)
        setGameComplete(false)
        setMoves(0)
        setMoveHistory([])
        setStock([])
        setWaste([])
        setFoundations([[], [], [], []])
        setTableau([[], [], [], [], [], [], []])
        setStartTime(null)
        setElapsedTime(0)
        setPausedTime(0)
        setIsPaused(false)
        setSelectedCards(null)
        setSelectedFrom(null)
        setHintCard(null)
        setHintTarget(null)
        setAutoCompleting(false)
        setInitialDeck(null)
    }

    const drawFromStock = () => {
        if (isPaused) return

        saveStateForUndo()
        setHintCard(null)
        setHintTarget(null)

        if (stock.length === 0) {
            // Reset stock from waste
            if (waste.length > 0) {
                setStock(waste.map(card => ({ ...card, faceUp: false })).reverse())
                setWaste([])
                setMoves(m => m + 1)
                playSound('shuffle')
            }
            return
        }

        // Draw 1 or 3 cards
        const numToDraw = Math.min(drawCount, stock.length)
        const drawnCards = stock.slice(-numToDraw).map(card => ({ ...card, faceUp: true }))
        setStock(stock.slice(0, -numToDraw))
        setWaste([...waste, ...drawnCards])
        setMoves(m => m + 1)
        setSelectedCards(null)
        setSelectedFrom(null)
        playSound('draw')
    }

    const handleCardClick = (card, source, pileIndex, cardIndex) => {
        if (isPaused) return

        setHintCard(null)
        setHintTarget(null)

        if (!card.faceUp) {
            // Flip face-down card if it's the top of a tableau pile
            if (source === 'tableau') {
                const pile = tableau[pileIndex]
                if (cardIndex === pile.length - 1) {
                    saveStateForUndo()
                    const newTableau = [...tableau]
                    newTableau[pileIndex] = [...pile]
                    newTableau[pileIndex][cardIndex] = { ...card, faceUp: true }
                    setTableau(newTableau)
                    playSound('flip')
                }
            }
            return
        }

        // If clicking on already selected cards, deselect
        if (selectedFrom && selectedFrom.source === source && selectedFrom.pileIndex === pileIndex) {
            setSelectedCards(null)
            setSelectedFrom(null)
            return
        }

        // If we have a selection, try to move
        if (selectedCards && selectedFrom) {
            let moved = false

            if (source === 'tableau') {
                const targetPile = tableau[pileIndex]
                const topCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null

                if (canStackOnTableau(selectedCards[0], topCard)) {
                    moveCards(pileIndex)
                    moved = true
                }
            } else if (source === 'foundation' && selectedCards.length === 1) {
                if (canStackOnFoundation(selectedCards[0], foundations[pileIndex])) {
                    moveToFoundation(pileIndex)
                    moved = true
                }
            }

            if (!moved) {
                // Select new cards instead
                selectCards(card, source, pileIndex, cardIndex)
            }
        } else {
            // Select cards
            selectCards(card, source, pileIndex, cardIndex)
        }
    }

    // Double-click to auto-move to foundation
    const handleCardDoubleClick = (card, source, pileIndex, cardIndex) => {
        if (isPaused) return
        if (!card.faceUp) return

        // Only works for single cards (top of pile or waste)
        if (source === 'tableau') {
            const pile = tableau[pileIndex]
            if (cardIndex !== pile.length - 1) return
        }

        // Find a foundation to move to
        for (let i = 0; i < 4; i++) {
            if (canStackOnFoundation(card, foundations[i])) {
                saveStateForUndo()
                const newFoundations = foundations.map((f, idx) =>
                    idx === i ? [...f, card] : [...f]
                )

                if (source === 'waste') {
                    setWaste(waste.slice(0, -1))
                } else if (source === 'tableau') {
                    const newTableau = tableau.map((p, idx) =>
                        idx === pileIndex ? p.slice(0, -1) : [...p]
                    )
                    setTableau(newTableau)
                }

                setFoundations(newFoundations)
                setMoves(m => m + 1)
                setSelectedCards(null)
                setSelectedFrom(null)
                setHintCard(null)
                setHintTarget(null)
                playSound('place')
                return
            }
        }
    }

    const selectCards = (card, source, pileIndex, cardIndex) => {
        if (source === 'waste') {
            setSelectedCards([card])
            setSelectedFrom({ source, pileIndex: 0, cardIndex: waste.length - 1 })
        } else if (source === 'tableau') {
            const pile = tableau[pileIndex]
            const cardsToSelect = pile.slice(cardIndex)
            setSelectedCards(cardsToSelect)
            setSelectedFrom({ source, pileIndex, cardIndex })
        } else if (source === 'foundation') {
            const pile = foundations[pileIndex]
            if (pile.length > 0) {
                setSelectedCards([pile[pile.length - 1]])
                setSelectedFrom({ source, pileIndex, cardIndex: pile.length - 1 })
            }
        }
    }

    const handleEmptyTableauClick = (pileIndex) => {
        if (isPaused) return
        if (selectedCards && selectedCards[0].value === 'K') {
            moveCards(pileIndex)
        }
    }

    const handleEmptyFoundationClick = (pileIndex) => {
        if (isPaused) return
        if (selectedCards && selectedCards.length === 1 && selectedCards[0].value === 'A') {
            moveToFoundation(pileIndex)
        }
    }

    const moveCards = (targetPileIndex) => {
        if (!selectedCards || !selectedFrom) return

        saveStateForUndo()

        const newTableau = [...tableau.map(p => [...p])]
        const newWaste = [...waste]
        const newFoundations = [...foundations.map(f => [...f])]

        // Remove cards from source
        if (selectedFrom.source === 'waste') {
            newWaste.pop()
            setWaste(newWaste)
        } else if (selectedFrom.source === 'tableau') {
            newTableau[selectedFrom.pileIndex] = newTableau[selectedFrom.pileIndex].slice(0, selectedFrom.cardIndex)
        } else if (selectedFrom.source === 'foundation') {
            newFoundations[selectedFrom.pileIndex].pop()
            setFoundations(newFoundations)
        }

        // Add cards to target tableau
        newTableau[targetPileIndex] = [...newTableau[targetPileIndex], ...selectedCards]

        setTableau(newTableau)
        setMoves(m => m + 1)
        setSelectedCards(null)
        setSelectedFrom(null)
        playSound('place')
    }

    const moveToFoundation = (foundationIndex) => {
        if (!selectedCards || selectedCards.length !== 1 || !selectedFrom) return

        saveStateForUndo()

        const card = selectedCards[0]
        const newFoundations = [...foundations.map(f => [...f])]
        const newTableau = [...tableau.map(p => [...p])]
        const newWaste = [...waste]

        // Remove from source
        if (selectedFrom.source === 'waste') {
            newWaste.pop()
            setWaste(newWaste)
        } else if (selectedFrom.source === 'tableau') {
            newTableau[selectedFrom.pileIndex] = newTableau[selectedFrom.pileIndex].slice(0, selectedFrom.cardIndex)
            setTableau(newTableau)
        }

        // Add to foundation
        newFoundations[foundationIndex] = [...newFoundations[foundationIndex], card]

        setFoundations(newFoundations)
        setMoves(m => m + 1)
        setSelectedCards(null)
        setSelectedFrom(null)
        playSound('place')
    }

    const handleFoundationClick = (foundationIndex) => {
        if (isPaused) return
        if (!selectedCards || selectedCards.length !== 1) return

        const card = selectedCards[0]
        if (canStackOnFoundation(card, foundations[foundationIndex])) {
            moveToFoundation(foundationIndex)
        }
    }

    const isSelected = (card, source, pileIndex, cardIndex) => {
        if (!selectedFrom || selectedFrom.source !== source) return false
        if (selectedFrom.pileIndex !== pileIndex) return false
        if (source === 'tableau') {
            return cardIndex >= selectedFrom.cardIndex
        }
        return cardIndex === selectedFrom.cardIndex
    }

    const isHinted = (card, source, pileIndex) => {
        if (!hintCard) return false
        if (hintCard.source !== source) return false
        if (source === 'tableau' && hintCard.pileIndex !== pileIndex) return false
        return hintCard.id === card.id
    }

    const isHintTarget = (type, index) => {
        if (!hintTarget) return false
        return hintTarget.type === type && hintTarget.index === index
    }

    const playAgain = () => {
        setGameStarted(false)
        setGameComplete(false)
        setMoves(0)
        setMoveHistory([])
        setStock([])
        setWaste([])
        setFoundations([[], [], [], []])
        setTableau([[], [], [], [], [], [], []])
        setStartTime(null)
        setElapsedTime(0)
        setPausedTime(0)
        setIsPaused(false)
        setSelectedCards(null)
        setSelectedFrom(null)
        setHintCard(null)
        setHintTarget(null)
        setAutoCompleting(false)
    }

    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Card back component
    const CardBack = ({ small = false }) => {
        const isStockHinted = hintCard?.source === 'stock'
        const animClass = settings.animations ? `transition-all duration-${getAnimationDuration()}` : ''

        if (cardBackAdvertiser?.card_type === 'uploaded' && cardBackAdvertiser?.image_url) {
            return (
                <div className={`${small ? 'w-8 h-11' : 'w-14 h-20 sm:w-16 sm:h-24'} rounded-md shadow-lg overflow-hidden border-2 ${isStockHinted ? 'border-green-400 ring-2 ring-green-400' : 'border-blue-400'} bg-gray-800 ${animClass}`}>
                    <img src={cardBackAdvertiser.image_url} alt="Sponsor" className="w-full h-full object-contain" />
                </div>
            )
        } else if (cardBackAdvertiser) {
            return (
                <div
                    className={`${small ? 'w-8 h-11' : 'w-14 h-20 sm:w-16 sm:h-24'} rounded-md shadow-lg border-2 ${isStockHinted ? 'border-green-400 ring-2 ring-green-400' : 'border-blue-400'} flex items-center justify-center p-1 ${animClass}`}
                    style={{ backgroundColor: cardBackAdvertiser.card_color || '#4F46E5' }}
                >
                    <span className="text-center font-bold text-[8px] sm:text-[10px]" style={{ color: cardBackAdvertiser.text_color || '#FFFFFF' }}>
                        {cardBackAdvertiser.display_name || cardBackAdvertiser.title}
                    </span>
                </div>
            )
        }
        return (
            <div className={`${small ? 'w-8 h-11' : 'w-14 h-20 sm:w-16 sm:h-24'} bg-blue-600 rounded-md shadow-lg border-2 ${isStockHinted ? 'border-green-400 ring-2 ring-green-400' : 'border-blue-400'} flex items-center justify-center ${animClass}`}>
                <div className="w-8 h-12 sm:w-10 sm:h-14 border-2 border-blue-300 rounded opacity-50"></div>
            </div>
        )
    }

    // Card face component
    const CardFace = ({ card, selected = false, hinted = false, small = false, onClick, onDoubleClick }) => {
        const sizeClass = small ? 'w-8 h-11' : 'w-14 h-20 sm:w-16 sm:h-24'
        let borderClass = 'border-gray-300'
        if (selected) borderClass = 'border-yellow-400 ring-2 ring-yellow-400'
        else if (hinted) borderClass = 'border-green-400 ring-2 ring-green-400'

        const animDuration = getAnimationDuration()
        const animClass = settings.animations ? `transition-all` : ''
        const animStyle = settings.animations ? { transitionDuration: `${animDuration}ms` } : {}

        const handleClick = (e) => {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current)
                clickTimeout.current = null
                onDoubleClick && onDoubleClick(e)
            } else {
                clickTimeout.current = setTimeout(() => {
                    clickTimeout.current = null
                    onClick && onClick(e)
                }, 250)
            }
        }

        return (
            <div
                onClick={handleClick}
                className={`${sizeClass} bg-white rounded-md shadow-lg border-2 ${borderClass} flex flex-col items-center justify-between p-0.5 cursor-pointer hover:border-blue-400 overflow-hidden flex-shrink-0 ${animClass}`}
                style={animStyle}
            >
                <div className={`self-start ${SUIT_COLORS[card.suit]} ${small ? 'text-[8px]' : 'text-[10px] sm:text-xs'} font-bold leading-tight flex-shrink-0`}>
                    {card.value}
                    <span className="block">{SUIT_SYMBOLS[card.suit]}</span>
                </div>
                <div className={`${SUIT_COLORS[card.suit]} ${small ? 'text-base' : 'text-xl sm:text-2xl'} flex-shrink-0`}>
                    {SUIT_SYMBOLS[card.suit]}
                </div>
                <div className={`self-end ${SUIT_COLORS[card.suit]} ${small ? 'text-[8px]' : 'text-[10px] sm:text-xs'} font-bold leading-tight rotate-180 flex-shrink-0`}>
                    {card.value}
                    <span className="block">{SUIT_SYMBOLS[card.suit]}</span>
                </div>
            </div>
        )
    }

    // Empty pile placeholder
    const EmptyPile = ({ onClick, label, hinted = false }) => (
        <div
            onClick={onClick}
            className={`w-14 h-20 sm:w-16 sm:h-24 border-2 border-dashed ${hinted ? 'border-green-400 ring-2 ring-green-400' : 'border-green-500'} rounded-md flex items-center justify-center cursor-pointer hover:border-green-400 transition-all`}
        >
            <span className="text-green-500 text-xs">{label}</span>
        </div>
    )

    // Small Display Ad component with eyeball
    const DisplayAdSmall = ({ ad }) => {
        if (!ad) return null

        const handleExpand = (e) => {
            e.stopPropagation()
            handleEyeballClick(ad)
        }

        if (ad.card_type === 'uploaded' && ad.image_url) {
            return (
                <div className="relative aspect-[4/3] rounded-lg shadow-lg overflow-hidden bg-gray-800">
                    <img
                        src={ad.image_url}
                        alt={ad.title || 'Sponsor'}
                        className="w-full h-full object-contain"
                    />
                    <button
                        onClick={handleExpand}
                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                    >
                        👁
                    </button>
                </div>
            )
        } else {
            return (
                <div
                    className="relative aspect-[4/3] rounded-lg shadow-lg flex items-center justify-center p-2"
                    style={{ backgroundColor: ad.card_color || '#4F46E5' }}
                >
                    <h3 className="font-bold text-xs text-center line-clamp-2" style={{ color: ad.text_color || '#FFFFFF' }}>
                        {ad.title}
                    </h3>
                    <button
                        onClick={handleExpand}
                        className="absolute bottom-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                    >
                        👁
                    </button>
                </div>
            )
        }
    }

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-12 h-12 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted} font-medium`}>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-green-800`}>
            {/* Settings Modal */}
            {showSettings && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="bg-green-900 border-2 border-green-600 rounded-xl p-6 max-w-sm w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            ⚙️ Game Settings
                        </h2>

                        {/* Sound Effects */}
                        <div className="flex items-center justify-between py-3 border-b border-green-700">
                            <span className="text-white">🔊 Sound Effects</span>
                            <button
                                onClick={() => saveSettings({ ...settings, soundEffects: !settings.soundEffects })}
                                className={`w-14 h-8 rounded-full transition-all ${settings.soundEffects ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-all ${settings.soundEffects ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>

                        {/* Animations */}
                        <div className="flex items-center justify-between py-3 border-b border-green-700">
                            <span className="text-white">🎬 Animations</span>
                            <button
                                onClick={() => saveSettings({ ...settings, animations: !settings.animations })}
                                className={`w-14 h-8 rounded-full transition-all ${settings.animations ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-all ${settings.animations ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>

                        {/* Animation Speed */}
                        {settings.animations && (
                            <div className="flex items-center justify-between py-3 border-b border-green-700">
                                <span className="text-white text-sm">Animation Speed</span>
                                <div className="flex gap-1">
                                    {['fast', 'normal', 'slow'].map((speed) => (
                                        <button
                                            key={speed}
                                            onClick={() => saveSettings({ ...settings, animationSpeed: speed })}
                                            className={`px-3 py-1 rounded text-xs font-medium transition-all ${settings.animationSpeed === speed ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                                        >
                                            {speed.charAt(0).toUpperCase() + speed.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Show Pause Button */}
                        <div className="flex items-center justify-between py-3 border-b border-green-700">
                            <span className="text-white">⏸️ Pause Button</span>
                            <button
                                onClick={() => saveSettings({ ...settings, showPauseButton: !settings.showPauseButton })}
                                className={`w-14 h-8 rounded-full transition-all ${settings.showPauseButton ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-all ${settings.showPauseButton ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>

                        {/* Show Timer */}
                        <div className="flex items-center justify-between py-3 border-b border-green-700">
                            <span className="text-white">⏱️ Show Timer</span>
                            <button
                                onClick={() => saveSettings({ ...settings, showTimer: !settings.showTimer })}
                                className={`w-14 h-8 rounded-full transition-all ${settings.showTimer ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-all ${settings.showTimer ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowSettings(false)}
                            className="mt-6 w-full py-3 bg-yellow-500 text-green-900 font-bold rounded-lg hover:bg-yellow-400 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Promo Popup Modal */}
            {viewingPromoPopup && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingPromoPopup(null)}
                >
                    <div
                        className="max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: viewingPromoPopup.popup_bg_color || '#4F46E5' }}
                    >
                        {viewingPromoPopup.popup_image_url && (
                            <img
                                src={viewingPromoPopup.popup_image_url}
                                alt="Promo"
                                className="w-full h-40 object-cover"
                            />
                        )}
                        <div className="p-5">
                            <h2
                                className="font-bold text-xl text-center mb-3"
                                style={{ color: viewingPromoPopup.popup_text_color || '#FFFFFF' }}
                            >
                                {viewingPromoPopup.popup_title}
                            </h2>
                            <p
                                className="text-center mb-4 whitespace-pre-wrap"
                                style={{ color: viewingPromoPopup.popup_text_color || '#FFFFFF', opacity: 0.9 }}
                            >
                                {viewingPromoPopup.popup_message}
                            </p>
                            {viewingPromoPopup.popup_cta_text && viewingPromoPopup.popup_cta_url && (
                                <div className="text-center mb-3">
                                    <button
                                        onClick={() => handleCtaClick(viewingPromoPopup, viewingPromoPopup.popup_cta_url)}
                                        className="px-6 py-2.5 rounded-lg font-bold text-sm transition-transform hover:scale-105 active:scale-95"
                                        style={{
                                            backgroundColor: viewingPromoPopup.popup_text_color || '#FFFFFF',
                                            color: viewingPromoPopup.popup_bg_color || '#4F46E5'
                                        }}
                                    >
                                        {viewingPromoPopup.popup_cta_text}
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => setViewingPromoPopup(null)}
                                className="w-full py-2 rounded-lg font-medium text-sm transition-all hover:opacity-80"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    color: viewingPromoPopup.popup_text_color || '#FFFFFF'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pause Overlay */}
            {isPaused && gameStarted && !gameComplete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40">
                    <div className="bg-green-900 border-2 border-green-600 rounded-xl p-8 text-center shadow-2xl">
                        <h2 className="text-3xl font-bold text-white mb-4">⏸️ PAUSED</h2>
                        <p className="text-green-300 mb-6">Game is paused</p>
                        <button
                            onClick={togglePause}
                            className="px-8 py-4 bg-yellow-500 text-green-900 font-bold text-lg rounded-xl hover:bg-yellow-400 transition-all"
                        >
                            ▶️ Resume
                        </button>
                    </div>
                </div>
            )}

            {/* Ad Expand Modal */}
            {viewingAd && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setViewingAd(null)}
                >
                    <div
                        className="max-w-sm w-full rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {viewingAd.card_type === 'uploaded' && viewingAd.image_url ? (
                            <div className="bg-gray-800">
                                <img
                                    src={viewingAd.image_url}
                                    alt="Card"
                                    className="w-full h-auto"
                                    style={{ transform: `rotate(${viewingAd.image_rotation || 0}deg)` }}
                                />
                                {viewingAd.website_url && (
                                    <div className="p-3 text-center">
                                        {urlClickable ? (
                                            <a href={viewingAd.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                                                🔗 {viewingAd.website_url}
                                            </a>
                                        ) : (
                                            <p className="text-gray-400 text-sm">🔗 {viewingAd.website_url}</p>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={() => setViewingAd(null)}
                                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="p-6" style={{ backgroundColor: viewingAd.card_color || '#4F46E5' }}>
                                <div className="text-center mb-4">
                                    <h2 className="font-bold text-xl" style={{ color: viewingAd.text_color || '#FFFFFF' }}>
                                        {viewingAd.full_business_name || viewingAd.display_name || viewingAd.title}
                                    </h2>
                                </div>
                                {(viewingAd.tagline || viewingAd.message) && (
                                    <div className="text-center mb-4">
                                        <p className="text-sm" style={{ color: viewingAd.text_color || '#FFFFFF' }}>
                                            {viewingAd.tagline || viewingAd.message}
                                        </p>
                                    </div>
                                )}
                                <div className="text-center space-y-1" style={{ color: viewingAd.text_color || '#FFFFFF' }}>
                                    {viewingAd.phone && <p className="text-sm">📞 {viewingAd.phone}</p>}
                                    {viewingAd.email && <p className="text-sm">✉️ {viewingAd.email}</p>}
                                    {viewingAd.website_url && (
                                        urlClickable ? (
                                            <a href={viewingAd.website_url} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:opacity-80 block">
                                                🔗 {viewingAd.website_url}
                                            </a>
                                        ) : (
                                            <p className="text-sm">🔗 {viewingAd.website_url}</p>
                                        )
                                    )}
                                </div>
                                <button
                                    onClick={() => setViewingAd(null)}
                                    className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Win Screen with Sponsor */}
            {gameComplete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-b from-green-600 to-green-800 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border-4 border-yellow-400">
                        <h2 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2">🎉 YOU WON! 🎉</h2>
                        <p className="text-white text-lg mb-4">Congratulations!</p>

                        <div className="bg-black/20 rounded-xl p-4 mb-4">
                            <div className="grid grid-cols-3 gap-4 text-white">
                                <div>
                                    <p className="text-2xl font-bold">{moves}</p>
                                    <p className="text-xs text-green-200">Moves</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
                                    <p className="text-xs text-green-200">Time</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{Math.max(0, 10000 - (moves * 10) - (elapsedTime * 2))}</p>
                                    <p className="text-xs text-green-200">Score</p>
                                </div>
                            </div>
                        </div>

                        {user && (
                            <p className="text-green-200 text-sm mb-4 animate-pulse">✓ Score saved to leaderboard!</p>
                        )}

                        {!user && (
                            <div className="bg-yellow-400 text-green-900 rounded-lg p-4 mb-4">
                                <p className="font-bold text-lg">🎉 Great Score!</p>
                                <p className="text-sm mt-1">Sign up <span className="font-black underline">100% FREE</span> to save your scores & compete for prizes!</p>
                                <p className="text-xs mt-1 font-medium">No purchase necessary to win.</p>
                                <button
                                    onClick={() => router.push('/auth/register')}
                                    className="mt-3 px-6 py-2 bg-green-800 text-yellow-400 font-bold rounded-lg hover:bg-green-700 transition-all"
                                >
                                    Create Free Account
                                </button>
                            </div>
                        )}

                        {/* Win Sponsor */}
                        {winSponsor && (
                            <div className="mb-4">
                                <p className="text-green-200 text-xs mb-2">This win brought to you by:</p>
                                <div
                                    className="cursor-pointer transform hover:scale-105 transition-transform"
                                    onClick={() => {
                                        trackSponsorClick(winSponsor.user_id)
                                        trackWinSponsorView(winSponsor.user_id)
                                    }}
                                >
                                    {winSponsor.card_type === 'uploaded' && winSponsor.image_url ? (
                                        <img src={winSponsor.image_url} alt="Sponsor" className="w-full max-w-xs mx-auto rounded-lg shadow-lg" />
                                    ) : (
                                        <div
                                            className="p-4 rounded-lg shadow-lg max-w-xs mx-auto"
                                            style={{ backgroundColor: winSponsor.card_color || '#4F46E5' }}
                                        >
                                            <h3 className="font-bold text-lg" style={{ color: winSponsor.text_color || '#FFFFFF' }}>{winSponsor.title}</h3>
                                            {winSponsor.message && <p className="text-sm mt-1" style={{ color: winSponsor.text_color || '#FFFFFF' }}>{winSponsor.message}</p>}
                                            {winSponsor.phone && <p className="text-sm mt-2" style={{ color: winSponsor.text_color || '#FFFFFF' }}>📞 {winSponsor.phone}</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center flex-wrap">
                            <button
                                onClick={async () => {
                                    await refreshAds()
                                    startGame(drawCount)
                                }}
                                className="px-6 py-3 bg-yellow-400 text-green-900 font-bold rounded-lg hover:bg-yellow-300 transition-all"
                            >
                                Play Again
                            </button>
                            <button
                                onClick={startNewGame}
                                className="px-6 py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-all"
                            >
                                New Game
                            </button>
                            <button
                                onClick={() => {
                                    playAgain()
                                    setShowLeaderboard(true)
                                }}
                                className="px-6 py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-all"
                            >
                                Leaderboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DEMO MODE BANNER */}
            {!user && (
                <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 text-white text-center py-2 px-4 shadow-lg mb-2">
                    <p className="text-sm font-bold">DEMO MODE — Register FREE to win real prizes!</p>
                    <button
                        onClick={() => router.push('/auth/register')}
                        className="inline-block mt-1 px-4 py-1 bg-white text-purple-600 font-bold rounded-full text-xs hover:bg-yellow-300 transition-all"
                    >
                        Sign Up Now →
                    </button>
                </div>
            )}

            <main className="max-w-4xl mx-auto px-2 py-2 sm:px-4 sm:py-4">
                {/* Weekly Prize Banner */}
                {weeklyPrize && !gameStarted && (
                    <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded-xl p-4 mb-4 text-center shadow-lg">
                        <p className="text-white font-bold mb-1 text-sm">🏆 This Week's Prize 🏆</p>
                        {weeklyPrize.is_surprise ? (
                            <p className="text-xl font-bold text-white">🎁 Surprise Prize! 🎁</p>
                        ) : weeklyPrize.prize_type === 'cash' ? (
                            <>
                                <p className="text-xl font-bold text-white">${weeklyPrize.total_prize_pool}</p>
                                <p className="text-white text-sm">
                                    {weeklyPrize.number_of_winners === 1 ? 'Winner takes all!' : `Split among top ${weeklyPrize.number_of_winners} players`}
                                </p>
                            </>
                        ) : (
                            <p className="text-xl font-bold text-white">🎁 Special Prize!</p>
                        )}
                    </div>
                )}

                {/* Pre-game Screen */}
                {!gameStarted && (
                    <>
                        <div className="flex justify-center mb-4">
                            <button
                                onClick={() => setShowLeaderboard(!showLeaderboard)}
                                className="px-4 py-2 bg-yellow-500 text-green-900 font-bold rounded-lg hover:bg-yellow-400 transition-all text-sm"
                            >
                                🏆 {showLeaderboard ? 'Hide' : 'Show'} Leaderboard
                            </button>
                        </div>

                        {showLeaderboard && (
                            <div className="bg-green-900/80 border border-green-700 rounded-xl p-4 mb-4">
                                <h2 className="text-xl font-bold text-white mb-3">🃏 Solitaire Leaderboard</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-green-700">
                                                <th className="text-left py-2 text-green-300">#</th>
                                                <th className="text-left py-2 text-green-300">Player</th>
                                                <th className="text-left py-2 text-green-300">Moves</th>
                                                <th className="text-left py-2 text-green-300">Time</th>
                                                <th className="text-left py-2 text-green-300">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map((entry, index) => (
                                                <tr key={entry.id} className="border-b border-green-700/50">
                                                    <td className="py-2 text-white">{index + 1}</td>
                                                    <td className="py-2 text-white">{entry.users.username}</td>
                                                    <td className="py-2 text-green-300">{entry.moves}</td>
                                                    <td className="py-2 text-green-300">{formatTime(entry.time_seconds)}</td>
                                                    <td className="py-2 text-yellow-400 font-bold">{entry.score}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {leaderboard.length === 0 && (
                                        <p className="text-center text-green-300 py-4">No scores yet!</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {!user && (
                            <div className="bg-yellow-400 text-green-900 rounded-lg p-4 mb-4 text-center">
                                <p className="font-bold text-lg">🏆 Want to Compete for Prizes?</p>
                                <p className="text-sm mt-1 animate-pulse">Sign up <span className="font-black underline">100% FREE</span> to save your scores & win!</p>
                                <p className="text-xs mt-1 font-medium">No purchase necessary to win.</p>
                                <button
                                    onClick={() => router.push('/auth/register')}
                                    className="mt-3 px-6 py-2 bg-green-800 text-yellow-400 font-bold rounded-lg hover:bg-green-700 transition-all"
                                >
                                    Create Free Account
                                </button>
                            </div>
                        )}

                        <div className="text-center py-8">
                            <div className="flex justify-center items-center gap-3 mb-3">
                                <h1 className="text-3xl sm:text-4xl font-bold text-white">🃏 Solitaire</h1>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    className="p-2 bg-green-700 hover:bg-green-600 rounded-lg transition-all text-xl"
                                    title="Settings"
                                >
                                    ⚙️
                                </button>
                            </div>
                            <p className="text-green-200 mb-4">Classic Klondike - Stack cards, clear the board!</p>

                            {/* Stats Display */}
                            {stats.gamesPlayed > 0 && (
                                <div className="bg-green-900/60 border border-green-700 rounded-lg p-3 mb-6 max-w-md mx-auto">
                                    <p className="text-green-300 text-xs mb-2">📊 Your Stats</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-white font-bold">{stats.gamesPlayed}</p>
                                            <p className="text-green-400 text-xs">Played</p>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{stats.gamesWon}</p>
                                            <p className="text-green-400 text-xs">Won</p>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%</p>
                                            <p className="text-green-400 text-xs">Win Rate</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t border-green-700">
                                        <div>
                                            <p className="text-yellow-400 font-bold">{stats.bestScore || '-'}</p>
                                            <p className="text-green-400 text-xs">Best Score</p>
                                        </div>
                                        <div>
                                            <p className="text-yellow-400 font-bold">{stats.bestTime ? formatTime(stats.bestTime) : '-'}</p>
                                            <p className="text-green-400 text-xs">Best Time</p>
                                        </div>
                                        <div>
                                            <p className="text-yellow-400 font-bold">🔥 {stats.currentStreak}</p>
                                            <p className="text-green-400 text-xs">Streak</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 justify-center flex-wrap">
                                <button
                                    onClick={() => startGame(1)}
                                    className="px-8 py-4 bg-yellow-500 text-green-900 text-lg font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg"
                                >
                                    Draw 1
                                    <span className="block text-sm font-normal">(Easier)</span>
                                </button>
                                <button
                                    onClick={() => startGame(3)}
                                    className="px-8 py-4 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-400 transition-all shadow-lg"
                                >
                                    Draw 3
                                    <span className="block text-sm font-normal">(Classic)</span>
                                </button>
                            </div>
                        </div>

                        {/* Display Ads - Pre-game: up to 8 on desktop, 4 on mobile, centered */}
                        {displayAds.length > 0 && (
                            <div className="mt-8 mb-4">
                                <p className="text-green-300 text-xs text-center mb-3">Our Sponsors</p>
                                {/* Desktop: up to 8 ads, centered */}
                                <div className="hidden md:flex flex-wrap justify-center gap-2">
                                    {displayAds.slice(0, 8).map((ad, index) => (
                                        <div key={`${ad.id}-${index}`} className="w-24">
                                            <DisplayAdSmall ad={ad} />
                                        </div>
                                    ))}
                                </div>
                                {/* Mobile: up to 4 ads, centered */}
                                <div className="md:hidden flex flex-wrap justify-center gap-2">
                                    {displayAds.slice(0, 4).map((ad, index) => (
                                        <div key={ad.id || index} className="w-20">
                                            <DisplayAdSmall ad={ad} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Game Board */}
                {gameStarted && !gameComplete && (
                    <>
                        {/* Stats Bar */}
                        <div className="bg-green-900/80 border border-green-700 rounded-lg p-2 mb-3">
                            <div className="flex justify-between items-center text-xs sm:text-sm flex-wrap gap-2">
                                <div className="flex gap-3">
                                    <span className="text-white"><span className="text-green-300">Moves:</span> {moves}</span>
                                    {settings.showTimer && (
                                        <span className="text-white"><span className="text-green-300">Time:</span> {formatTime(elapsedTime)}</span>
                                    )}
                                    <span className="text-white"><span className="text-green-300">Score:</span> {Math.max(0, 10000 - (moves * 10) - (elapsedTime * 2))}</span>
                                </div>
                                <div className="flex gap-1 sm:gap-2">
                                    <button
                                        onClick={undoMove}
                                        disabled={moveHistory.length === 0 || isPaused}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${moveHistory.length > 0 && !isPaused ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        ↩ Undo
                                    </button>
                                    <button
                                        onClick={findHint}
                                        disabled={isPaused}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${!isPaused ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        💡 Hint
                                    </button>
                                    {canAutoComplete() && (
                                        <button
                                            onClick={() => setAutoCompleting(true)}
                                            disabled={isPaused}
                                            className={`px-2 py-1 rounded text-xs font-medium animate-pulse ${!isPaused ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                        >
                                            ✨ Auto
                                        </button>
                                    )}
                                    {settings.showPauseButton && (
                                        <button
                                            onClick={togglePause}
                                            className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-500 transition-all text-xs font-medium"
                                        >
                                            {isPaused ? '▶️' : '⏸️'}
                                        </button>
                                    )}
                                    <button
                                        onClick={restartSameDeal}
                                        disabled={!initialDeck || isPaused}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${initialDeck && !isPaused ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                        title="Restart same deal"
                                    >
                                        🔄
                                    </button>
                                    <button
                                        onClick={startNewGame}
                                        className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-all text-xs font-medium"
                                    >
                                        New
                                    </button>
                                    <button
                                        onClick={playAgain}
                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-all text-xs font-medium"
                                    >
                                        Quit
                                    </button>
                                    <button
                                        onClick={() => {
                                            const finalTime = elapsedTime
                                            const score = Math.max(0, 10000 - (moves * 10) - (finalTime * 2))
                                            playSound('win')
                                            updateStatsAfterGame(true, finalTime, score)
                                            if (user) {
                                                saveScore(moves, finalTime, score)
                                                completeGameSession(moves, score)
                                            }
                                            setGameComplete(true)
                                        }}
                                        className="px-2 py-1 bg-pink-600 text-white rounded text-xs font-medium"
                                    >
                                        TEST WIN
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Hint message */}
                        {hintTarget?.type === 'draw' && (
                            <div className="bg-purple-600/80 text-white text-center py-2 rounded-lg mb-3 text-sm">
                                💡 No moves available - try drawing from the stock pile
                            </div>
                        )}

                        {/* Top Row: Stock, Waste, Foundations */}
                        <div className="flex justify-between items-start mb-4 gap-2">
                            {/* Stock and Waste */}
                            <div className="flex gap-2">
                                {/* Stock */}
                                <div onClick={drawFromStock} className={`cursor-pointer ${isPaused ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {stock.length > 0 ? (
                                        <CardBack />
                                    ) : (
                                        <div className="w-14 h-20 sm:w-16 sm:h-24 border-2 border-dashed border-green-500 rounded-md flex items-center justify-center">
                                            <span className="text-green-400 text-2xl">↺</span>
                                        </div>
                                    )}
                                </div>

                                {/* Waste */}
                                <div className={isPaused ? 'opacity-50 pointer-events-none' : ''}>
                                    {waste.length > 0 ? (
                                        <CardFace
                                            card={waste[waste.length - 1]}
                                            selected={isSelected(waste[waste.length - 1], 'waste', 0, waste.length - 1)}
                                            hinted={isHinted(waste[waste.length - 1], 'waste', 0)}
                                            onClick={() => handleCardClick(waste[waste.length - 1], 'waste', 0, waste.length - 1)}
                                            onDoubleClick={() => handleCardDoubleClick(waste[waste.length - 1], 'waste', 0, waste.length - 1)}
                                        />
                                    ) : (
                                        <EmptyPile onClick={() => { }} label="" />
                                    )}
                                </div>
                            </div>

                            {/* Foundations */}
                            <div className={`flex gap-1 sm:gap-2 ${isPaused ? 'opacity-50 pointer-events-none' : ''}`}>
                                {foundations.map((foundation, i) => (
                                    <div key={i} onClick={() => foundation.length === 0 ? handleEmptyFoundationClick(i) : handleFoundationClick(i)}>
                                        {foundation.length > 0 ? (
                                            <CardFace
                                                card={foundation[foundation.length - 1]}
                                                selected={isSelected(foundation[foundation.length - 1], 'foundation', i, foundation.length - 1)}
                                                hinted={false}
                                                onClick={() => handleCardClick(foundation[foundation.length - 1], 'foundation', i, foundation.length - 1)}
                                                onDoubleClick={() => { }}
                                            />
                                        ) : (
                                            <EmptyPile
                                                onClick={() => handleEmptyFoundationClick(i)}
                                                label={SUIT_SYMBOLS[SUITS[i]]}
                                                hinted={isHintTarget('foundation', i)}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tableau - Centered */}
                        <div className={`flex gap-1 sm:gap-2 justify-center ${isPaused ? 'opacity-50 pointer-events-none' : ''}`}>
                            {tableau.map((pile, pileIndex) => (
                                <div key={pileIndex} className="flex flex-col items-center min-h-[200px]">
                                    {pile.length === 0 ? (
                                        <EmptyPile
                                            onClick={() => handleEmptyTableauClick(pileIndex)}
                                            label="K"
                                            hinted={isHintTarget('tableau', pileIndex)}
                                        />
                                    ) : (
                                        pile.map((card, cardIndex) => (
                                            <div
                                                key={card.id}
                                                style={{ marginTop: cardIndex === 0 ? 0 : '-60px' }}
                                                className="relative"
                                            >
                                                {card.faceUp ? (
                                                    <CardFace
                                                        card={card}
                                                        selected={isSelected(card, 'tableau', pileIndex, cardIndex)}
                                                        hinted={isHinted(card, 'tableau', pileIndex)}
                                                        onClick={() => handleCardClick(card, 'tableau', pileIndex, cardIndex)}
                                                        onDoubleClick={() => handleCardDoubleClick(card, 'tableau', pileIndex, cardIndex)}
                                                    />
                                                ) : (
                                                    <div onClick={() => handleCardClick(card, 'tableau', pileIndex, cardIndex)}>
                                                        <CardBack />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Instructions */}
                        <div className="mt-4 text-center text-green-300 text-xs">
                            <p>Click to select, click destination to move. Double-click to send to foundation.</p>
                        </div>

                        {/* Display Ads - During gameplay */}
                        {displayAds.length > 0 && (
                            <div className="mt-4">
                                <p className="text-green-300 text-xs text-center mb-2">Our Sponsors</p>
                                {/* Desktop: up to 8 ads */}
                                <div className="hidden md:flex flex-wrap justify-center gap-2">
                                    {displayAds.slice(0, 8).map((ad, index) => (
                                        <div key={`${ad.id}-${index}`} className="w-24">
                                            <DisplayAdSmall ad={ad} />
                                        </div>
                                    ))}
                                </div>
                                {/* Mobile: up to 4 ads */}
                                <div className="md:hidden flex flex-wrap justify-center gap-2">
                                    {displayAds.slice(0, 4).map((ad, index) => (
                                        <div key={`${ad.id}-${index}`} className="w-20">
                                            <DisplayAdSmall ad={ad} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import Tooltip from '@/components/Tooltip'

// ===== GAME DEFINITIONS =====
const GAMES = [
    { key: 'slots', label: '🎰 Slots', color: 'purple' },
    { key: 'match_easy', label: '🎮 Match Easy Card Game', color: 'green' },
    { key: 'match_challenge', label: '🎮 Match Challenge Card Game', color: 'blue' },
    { key: 'solitaire', label: '🃏 Solitaire', color: 'emerald' }
]

// ===== DEFAULT DAILY REWARDS =====
const DEFAULT_DAILY_REWARDS = {
    first_tokens: 100,
    first_entries: 25,
    second_tokens: 50,
    second_entries: 10,
    third_tokens: 25,
    third_entries: 5,
    min_plays: 3,
    is_enabled: true
}

// ===== TOOLTIP CONTENT =====
const TIPS = {
    // Weekly prizes
    prize_type: "Cash = real money prize. Tokens = in-game currency. Merch = physical item. Custom = describe your own prize.",
    number_of_winners: "How many players win each week. Each winner gets their own prize amount.",
    prize_amount: "The prize value for each winner position. 1st place is typically highest.",
    announcement_text: "Optional message shown to players about this week's prize. Use for hype or special announcements.",

    // Daily rewards
    tokens: "Bonus tokens awarded to daily leaderboard winners. Added to their balance automatically at midnight.",
    entries: "Drawing entries awarded to daily leaderboard winners. More entries = better chance in weekly drawing.",
    min_plays: "Players must complete this many plays to qualify for daily rewards. Prevents gaming the system.",

    // Queue
    queue_week: "Click any week to set or edit its prize. Red = no prize set. Green = prize configured. Blue = recurring prize."
}

// ===== WARNING THRESHOLDS FOR DAILY REWARDS =====
const getDailyWarnings = (reward) => {
    const warnings = []

    if (reward.first_tokens < reward.second_tokens) {
        warnings.push({ message: '1st place tokens should be higher than 2nd place' })
    }
    if (reward.second_tokens < reward.third_tokens) {
        warnings.push({ message: '2nd place tokens should be higher than 3rd place' })
    }
    if (reward.first_entries < reward.second_entries) {
        warnings.push({ message: '1st place entries should be higher than 2nd place' })
    }
    if (reward.second_entries < reward.third_entries) {
        warnings.push({ message: '2nd place entries should be higher than 3rd place' })
    }
    if (reward.min_plays === 0) {
        warnings.push({ message: 'Min plays is 0 — players can win without playing' })
    }
    if (reward.first_tokens > 500) {
        warnings.push({ message: 'High 1st place tokens could cause inflation' })
    }

    return warnings
}

export default function AdminPrizesPage() {
    const { currentTheme } = useTheme()

    // ===== TAB STATE =====
    const [activeTab, setActiveTab] = useState('weekly')

    // ===== WEEKLY PRIZE STATE =====
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [currentPrize, setCurrentPrize] = useState(null)
    const [selectedGame, setSelectedGame] = useState('slots')
    const [prizeType, setPrizeType] = useState('cash')
    const [numberOfWinners, setNumberOfWinners] = useState(1)
    const [prizeAmounts, setPrizeAmounts] = useState([''])
    const [prizeDescriptions, setPrizeDescriptions] = useState([''])
    const [isSurprise, setIsSurprise] = useState(false)
    const [isRecurring, setIsRecurring] = useState(false)
    const [announcementText, setAnnouncementText] = useState('')
    const [cardBackImageUrl, setCardBackImageUrl] = useState('')
    const [message, setMessage] = useState('')
    const [uploading, setUploading] = useState(false)
    const [tokenValue, setTokenValue] = useState(0.05)

    // ===== DAILY REWARDS STATE =====
    const [dailyRewards, setDailyRewards] = useState({})
    const [dailyLoading, setDailyLoading] = useState(true)
    const [dailySaving, setDailySaving] = useState(null)
    const [dailyMessage, setDailyMessage] = useState('')

    // ===== QUEUE STATE =====
    const [queueData, setQueueData] = useState({})
    const [queueLoading, setQueueLoading] = useState(true)
    const [selectedQueueWeek, setSelectedQueueWeek] = useState(null)
    const [queueWarnings, setQueueWarnings] = useState([])

    // ===== LOAD TOKEN VALUE =====
    const loadTokenValue = async () => {
        try {
            const { data } = await supabase
                .from('economy_settings')
                .select('setting_value')
                .eq('setting_key', 'token_value')
                .single()
            if (data) setTokenValue(parseFloat(data.setting_value) || 0.05)
        } catch (error) {
            console.log('Using default token value')
        }
    }

    // ===== INITIAL LOAD =====
    useEffect(() => {
        loadTokenValue()
        if (activeTab === 'weekly') {
            loadCurrentPrize()
        } else if (activeTab === 'daily') {
            loadDailyRewards()
        } else if (activeTab === 'queue') {
            loadQueueData()
        }
    }, [activeTab, selectedGame])

    // ===== DATE HELPERS =====
    const getWeekStart = (offset = 0) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek + (offset * 7))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart.toISOString().split('T')[0]
    }

    const getWeekEnd = (weekStartStr) => {
        const weekStart = new Date(weekStartStr + 'T00:00:00')
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return weekEnd
    }

    const formatWeekRange = (weekStartStr) => {
        const weekStart = new Date(weekStartStr + 'T00:00:00')
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`
    }

    const getWeekLabel = (offset) => {
        if (offset === 0) return 'THIS WEEK'
        if (offset === 1) return 'NEXT WEEK'
        return `${offset} WEEKS OUT`
    }

    // ===== LOAD CURRENT PRIZE (Weekly Tab) =====
    const loadCurrentPrize = async () => {
        setLoading(true)
        try {
            const weekStart = getWeekStart()
            const { data, error } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart)
                .eq('game_type', selectedGame)
                .maybeSingle()

            if (data) {
                setCurrentPrize(data)
                setPrizeType(data.prize_type || 'cash')
                setNumberOfWinners(data.number_of_winners || 1)
                setPrizeAmounts(data.prize_amounts || [''])
                setPrizeDescriptions(data.prize_descriptions || [''])
                setIsSurprise(data.is_surprise || false)
                setIsRecurring(data.is_recurring || false)
                setAnnouncementText(data.announcement_text || '')
                setCardBackImageUrl(data.card_back_image_url || '')
            } else {
                resetForm()
            }
        } catch (error) {
            console.error('Error loading prize:', error)
            resetForm()
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setCurrentPrize(null)
        setPrizeType('cash')
        setNumberOfWinners(1)
        setPrizeAmounts([''])
        setPrizeDescriptions([''])
        setIsSurprise(false)
        setIsRecurring(false)
        setAnnouncementText('')
        setCardBackImageUrl('')
    }

    // ===== LOAD DAILY REWARDS =====
    const loadDailyRewards = async () => {
        setDailyLoading(true)
        try {
            const { data, error } = await supabase
                .from('daily_leaderboard_config')
                .select('*')

            if (error && error.code === '42P01') {
                console.log('daily_leaderboard_config table not found - using defaults')
                const defaults = {}
                GAMES.forEach(game => {
                    defaults[game.key] = { ...DEFAULT_DAILY_REWARDS, game_key: game.key }
                })
                setDailyRewards(defaults)
            } else if (data) {
                const rewardsMap = {}
                GAMES.forEach(game => {
                    const existing = data.find(d => d.game_key === game.key)
                    rewardsMap[game.key] = existing || { ...DEFAULT_DAILY_REWARDS, game_key: game.key }
                })
                setDailyRewards(rewardsMap)
            }
        } catch (error) {
            console.error('Error loading daily rewards:', error)
        } finally {
            setDailyLoading(false)
        }
    }

    // ===== SAVE DAILY REWARD =====
    const saveDailyReward = async (gameKey) => {
        setDailySaving(gameKey)
        setDailyMessage('')

        try {
            const reward = dailyRewards[gameKey]

            const { data: existing } = await supabase
                .from('daily_leaderboard_config')
                .select('id')
                .eq('game_key', gameKey)
                .maybeSingle()

            if (existing) {
                await supabase
                    .from('daily_leaderboard_config')
                    .update({
                        first_tokens: reward.first_tokens,
                        first_entries: reward.first_entries,
                        second_tokens: reward.second_tokens,
                        second_entries: reward.second_entries,
                        third_tokens: reward.third_tokens,
                        third_entries: reward.third_entries,
                        min_plays: reward.min_plays,
                        is_enabled: reward.is_enabled,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
            } else {
                await supabase
                    .from('daily_leaderboard_config')
                    .insert([{
                        game_key: gameKey,
                        first_tokens: reward.first_tokens,
                        first_entries: reward.first_entries,
                        second_tokens: reward.second_tokens,
                        second_entries: reward.second_entries,
                        third_tokens: reward.third_tokens,
                        third_entries: reward.third_entries,
                        min_plays: reward.min_plays,
                        is_enabled: reward.is_enabled
                    }])
            }

            setDailyMessage(`${GAMES.find(g => g.key === gameKey)?.label} rewards saved!`)
            setTimeout(() => setDailyMessage(''), 3000)
        } catch (error) {
            console.error('Error saving daily reward:', error)
            setDailyMessage('Error saving rewards')
        } finally {
            setDailySaving(null)
        }
    }

    // ===== UPDATE DAILY REWARD FIELD =====
    const updateDailyReward = (gameKey, field, value) => {
        setDailyRewards(prev => ({
            ...prev,
            [gameKey]: {
                ...prev[gameKey],
                [field]: value
            }
        }))
    }

    // ===== LOAD QUEUE DATA =====
    const loadQueueData = async () => {
        setQueueLoading(true)
        try {
            const weeks = []
            for (let i = 0; i < 8; i++) {
                weeks.push(getWeekStart(i))
            }

            const { data, error } = await supabase
                .from('weekly_prizes')
                .select('*')
                .in('week_start', weeks)
                .in('game_type', GAMES.map(g => g.key))

            if (error) throw error

            const organized = {}
            GAMES.forEach(game => {
                organized[game.key] = {}
                weeks.forEach(week => {
                    const prize = data?.find(d => d.game_type === game.key && d.week_start === week)
                    organized[game.key][week] = prize || null
                })
            })

            setQueueData(organized)

            const warnings = []
            GAMES.forEach(game => {
                weeks.slice(0, 4).forEach((week, index) => {
                    if (!organized[game.key][week]) {
                        warnings.push({
                            game: game.label,
                            week: formatWeekRange(week),
                            weekStart: week,
                            gameKey: game.key
                        })
                    }
                })
            })
            setQueueWarnings(warnings)

        } catch (error) {
            console.error('Error loading queue:', error)
        } finally {
            setQueueLoading(false)
        }
    }

    // ===== WEEKLY PRIZE HANDLERS =====
    const handleNumberOfWinnersChange = (num) => {
        setNumberOfWinners(num)
        const newAmounts = [...prizeAmounts]
        const newDescriptions = [...prizeDescriptions]
        while (newAmounts.length < num) {
            newAmounts.push('')
            newDescriptions.push('')
        }
        while (newAmounts.length > num) {
            newAmounts.pop()
            newDescriptions.pop()
        }
        setPrizeAmounts(newAmounts)
        setPrizeDescriptions(newDescriptions)
    }

    const handleAmountChange = (index, value) => {
        const newAmounts = [...prizeAmounts]
        newAmounts[index] = value
        setPrizeAmounts(newAmounts)
    }

    const handleDescriptionChange = (index, value) => {
        const newDescriptions = [...prizeDescriptions]
        newDescriptions[index] = value
        setPrizeDescriptions(newDescriptions)
    }

    const calculateTotal = () => {
        if (prizeType !== 'cash' && prizeType !== 'tokens') return 0
        return prizeAmounts.reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `card-back-${Date.now()}.${fileExt}`
            const filePath = `card-backs/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('game-assets')
                .upload(filePath, file)

            if (uploadError) {
                if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                    setMessage('Please create a storage bucket named "game-assets" in Supabase first.')
                    return
                }
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage
                .from('game-assets')
                .getPublicUrl(filePath)

            setCardBackImageUrl(publicUrl)
            setMessage('Image uploaded successfully!')
        } catch (error) {
            console.error('Error uploading image:', error)
            setMessage('Error uploading image.')
        } finally {
            setUploading(false)
        }
    }

    const savePrize = async (weekStart = null, gameType = null) => {
        setSaving(true)
        setMessage('')

        try {
            const targetWeek = weekStart || getWeekStart()
            const targetGame = gameType || selectedGame
            const weekEnd = getWeekEnd(targetWeek)

            const prizeData = {
                week_start: targetWeek,
                game_type: targetGame,
                prize_type: prizeType,
                number_of_winners: numberOfWinners,
                prize_amounts: prizeAmounts.map(a => parseFloat(a) || 0),
                prize_descriptions: prizeDescriptions,
                total_prize_pool: calculateTotal(),
                is_surprise: isSurprise,
                is_recurring: isRecurring,
                week_end_time: weekEnd.toISOString(),
                announcement_text: announcementText,
                card_back_image_url: cardBackImageUrl,
                is_active: true,
                updated_at: new Date().toISOString()
            }

            if (currentPrize && !weekStart) {
                await supabase
                    .from('weekly_prizes')
                    .update(prizeData)
                    .eq('id', currentPrize.id)
            } else {
                const { data: existing } = await supabase
                    .from('weekly_prizes')
                    .select('id')
                    .eq('week_start', targetWeek)
                    .eq('game_type', targetGame)
                    .maybeSingle()

                if (existing) {
                    await supabase
                        .from('weekly_prizes')
                        .update(prizeData)
                        .eq('id', existing.id)
                } else {
                    await supabase
                        .from('weekly_prizes')
                        .insert([prizeData])
                }
            }

            if (isRecurring) {
                for (let i = 1; i <= 4; i++) {
                    const futureWeek = getWeekStart(i)
                    const futureWeekEnd = getWeekEnd(futureWeek)

                    const { data: futureExisting } = await supabase
                        .from('weekly_prizes')
                        .select('id, is_recurring')
                        .eq('week_start', futureWeek)
                        .eq('game_type', targetGame)
                        .maybeSingle()

                    if (!futureExisting || futureExisting.is_recurring) {
                        const futureData = {
                            ...prizeData,
                            week_start: futureWeek,
                            week_end_time: futureWeekEnd.toISOString()
                        }

                        if (futureExisting) {
                            await supabase
                                .from('weekly_prizes')
                                .update(futureData)
                                .eq('id', futureExisting.id)
                        } else {
                            await supabase
                                .from('weekly_prizes')
                                .insert([futureData])
                        }
                    }
                }
            }

            setMessage('Prize settings saved successfully!')
            if (activeTab === 'queue') {
                loadQueueData()
                setSelectedQueueWeek(null)
            } else {
                loadCurrentPrize()
            }
        } catch (error) {
            console.error('Error saving prize:', error)
            setMessage('Error saving prize settings')
        } finally {
            setSaving(false)
        }
    }

    // ===== HELPERS =====
    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    const getGameLabel = (key) => GAMES.find(g => g.key === key)?.label || key
    const getGameColor = (key) => GAMES.find(g => g.key === key)?.color || 'gray'

    // ===== LOADING STATE =====
    if (loading && activeTab === 'weekly') {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    // ===== RENDER =====
    return (
        <div className="p-4">
            {/* ===== HEADER ===== */}
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>🏆 Prize Configuration</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Configure weekly prizes, daily rewards, and schedule future prizes</p>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('weekly')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'weekly'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    🎁 Weekly Prizes
                </button>
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'daily'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    📊 Daily Leaderboard Rewards
                </button>
                <button
                    onClick={() => setActiveTab('queue')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${activeTab === 'queue'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                        }`}
                >
                    📅 Prize Schedule
                    {queueWarnings.length > 0 && activeTab !== 'queue' && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            {queueWarnings.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ===== WEEKLY PRIZES TAB ===== */}
            {activeTab === 'weekly' && (
                <>
                    {/* Game Selector */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Select Game</label>
                        <div className="flex gap-2 flex-wrap">
                            {GAMES.map(game => (
                                <button
                                    key={game.key}
                                    onClick={() => setSelectedGame(game.key)}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${selectedGame === game.key
                                        ? `bg-${game.color}-500 text-white`
                                        : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                        }`}
                                >
                                    {game.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Current Week Info */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className={`text-sm font-bold text-${currentTheme.text}`}>Current Week - {getGameLabel(selectedGame)}</h2>
                            <span className={`px-2 py-0.5 bg-${currentTheme.accent}/20 text-${currentTheme.accent} rounded-full text-xs font-medium`}>
                                {formatWeekRange(getWeekStart())}
                            </span>
                        </div>
                        {!currentPrize && (
                            <p className="text-yellow-400 text-xs font-medium">
                                ⚠️ No prize set for {getGameLabel(selectedGame)} this week
                            </p>
                        )}
                    </div>

                    {/* Prize Configuration */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-3`}>Prize Configuration</h2>

                        {/* Prize Type */}
                        <div className="mb-3">
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                <Tooltip text={TIPS.prize_type}>Prize Type</Tooltip>
                            </label>
                            <div className="flex gap-1 flex-wrap">
                                {[
                                    { key: 'cash', label: '💵 Cash' },
                                    { key: 'merchandise', label: '🎽 Merch' },
                                    { key: 'tokens', label: '🪙 Tokens' },
                                    { key: 'custom', label: '✏️ Custom' }
                                ].map(type => (
                                    <button
                                        key={type.key}
                                        onClick={() => setPrizeType(type.key)}
                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === type.key
                                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                            : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Options Row */}
                        <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isSurprise}
                                    onChange={(e) => setIsSurprise(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className={`text-${currentTheme.textMuted} text-xs`}>🎁 Keep prize a surprise</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className={`text-${currentTheme.textMuted} text-xs`}>🔁 Repeat weekly until changed</span>
                            </label>
                        </div>

                        {/* Number of Winners */}
                        <div className="mb-3">
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                <Tooltip text={TIPS.number_of_winners}>Number of Winners</Tooltip>
                            </label>
                            <div className="flex gap-1 flex-wrap">
                                {[1, 2, 3, 5, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberOfWinnersChange(num)}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${numberOfWinners === num
                                            ? 'bg-green-500 text-white'
                                            : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        {num === 1 ? '1st only' : `Top ${num}`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Prize Amounts */}
                        <div className="mb-3">
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                <Tooltip text={TIPS.prize_amount}>
                                    {prizeType === 'cash' ? 'Prize Amounts' : prizeType === 'tokens' ? 'Token Amounts' : 'Prize Details'}
                                </Tooltip>
                            </label>
                            <div className="space-y-1.5">
                                {prizeAmounts.map((amount, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <span className={`w-12 text-xs font-medium ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : `text-${currentTheme.textMuted}`}`}>
                                            {getOrdinal(index + 1)}
                                        </span>
                                        {(prizeType === 'cash' || prizeType === 'tokens') && (
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-${currentTheme.textMuted} text-xs`}>
                                                        {prizeType === 'cash' ? '$' : '🪙'}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        value={amount}
                                                        onChange={(e) => handleAmountChange(index, e.target.value)}
                                                        placeholder="0"
                                                        className={`w-24 pl-5 pr-2 py-1 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                                    />
                                                </div>
                                                {prizeType === 'tokens' && parseFloat(amount) > 0 && (
                                                    <span className={`text-xs text-${currentTheme.textMuted}`}>
                                                        = <span className="text-green-400">${(parseFloat(amount) * tokenValue).toFixed(2)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {(prizeType === 'merchandise' || prizeType === 'custom') && (
                                            <input
                                                type="text"
                                                value={prizeDescriptions[index] || ''}
                                                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                                placeholder="Describe prize..."
                                                className={`flex-1 px-2 py-1 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            {prizeType === 'cash' && (
                                <div className={`mt-2 pt-2 border-t border-${currentTheme.border}`}>
                                    <span className={`text-xs text-${currentTheme.textMuted}`}>Total: </span>
                                    <span className="text-green-400 font-bold">${calculateTotal()}</span>
                                </div>
                            )}
                            {prizeType === 'tokens' && (
                                <div className={`mt-2 pt-2 border-t border-${currentTheme.border}`}>
                                    <span className={`text-xs text-${currentTheme.textMuted}`}>Total: </span>
                                    <span className="text-yellow-400 font-bold">{calculateTotal()} 🪙</span>
                                    <span className={`text-xs text-${currentTheme.textMuted} ml-2`}>
                                        (TOTAL IS WORTH <span className="text-green-400 font-medium">${(calculateTotal() * tokenValue).toFixed(2)}</span> at ${tokenValue}/token)
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Announcement Text */}
                        <div className="mb-3">
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>
                                <Tooltip text={TIPS.announcement_text}>Announcement Text (optional)</Tooltip>
                            </label>
                            <textarea
                                value={announcementText}
                                onChange={(e) => setAnnouncementText(e.target.value)}
                                placeholder="e.g., This week's grand prize!"
                                rows={2}
                                className={`w-full px-2 py-1.5 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none`}
                            />
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`mb-3 px-3 py-2 rounded text-xs ${message.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {message}
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={() => savePrize()}
                            disabled={saving}
                            className={`px-4 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-sm font-bold rounded hover:opacity-90 transition-all disabled:opacity-50`}
                        >
                            {saving ? 'Saving...' : currentPrize ? 'Update Prize' : 'Save Prize'}
                        </button>
                    </div>

                    {/* Preview */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>Preview (What Players See)</h2>
                        <div className={`bg-gradient-to-r from-${getGameColor(selectedGame)}-800 to-${getGameColor(selectedGame)}-900 border border-${getGameColor(selectedGame)}-700 rounded p-3 text-center`}>
                            <p className="text-white text-xs font-bold mb-1">🏆 This Week's Prize - {getGameLabel(selectedGame)} 🏆</p>
                            {isSurprise ? (
                                <p className="text-xl font-bold text-white">🎁 Surprise! 🎁</p>
                            ) : (
                                <>
                                    {prizeType === 'cash' && <p className="text-xl font-bold text-white">${calculateTotal()}</p>}
                                    {prizeType === 'tokens' && <p className="text-xl font-bold text-white">🪙 {calculateTotal()} Tokens</p>}
                                    {(prizeType === 'merchandise' || prizeType === 'custom') && (
                                        <div className="text-white">
                                            {prizeDescriptions.filter(d => d).map((d, i) => (
                                                <p key={i} className="text-sm">{getOrdinal(i + 1)}: {d}</p>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {announcementText && <p className="text-white/80 text-xs mt-2 italic">"{announcementText}"</p>}
                        </div>
                    </div>
                </>
            )}

            {/* ===== DAILY LEADERBOARD REWARDS TAB ===== */}
            {activeTab === 'daily' && (
                <>
                    {dailyLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-32 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                <h2 className={`text-sm font-bold text-${currentTheme.text} mb-1`}>Daily Leaderboard Rewards</h2>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>
                                    Configure tokens and drawing entries awarded to top 3 players each day. These are awarded automatically at midnight.
                                </p>
                            </div>

                            {dailyMessage && (
                                <div className={`mb-3 px-3 py-2 rounded text-xs ${dailyMessage.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {dailyMessage}
                                </div>
                            )}

                            {GAMES.map(game => {
                                const reward = dailyRewards[game.key] || DEFAULT_DAILY_REWARDS
                                const warnings = getDailyWarnings(reward)

                                return (
                                    <div key={game.key} className={`bg-${currentTheme.card} border rounded p-3 mb-3 ${warnings.length > 0 ? 'border-yellow-500/50' : `border-${currentTheme.border}`}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 bg-${game.color}-500/20 text-${game.color}-400 rounded text-xs font-medium`}>
                                                    {game.label}
                                                </span>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className={`text-${currentTheme.textMuted} text-xs`}>Enabled</span>
                                                <input
                                                    type="checkbox"
                                                    checked={reward.is_enabled}
                                                    onChange={(e) => updateDailyReward(game.key, 'is_enabled', e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                            </label>
                                        </div>

                                        {/* Warnings Banner */}
                                        {warnings.length > 0 && (
                                            <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                                <p className="text-yellow-400 text-xs font-medium mb-1">⚠️ Suggestions:</p>
                                                <ul className="text-yellow-300/80 text-xs space-y-0.5">
                                                    {warnings.map((w, i) => (
                                                        <li key={i}>• {w.message}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                            {/* 1st Place */}
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className="text-yellow-400 text-xs font-bold mb-2">🥇 1st Place</p>
                                                <div className="space-y-1">
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.tokens}>Tokens</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.first_tokens}
                                                            onChange={(e) => updateDailyReward(game.key, 'first_tokens', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.entries}>Entries</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.first_entries}
                                                            onChange={(e) => updateDailyReward(game.key, 'first_entries', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2nd Place */}
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className="text-gray-400 text-xs font-bold mb-2">🥈 2nd Place</p>
                                                <div className="space-y-1">
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.tokens}>Tokens</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.second_tokens}
                                                            onChange={(e) => updateDailyReward(game.key, 'second_tokens', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.entries}>Entries</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.second_entries}
                                                            onChange={(e) => updateDailyReward(game.key, 'second_entries', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 3rd Place */}
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className="text-amber-600 text-xs font-bold mb-2">🥉 3rd Place</p>
                                                <div className="space-y-1">
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.tokens}>Tokens</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.third_tokens}
                                                            onChange={(e) => updateDailyReward(game.key, 'third_tokens', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                            <Tooltip text={TIPS.entries}>Entries</Tooltip>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={reward.third_entries}
                                                            onChange={(e) => updateDailyReward(game.key, 'third_entries', parseInt(e.target.value) || 0)}
                                                            className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Min Plays */}
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className={`text-${currentTheme.text} text-xs font-bold mb-2`}>⚙️ Settings</p>
                                                <div>
                                                    <label className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                        <Tooltip text={TIPS.min_plays}>Min Plays to Qualify</Tooltip>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={reward.min_plays}
                                                        onChange={(e) => updateDailyReward(game.key, 'min_plays', parseInt(e.target.value) || 0)}
                                                        className={`w-full px-2 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => saveDailyReward(game.key)}
                                            disabled={dailySaving === game.key}
                                            className={`px-4 py-1.5 bg-${game.color}-500 text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50`}
                                        >
                                            {dailySaving === game.key ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                )
                            })}
                        </>
                    )}
                </>
            )}

            {/* ===== PRIZE SCHEDULE TAB ===== */}
            {activeTab === 'queue' && (
                <>
                    {queueLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className={`h-32 bg-${currentTheme.card} rounded`}></div>
                        </div>
                    ) : (
                        <>
                            {/* Warnings Banner */}
                            {queueWarnings.length > 0 && (
                                <div className="mb-3 p-3 bg-red-500/20 border border-red-500 rounded-lg">
                                    <p className="text-red-400 font-bold text-sm mb-2">
                                        ⚠️ WARNING: {queueWarnings.length} empty prize slot{queueWarnings.length > 1 ? 's' : ''} in next 4 weeks
                                    </p>
                                    <ul className="text-red-300 text-xs space-y-1">
                                        {queueWarnings.map((warning, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <span>•</span>
                                                <span className="font-medium">{warning.game}:</span>
                                                <span>{warning.week}</span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedQueueWeek({ week: warning.weekStart, game: warning.gameKey })
                                                        setSelectedGame(warning.gameKey)
                                                        resetForm()
                                                    }}
                                                    className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-400"
                                                >
                                                    Set Now
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Schedule Grid */}
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-sm font-bold text-${currentTheme.text}`}>📅 Prize Schedule</h2>
                                    <Tooltip text={TIPS.queue_week} iconOnly />
                                </div>

                                {GAMES.map(game => (
                                    <div key={game.key} className="mb-4">
                                        <p className={`text-${game.color}-400 font-bold text-xs mb-2`}>{game.label}</p>
                                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                            {[0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
                                                const weekStart = getWeekStart(offset)
                                                const prize = queueData[game.key]?.[weekStart]
                                                const isEmpty = !prize
                                                const isRecurring = prize?.is_recurring
                                                const isSelected = selectedQueueWeek?.week === weekStart && selectedQueueWeek?.game === game.key

                                                return (
                                                    <button
                                                        key={offset}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedQueueWeek(null)
                                                            } else {
                                                                setSelectedQueueWeek({ week: weekStart, game: game.key })
                                                                setSelectedGame(game.key)
                                                                if (prize) {
                                                                    setCurrentPrize(prize)
                                                                    setPrizeType(prize.prize_type || 'cash')
                                                                    setNumberOfWinners(prize.number_of_winners || 1)
                                                                    setPrizeAmounts(prize.prize_amounts || [''])
                                                                    setPrizeDescriptions(prize.prize_descriptions || [''])
                                                                    setIsSurprise(prize.is_surprise || false)
                                                                    setIsRecurring(prize.is_recurring || false)
                                                                    setAnnouncementText(prize.announcement_text || '')
                                                                } else {
                                                                    resetForm()
                                                                }
                                                            }
                                                        }}
                                                        className={`p-2 rounded border-2 text-center transition-all ${isSelected
                                                            ? `border-${currentTheme.accent} bg-${currentTheme.accent}/20`
                                                            : isEmpty
                                                                ? `border-red-500/50 bg-red-500/10 hover:border-red-500`
                                                                : isRecurring
                                                                    ? `border-blue-500/50 bg-blue-500/10 hover:border-blue-500`
                                                                    : `border-green-500/50 bg-green-500/10 hover:border-green-500`
                                                            }`}
                                                    >
                                                        <p className={`text-[10px] text-${currentTheme.textMuted}`}>{formatWeekRange(weekStart)}</p>
                                                        <p className={`text-[9px] text-${currentTheme.textMuted} mb-1`}>{getWeekLabel(offset)}</p>
                                                        {isEmpty ? (
                                                            <p className="text-red-400 text-xs font-bold">⚠️ EMPTY</p>
                                                        ) : isRecurring ? (
                                                            <>
                                                                <p className="text-blue-400 text-[10px]">🔁 Repeat</p>
                                                                <p className="text-white text-xs font-bold">
                                                                    {prize.prize_type === 'cash' ? `$${prize.total_prize_pool}` : prize.prize_type === 'tokens' ? `🪙${prize.total_prize_pool}` : prize.prize_descriptions?.[0]?.substring(0, 10) || 'Prize'}
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-green-400 text-[10px]">✅ Set</p>
                                                                <p className="text-white text-xs font-bold">
                                                                    {prize.is_surprise ? '🎁' : prize.prize_type === 'cash' ? `$${prize.total_prize_pool}` : prize.prize_type === 'tokens' ? `🪙${prize.total_prize_pool}` : prize.prize_descriptions?.[0]?.substring(0, 10) || 'Prize'}
                                                                </p>
                                                            </>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Edit Selected Week */}
                            {selectedQueueWeek && (
                                <div className={`bg-${currentTheme.card} border-2 border-${currentTheme.accent} rounded p-3`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className={`text-sm font-bold text-${currentTheme.text}`}>
                                            Edit: {getGameLabel(selectedQueueWeek.game)} - {formatWeekRange(selectedQueueWeek.week)}
                                        </h3>
                                        <button
                                            onClick={() => setSelectedQueueWeek(null)}
                                            className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* Prize Type */}
                                    <div className="mb-3">
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                            <Tooltip text={TIPS.prize_type}>Prize Type</Tooltip>
                                        </label>
                                        <div className="flex gap-1 flex-wrap">
                                            {[
                                                { key: 'cash', label: '💵 Cash' },
                                                { key: 'merchandise', label: '🎽 Merch' },
                                                { key: 'tokens', label: '🪙 Tokens' },
                                                { key: 'custom', label: '✏️ Custom' }
                                            ].map(type => (
                                                <button
                                                    key={type.key}
                                                    onClick={() => setPrizeType(type.key)}
                                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === type.key
                                                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                                        : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                                        }`}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="flex gap-4 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isSurprise}
                                                onChange={(e) => setIsSurprise(e.target.checked)}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className={`text-${currentTheme.textMuted} text-xs`}>🎁 Surprise</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isRecurring}
                                                onChange={(e) => setIsRecurring(e.target.checked)}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className={`text-${currentTheme.textMuted} text-xs`}>🔁 Repeat weekly</span>
                                        </label>
                                    </div>

                                    {/* Winners */}
                                    <div className="mb-3">
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                            <Tooltip text={TIPS.number_of_winners}>Winners</Tooltip>
                                        </label>
                                        <div className="flex gap-1 flex-wrap">
                                            {[1, 2, 3, 5, 10].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => handleNumberOfWinnersChange(num)}
                                                    className={`px-2 py-1 rounded text-xs font-medium ${numberOfWinners === num ? 'bg-green-500 text-white' : `bg-${currentTheme.border} text-${currentTheme.textMuted}`}`}
                                                >
                                                    {num === 1 ? '1st' : `Top ${num}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Amounts */}
                                    <div className="mb-3">
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                            <Tooltip text={TIPS.prize_amount}>
                                                {prizeType === 'cash' ? 'Amounts' : prizeType === 'tokens' ? 'Tokens' : 'Details'}
                                            </Tooltip>
                                        </label>
                                        <div className="space-y-1">
                                            {prizeAmounts.map((amount, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <span className={`w-10 text-xs ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`}>
                                                        {getOrdinal(index + 1)}
                                                    </span>
                                                    {(prizeType === 'cash' || prizeType === 'tokens') ? (
                                                        <input
                                                            type="number"
                                                            value={amount}
                                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                                            placeholder="0"
                                                            className={`w-24 px-2 py-1 text-sm bg-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={prizeDescriptions[index] || ''}
                                                            onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                                            placeholder="Prize..."
                                                            className={`flex-1 px-2 py-1 text-sm bg-${currentTheme.border} rounded text-${currentTheme.text}`}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {prizeType === 'tokens' && (
                                            <div className={`mt-2 pt-2 border-t border-${currentTheme.border}`}>
                                                <span className={`text-xs text-${currentTheme.textMuted}`}>Total: </span>
                                                <span className="text-yellow-400 font-bold">{calculateTotal()} 🪙</span>
                                                <span className={`text-xs text-${currentTheme.textMuted} ml-2`}>
                                                    (worth <span className="text-green-400 font-medium">${(calculateTotal() * tokenValue).toFixed(2)}</span>)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {message && (
                                        <div className={`mb-3 px-3 py-2 rounded text-xs ${message.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {message}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => savePrize(selectedQueueWeek.week, selectedQueueWeek.game)}
                                        disabled={saving}
                                        className={`px-4 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-sm font-bold rounded hover:opacity-90 disabled:opacity-50`}
                                    >
                                        {saving ? 'Saving...' : 'Save Prize'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}
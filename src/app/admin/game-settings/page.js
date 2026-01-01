'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Tooltip from '@/components/Tooltip'

// ===== TOKEN SETTINGS PAGE =====
// Admin page to configure token rewards for each game

// ===== TOOLTIP CONTENT =====
const TIPS = {
    bb_award_chance: "Probability of earning tokens per play. 100 = always wins, 0 = never. Most games use 50-80%.",
    bb_min_amount: "Minimum tokens awarded when a player wins. Sets the floor for rewards.",
    bb_max_amount: "Maximum tokens awarded when a player wins. Range between min/max creates excitement.",
    daily_bb_cap: "Maximum tokens a user can earn from this game per day. Prevents abuse and controls inflation.",
    daily_play_cap: "Maximum plays allowed per day. Leave blank for unlimited plays.",
    free_plays_per_day: "Free plays given to each user daily. Only applies to slot machines.",
    win_percentage: "Return to player percentage. Higher = players win more often. 85-95% is typical for slots.",
    is_enabled: "Turn this game on or off. Disabled games won't award tokens."
}

// ===== WARNING THRESHOLDS =====
const getWarnings = (game) => {
    const warnings = []

    if (game.bb_award_chance !== null && game.bb_award_chance < 30) {
        warnings.push({ field: 'bb_award_chance', message: 'Low chance may feel unrewarding to players' })
    }

    if (game.daily_bb_cap !== null && game.daily_bb_cap > 500) {
        warnings.push({ field: 'daily_bb_cap', message: 'High cap could cause token inflation' })
    }

    if (game.bb_min_amount !== null && game.bb_max_amount !== null && game.bb_max_amount < game.bb_min_amount) {
        warnings.push({ field: 'bb_max_amount', message: 'Max should be ≥ Min tokens' })
    }

    if (game.free_plays_per_day !== null && game.free_plays_per_day > 10) {
        warnings.push({ field: 'free_plays_per_day', message: 'High free plays increases token giveaway' })
    }

    if (game.win_percentage !== null && game.win_percentage > 95) {
        warnings.push({ field: 'win_percentage', message: 'Very high RTP may not be sustainable' })
    }

    if (game.win_percentage !== null && game.win_percentage < 80) {
        warnings.push({ field: 'win_percentage', message: 'Low RTP may frustrate players' })
    }

    return warnings
}

export default function TokenSettingsPage() {
    // ===== STATE =====
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)
    const [expandedGame, setExpandedGame] = useState(null)

    useEffect(() => {
        loadGames()
    }, [])

    // ===== LOAD GAMES =====
    const loadGames = async () => {
        try {
            const { data, error } = await supabase
                .from('game_bb_settings')
                .select('*')
                .order('game_name')

            if (error) throw error
            setGames(data || [])
        } catch (error) {
            console.error('Error loading games:', error)
            setMessage({ type: 'error', text: 'Failed to load game settings' })
        } finally {
            setLoading(false)
        }
    }

    // ===== UPDATE GAME SETTING =====
    const updateGame = async (gameId, field, value) => {
        setSaving(gameId)
        setMessage(null)

        try {
            const { error } = await supabase
                .from('game_bb_settings')
                .update({
                    [field]: value,
                    updated_at: new Date().toISOString()
                })
                .eq('id', gameId)

            if (error) throw error

            setGames(games.map(g =>
                g.id === gameId ? { ...g, [field]: value } : g
            ))
            setMessage({ type: 'success', text: 'Setting updated!' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            console.error('Error updating game:', error)
            setMessage({ type: 'error', text: 'Failed to update setting' })
        } finally {
            setSaving(null)
        }
    }

    // ===== INPUT HANDLERS =====
    const handleInputChange = (gameId, field, value, isNumber = false) => {
        const newValue = isNumber ? (value === '' ? null : Number(value)) : value
        setGames(games.map(g =>
            g.id === gameId ? { ...g, [field]: newValue } : g
        ))
    }

    const handleBlur = (gameId, field, value, isNumber = false) => {
        const newValue = isNumber ? (value === '' ? null : Number(value)) : value
        updateGame(gameId, field, newValue)
    }

    // ===== HELPER: Check if field has warning =====
    const getFieldWarning = (game, field) => {
        const warnings = getWarnings(game)
        return warnings.find(w => w.field === field)
    }

    // ===== TOGGLE GAME EXPANSION =====
    const toggleGame = (gameId) => {
        setExpandedGame(expandedGame === gameId ? null : gameId)
    }

    // ===== LOADING STATE =====
    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    // ===== MAIN RENDER =====
    return (
        <div className="p-4">

            {/* ===== HEADER ===== */}
            <div className="mb-3">
                <h1 className="text-xl font-bold text-white">🪙 Game Token Settings</h1>
                <p className="text-slate-400 text-sm">Configure token rewards for each game. Click to expand.</p>
            </div>

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-3 p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* ===== GAME CARDS ===== */}
            <div className="space-y-1.5">
                {games.map(game => {
                    const warnings = getWarnings(game)
                    const isExpanded = expandedGame === game.id

                    return (
                        <div key={game.id} className={`bg-slate-800 border rounded-lg ${warnings.length > 0 ? 'border-yellow-500/50' : 'border-slate-700'}`}>

                            {/* ----- Game Header (Always Visible) ----- */}
                            <button
                                onClick={() => toggleGame(game.id)}
                                className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-700/30 transition-colors rounded-lg"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg ${isExpanded ? '' : 'grayscale opacity-50'}`}>
                                        {game.game_key.includes('slot') ? '🎰' :
                                            game.game_key.includes('card_gallery') ? '🎴' :
                                                game.game_key.includes('memory') || game.game_key.includes('match') ? '🃏' :
                                                    game.game_key.includes('solitaire') ? '🃏' : '🎮'}
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-semibold text-white">{game.game_name}</h2>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${game.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {game.is_enabled ? 'On' : 'Off'}
                                            </span>
                                            {warnings.length > 0 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                                    ⚠️ {warnings.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right text-xs">
                                        <p className="text-slate-400">Cap: <span className="text-white font-medium">{game.daily_bb_cap ?? '∞'}</span></p>
                                        <p className="text-slate-400">Award: <span className="text-white font-medium">{game.bb_award_chance ?? 0}%</span></p>
                                    </div>
                                    <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </div>
                            </button>

                            {/* ----- Expanded Settings ----- */}
                            {isExpanded && (
                                <div className="px-3 pb-3 border-t border-slate-700">

                                    {/* Enable Toggle */}
                                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                                        <div>
                                            <p className="text-white text-sm font-medium">Game Enabled</p>
                                            <p className="text-slate-500 text-[10px]">Turn this game on or off</p>
                                        </div>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={game.is_enabled}
                                                onChange={(e) => updateGame(game.id, 'is_enabled', e.target.checked)}
                                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                            />
                                        </label>
                                    </div>

                                    {/* ----- Warnings Banner ----- */}
                                    {warnings.length > 0 && (
                                        <div className="mt-2 p-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                            <p className="text-yellow-400 text-[10px] font-medium mb-0.5">⚠️ Suggestions:</p>
                                            <ul className="text-yellow-300/80 text-[10px] space-y-0.5">
                                                {warnings.map((w, i) => (
                                                    <li key={i}>• {w.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* ----- Token Settings Grid ----- */}
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.bb_award_chance}>Award %</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={game.bb_award_chance ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_award_chance', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_award_chance', e.target.value, true)}
                                                className={`w-full px-2 py-1 bg-slate-700 border rounded text-white text-xs focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'bb_award_chance') ? 'border-yellow-500/50' : 'border-slate-600'}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.bb_min_amount}>Min</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.bb_min_amount ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_min_amount', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_min_amount', e.target.value, true)}
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-yellow-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.bb_max_amount}>Max</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.bb_max_amount ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_max_amount', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_max_amount', e.target.value, true)}
                                                className={`w-full px-2 py-1 bg-slate-700 border rounded text-white text-xs focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'bb_max_amount') ? 'border-yellow-500/50' : 'border-slate-600'}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.daily_bb_cap}>Daily Cap</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.daily_bb_cap ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'daily_bb_cap', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'daily_bb_cap', e.target.value, true)}
                                                className={`w-full px-2 py-1 bg-slate-700 border rounded text-white text-xs focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'daily_bb_cap') ? 'border-yellow-500/50' : 'border-slate-600'}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.daily_play_cap}>Play Cap</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.daily_play_cap ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'daily_play_cap', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'daily_play_cap', e.target.value, true)}
                                                placeholder="∞"
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-yellow-500 placeholder-slate-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-[10px] mb-0.5">
                                                <Tooltip text={TIPS.free_plays_per_day}>Free/Day</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.free_plays_per_day ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'free_plays_per_day', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'free_plays_per_day', e.target.value, true)}
                                                placeholder="N/A"
                                                className={`w-full px-2 py-1 bg-slate-700 border rounded text-white text-xs focus:outline-none focus:border-yellow-500 placeholder-slate-500 ${getFieldWarning(game, 'free_plays_per_day') ? 'border-yellow-500/50' : 'border-slate-600'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* ----- Slot Machine Extra Settings ----- */}
                                    {game.game_key.includes('slot_machine') && (
                                        <div className="mt-2 pt-2 border-t border-slate-700">
                                            <p className="text-slate-400 text-[10px] mb-1 font-medium">Slot Machine Settings</p>
                                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                                <div>
                                                    <label className="block text-slate-400 text-[10px] mb-0.5">
                                                        <Tooltip text={TIPS.win_percentage}>Win % (RTP)</Tooltip>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        value={game.win_percentage ?? ''}
                                                        onChange={(e) => handleInputChange(game.id, 'win_percentage', e.target.value, true)}
                                                        onBlur={(e) => handleBlur(game.id, 'win_percentage', e.target.value, true)}
                                                        className={`w-full px-2 py-1 bg-slate-700 border rounded text-white text-xs focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'win_percentage') ? 'border-yellow-500/50' : 'border-slate-600'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {saving === game.id && (
                                        <div className="mt-1 text-yellow-500 text-xs">Saving...</div>
                                    )}

                                    <p className="text-slate-500 text-[10px] mt-2">Key: {game.game_key}</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
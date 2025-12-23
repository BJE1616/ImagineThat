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
            <div className="p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    // ===== MAIN RENDER =====
    return (
        <div className="p-6">

            {/* ===== HEADER ===== */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">🪙 Game Token Settings</h1>
                <p className="text-slate-400 mt-1">Configure token rewards for each game. Click a game to expand settings.</p>
            </div>

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* ===== GAME CARDS ===== */}
            <div className="space-y-2">
                {games.map(game => {
                    const warnings = getWarnings(game)
                    const isExpanded = expandedGame === game.id

                    return (
                        <div key={game.id} className={`bg-slate-800 border rounded-lg ${warnings.length > 0 ? 'border-yellow-500/50' : 'border-slate-700'}`}>

                            {/* ----- Game Header (Always Visible) ----- */}
                            <button
                                onClick={() => toggleGame(game.id)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-2xl ${isExpanded ? '' : 'grayscale opacity-50'}`}>
                                        {game.game_key.includes('slot') ? '🎰' :
                                            game.game_key.includes('card_gallery') ? '🎴' :
                                                game.game_key.includes('memory') || game.game_key.includes('match') ? '🃏' :
                                                    game.game_key.includes('solitaire') ? '🃏' : '🎮'}
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">{game.game_name}</h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-xs px-2 py-0.5 rounded ${game.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {game.is_enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            {warnings.length > 0 && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                                    ⚠️ {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right text-sm">
                                        <p className="text-slate-400">Daily Cap: <span className="text-white font-medium">{game.daily_bb_cap ?? '∞'}</span></p>
                                        <p className="text-slate-400">Award: <span className="text-white font-medium">{game.bb_award_chance ?? 0}%</span></p>
                                    </div>
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </div>
                            </button>

                            {/* ----- Expanded Settings ----- */}
                            {isExpanded && (
                                <div className="px-4 pb-4 border-t border-slate-700">

                                    {/* Enable Toggle */}
                                    <div className="flex items-center justify-between py-3 border-b border-slate-700">
                                        <div>
                                            <p className="text-white font-medium">Game Enabled</p>
                                            <p className="text-slate-500 text-xs">Turn this game on or off</p>
                                        </div>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={game.is_enabled}
                                                onChange={(e) => updateGame(game.id, 'is_enabled', e.target.checked)}
                                                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                            />
                                        </label>
                                    </div>

                                    {/* ----- Warnings Banner ----- */}
                                    {warnings.length > 0 && (
                                        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                            <p className="text-yellow-400 text-xs font-medium mb-1">⚠️ Suggestions:</p>
                                            <ul className="text-yellow-300/80 text-xs space-y-0.5">
                                                {warnings.map((w, i) => (
                                                    <li key={i}>• {w.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* ----- Token Settings Grid ----- */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.bb_award_chance}>Award Chance %</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={game.bb_award_chance ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_award_chance', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_award_chance', e.target.value, true)}
                                                className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'bb_award_chance') ? 'border-yellow-500/50' : 'border-slate-600'
                                                    }`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.bb_min_amount}>Min Tokens</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.bb_min_amount ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_min_amount', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_min_amount', e.target.value, true)}
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.bb_max_amount}>Max Tokens</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.bb_max_amount ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'bb_max_amount', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'bb_max_amount', e.target.value, true)}
                                                className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'bb_max_amount') ? 'border-yellow-500/50' : 'border-slate-600'
                                                    }`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.daily_bb_cap}>Daily Token Cap</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.daily_bb_cap ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'daily_bb_cap', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'daily_bb_cap', e.target.value, true)}
                                                className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'daily_bb_cap') ? 'border-yellow-500/50' : 'border-slate-600'
                                                    }`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.daily_play_cap}>Daily Play Cap</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.daily_play_cap ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'daily_play_cap', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'daily_play_cap', e.target.value, true)}
                                                placeholder="No limit"
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500 placeholder-slate-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">
                                                <Tooltip text={TIPS.free_plays_per_day}>Free Plays/Day</Tooltip>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={game.free_plays_per_day ?? ''}
                                                onChange={(e) => handleInputChange(game.id, 'free_plays_per_day', e.target.value, true)}
                                                onBlur={(e) => handleBlur(game.id, 'free_plays_per_day', e.target.value, true)}
                                                placeholder="N/A"
                                                className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm focus:outline-none focus:border-yellow-500 placeholder-slate-500 ${getFieldWarning(game, 'free_plays_per_day') ? 'border-yellow-500/50' : 'border-slate-600'
                                                    }`}
                                            />
                                        </div>
                                    </div>

                                    {/* ----- Slot Machine Extra Settings ----- */}
                                    {game.game_key.includes('slot_machine') && (
                                        <div className="mt-4 pt-4 border-t border-slate-700">
                                            <p className="text-slate-400 text-xs mb-2 font-medium">Slot Machine Settings</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="block text-slate-400 text-xs mb-1">
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
                                                        className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm focus:outline-none focus:border-yellow-500 ${getFieldWarning(game, 'win_percentage') ? 'border-yellow-500/50' : 'border-slate-600'
                                                            }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {saving === game.id && (
                                        <div className="mt-2 text-yellow-500 text-sm">Saving...</div>
                                    )}

                                    <p className="text-slate-500 text-xs mt-3">Game Key: {game.game_key}</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
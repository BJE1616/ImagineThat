'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== TOKEN SETTINGS PAGE =====
// Admin page to configure token rewards for each game

export default function TokenSettingsPage() {
    // ===== STATE =====
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)

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
                <h1 className="text-2xl font-bold text-white">🪙 Token Settings</h1>
                <p className="text-slate-400 mt-1">Configure Token rewards for each game</p>
            </div>

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* ===== GAME CARDS ===== */}
            <div className="space-y-4">
                {games.map(game => (
                    <div key={game.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">

                        {/* ----- Game Header ----- */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white">{game.game_name}</h2>
                                <p className="text-slate-500 text-sm">Key: {game.game_key}</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-slate-400 text-sm">Enabled</span>
                                <input
                                    type="checkbox"
                                    checked={game.is_enabled}
                                    onChange={(e) => updateGame(game.id, 'is_enabled', e.target.checked)}
                                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                />
                            </label>
                        </div>

                        {/* ----- Token Settings Grid ----- */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Award Chance %</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={game.bb_award_chance ?? ''}
                                    onChange={(e) => handleInputChange(game.id, 'bb_award_chance', e.target.value, true)}
                                    onBlur={(e) => handleBlur(game.id, 'bb_award_chance', e.target.value, true)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Min Tokens</label>
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
                                <label className="block text-slate-400 text-xs mb-1">Max Tokens</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={game.bb_max_amount ?? ''}
                                    onChange={(e) => handleInputChange(game.id, 'bb_max_amount', e.target.value, true)}
                                    onBlur={(e) => handleBlur(game.id, 'bb_max_amount', e.target.value, true)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Daily Token Cap</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={game.daily_bb_cap ?? ''}
                                    onChange={(e) => handleInputChange(game.id, 'daily_bb_cap', e.target.value, true)}
                                    onBlur={(e) => handleBlur(game.id, 'daily_bb_cap', e.target.value, true)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Daily Play Cap</label>
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
                                <label className="block text-slate-400 text-xs mb-1">Free Plays/Day</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={game.free_plays_per_day ?? ''}
                                    onChange={(e) => handleInputChange(game.id, 'free_plays_per_day', e.target.value, true)}
                                    onBlur={(e) => handleBlur(game.id, 'free_plays_per_day', e.target.value, true)}
                                    placeholder="N/A"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500 placeholder-slate-500"
                                />
                            </div>
                        </div>

                        {/* ----- Slot Machine Extra Settings ----- */}
                        {game.game_key.includes('slot_machine') && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-slate-400 text-xs mb-1">Win % (RTP)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={game.win_percentage ?? ''}
                                            onChange={(e) => handleInputChange(game.id, 'win_percentage', e.target.value, true)}
                                            onBlur={(e) => handleBlur(game.id, 'win_percentage', e.target.value, true)}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-yellow-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {saving === game.id && (
                            <div className="mt-2 text-yellow-500 text-sm">Saving...</div>
                        )}
                    </div>
                ))}
            </div>

            {/* ===== SETTINGS GUIDE ===== */}
            <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">📖 Settings Guide</h3>
                <div className="text-slate-400 text-sm space-y-1">
                    <p><strong>Award Chance %:</strong> Probability of earning Tokens per play (100 = always)</p>
                    <p><strong>Min/Max Tokens:</strong> Range of Tokens awarded when won</p>
                    <p><strong>Daily Token Cap:</strong> Max Tokens a user can earn from this game per day</p>
                    <p><strong>Daily Play Cap:</strong> Max plays allowed per day (blank = unlimited)</p>
                    <p><strong>Free Plays/Day:</strong> Free plays given daily (slot machines)</p>
                    <p><strong>Win % (RTP):</strong> Return to player percentage (slot machines)</p>
                </div>
            </div>
        </div>
    )
}
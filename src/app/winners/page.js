'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function WinnersPage() {
    const { currentTheme } = useTheme()
    const [winners, setWinners] = useState([])
    const [featuredWinners, setFeaturedWinners] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadWinners()
    }, [])

    const loadWinners = async () => {
        try {
            const { data, error } = await supabase
                .from('public_winners')
                .select('*')
                .eq('is_visible', true)
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('verified_at', { ascending: false })

            if (error) throw error

            const featured = (data || []).filter(w => w.is_featured)
            const regular = (data || []).filter(w => !w.is_featured)

            setFeaturedWinners(featured)
            setWinners(regular)
        } catch (err) {
            console.error('Error loading winners:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getGameIcon = (gameType) => {
        switch (gameType) {
            case 'slots': return '🎰'
            case 'match': return '🃏'
            case 'contest': return '🏅'
            case 'referral': return '🤝'
            default: return '🎉'
        }
    }

    const isRecent = (dateStr) => {
        if (!dateStr) return false
        const diffDays = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
        return diffDays <= 7
    }

    if (loading) {
        return (
            <div className={`min-h-[calc(100vh-48px)] bg-${currentTheme.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="text-4xl mb-3 animate-bounce">🏆</div>
                    <p className={`text-${currentTheme.textMuted}`}>Loading winners...</p>
                </div>
            </div>
        )
    }

    const noWinners = featuredWinners.length === 0 && winners.length === 0

    return (
        <div className={`min-h-[calc(100vh-48px)] bg-${currentTheme.bg} py-8 px-4`}>
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className={`text-3xl font-bold text-${currentTheme.text} mb-2`}>
                        🏆 Winners Circle
                    </h1>
                    <p className={`text-${currentTheme.textMuted}`}>
                        Congratulations to all our lucky winners!
                    </p>
                </div>

                {noWinners ? (
                    <div className={`text-center py-16 rounded-lg bg-${currentTheme.card} border border-${currentTheme.border}`}>
                        <div className="text-5xl mb-4">🎯</div>
                        <h2 className={`text-xl font-semibold text-${currentTheme.text} mb-2`}>No Winners Yet</h2>
                        <p className={`text-${currentTheme.textMuted}`}>
                            Be the first! Play our games for a chance to win.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Featured Winners */}
                        {featuredWinners.length > 0 && (
                            <div className="mb-8">
                                <h2 className={`text-lg font-semibold text-${currentTheme.text} mb-3 flex items-center gap-2`}>
                                    <span>⭐</span> Featured Winners
                                </h2>
                                <div className="space-y-3">
                                    {featuredWinners.map((winner) => (
                                        <div
                                            key={winner.id}
                                            className="relative p-4 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30"
                                        >
                                            {isRecent(winner.verified_at) && (
                                                <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                                                    NEW
                                                </span>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <div className="text-3xl">{getGameIcon(winner.game_type)}</div>
                                                <div className="flex-1">
                                                    <div className={`font-bold text-lg text-${currentTheme.text}`}>
                                                        {winner.display_name}
                                                    </div>
                                                    <div className="text-yellow-400 font-medium">
                                                        {winner.display_text}
                                                    </div>
                                                    <div className={`text-xs text-${currentTheme.textMuted} mt-1`}>
                                                        {formatDate(winner.week_start)}
                                                    </div>
                                                </div>
                                                <div className="text-4xl">🏆</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Regular Winners */}
                        {winners.length > 0 && (
                            <div>
                                {featuredWinners.length > 0 && (
                                    <h2 className={`text-lg font-semibold text-${currentTheme.text} mb-3`}>
                                        All Winners
                                    </h2>
                                )}
                                <div className="space-y-2">
                                    {winners.map((winner) => (
                                        <div
                                            key={winner.id}
                                            className={`relative p-3 rounded-lg bg-${currentTheme.card} border border-${currentTheme.border} hover:border-${currentTheme.accent}/50 transition-colors`}
                                        >
                                            {isRecent(winner.verified_at) && (
                                                <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded-full">
                                                    NEW
                                                </span>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <div className="text-2xl">{getGameIcon(winner.game_type)}</div>
                                                <div className="flex-1">
                                                    <div className={`font-semibold text-${currentTheme.text}`}>
                                                        {winner.display_name}
                                                    </div>
                                                    <div className={`text-sm text-${currentTheme.accent}`}>
                                                        {winner.display_text}
                                                    </div>
                                                </div>
                                                <div className={`text-xs text-${currentTheme.textMuted} text-right`}>
                                                    {formatDate(winner.week_start)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* CTA */}
                <div className="mt-10 text-center">
                    <p className={`text-${currentTheme.textMuted} mb-3`}>
                        Want to see your name here?
                    </p>

                    href="/slots"
                    className={`inline-block px-6 py-2 bg-${currentTheme.accent} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}
                    >
                    Play Now 🎰
                </a>
            </div>
        </div>
        </div >
    )
}
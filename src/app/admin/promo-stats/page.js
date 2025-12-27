'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminPromoStatsPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [promoCards, setPromoCards] = useState([])
    const [stats, setStats] = useState({
        totalViews: 0,
        totalClicks: 0,
        totalCtaClicks: 0,
        byGame: {},
        byCard: {}
    })
    const [timeRange, setTimeRange] = useState('week') // 'day', 'week', 'month', 'year', 'all'
    const [selectedCard, setSelectedCard] = useState('all')

    useEffect(() => {
        loadPromoCards()
    }, [])

    useEffect(() => {
        if (promoCards.length >= 0) {
            loadStats()
        }
    }, [timeRange, selectedCard, promoCards])

    const loadPromoCards = async () => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('id, title, display_name, has_popup')
                .eq('is_house_card', true)
                .order('created_at', { ascending: false })

            if (error) throw error
            setPromoCards(data || [])
        } catch (error) {
            console.error('Error loading promo cards:', error)
        }
    }

    const getDateFilter = () => {
        const now = new Date()
        switch (timeRange) {
            case 'day':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                return today.toISOString()
            case 'week':
                const weekAgo = new Date(now)
                weekAgo.setDate(weekAgo.getDate() - 7)
                return weekAgo.toISOString()
            case 'month':
                const monthAgo = new Date(now)
                monthAgo.setMonth(monthAgo.getMonth() - 1)
                return monthAgo.toISOString()
            case 'year':
                const yearAgo = new Date(now)
                yearAgo.setFullYear(yearAgo.getFullYear() - 1)
                return yearAgo.toISOString()
            case 'all':
            default:
                return null
        }
    }

    const loadStats = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('promo_card_views')
                .select('*')

            // Time filter
            const dateFilter = getDateFilter()
            if (dateFilter) {
                query = query.gte('created_at', dateFilter)
            }

            // Card filter
            if (selectedCard !== 'all') {
                query = query.eq('promo_card_id', selectedCard)
            }

            const { data, error } = await query

            if (error) throw error

            // Calculate stats
            const views = data || []

            const totalViews = views.filter(v => v.view_type === 'game_display').length
            const totalClicks = views.filter(v => v.view_type === 'eyeball_click').length
            const totalCtaClicks = views.filter(v => v.view_type === 'cta_click').length

            // By game
            const byGame = {}
            views.forEach(v => {
                const game = v.game_type || 'unknown'
                if (!byGame[game]) {
                    byGame[game] = { views: 0, clicks: 0, ctaClicks: 0 }
                }
                if (v.view_type === 'game_display') byGame[game].views++
                if (v.view_type === 'eyeball_click') byGame[game].clicks++
                if (v.view_type === 'cta_click') byGame[game].ctaClicks++
            })

            // By card
            const byCard = {}
            views.forEach(v => {
                const cardId = v.promo_card_id
                if (!byCard[cardId]) {
                    byCard[cardId] = { views: 0, clicks: 0, ctaClicks: 0 }
                }
                if (v.view_type === 'game_display') byCard[cardId].views++
                if (v.view_type === 'eyeball_click') byCard[cardId].clicks++
                if (v.view_type === 'cta_click') byCard[cardId].ctaClicks++
            })

            setStats({
                totalViews,
                totalClicks,
                totalCtaClicks,
                byGame,
                byCard
            })

        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getCardName = (cardId) => {
        const card = promoCards.find(c => c.id === cardId)
        return card?.display_name || card?.title || 'Unknown Card'
    }

    const getClickRate = (clicks, views) => {
        if (views === 0) return '0%'
        return ((clicks / views) * 100).toFixed(1) + '%'
    }

    const getGameIcon = (game) => {
        const icons = {
            slots: '🎰',
            solitaire: '🃏',
            memory: '🧠',
            card_gallery: '🖼️',
            unknown: '❓'
        }
        return icons[game] || '🎮'
    }

    const getGameLabel = (game) => {
        const labels = {
            slots: 'Slots',
            solitaire: 'Solitaire',
            memory: 'Memory',
            card_gallery: 'Card Gallery',
            unknown: 'Unknown'
        }
        return labels[game] || game
    }

    const timeRangeOptions = [
        { value: 'day', label: 'Today' },
        { value: 'week', label: 'Last 7 Days' },
        { value: 'month', label: 'Last 30 Days' },
        { value: 'year', label: 'Last Year' },
        { value: 'all', label: 'All Time' }
    ]

    // Sort cards by total engagement
    const sortedCardStats = Object.entries(stats.byCard)
        .map(([cardId, data]) => ({
            cardId,
            ...data,
            total: data.views + data.clicks + data.ctaClicks
        }))
        .sort((a, b) => b.total - a.total)

    // Sort games by total engagement
    const sortedGameStats = Object.entries(stats.byGame)
        .map(([game, data]) => ({
            game,
            ...data,
            total: data.views + data.clicks + data.ctaClicks
        }))
        .sort((a, b) => b.total - a.total)

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className={`text-lg font-bold text-${currentTheme.text}`}>📊 Promo Card Stats</h1>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Track views and engagement on your promotional cards</p>
                </div>
            </div>

            {/* Filters */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-4`}>
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Time Range */}
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Time Range</label>
                        <div className="flex gap-1">
                            {timeRangeOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTimeRange(opt.value)}
                                    className={`px-3 py-1 text-xs rounded transition-all ${timeRange === opt.value
                                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold`
                                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:text-${currentTheme.text}`
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Card Filter */}
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Filter by Card</label>
                        <select
                            value={selectedCard}
                            onChange={(e) => setSelectedCard(e.target.value)}
                            className={`px-3 py-1 text-sm bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                        >
                            <option value="all">All Cards</option>
                            {promoCards.map(card => (
                                <option key={card.id} value={card.id}>
                                    {card.display_name || card.title}
                                    {card.has_popup ? ' 💬' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh */}
                    <div className="ml-auto">
                        <button
                            onClick={loadStats}
                            disabled={loading}
                            className={`px-3 py-1 text-sm bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-medium rounded hover:opacity-90 disabled:opacity-50`}
                        >
                            {loading ? '...' : '🔄 Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Impressions</p>
                    <p className={`text-2xl font-bold text-${currentTheme.text}`}>
                        {loading ? '...' : stats.totalViews.toLocaleString()}
                    </p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Card shown in games</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Eyeball Clicks</p>
                    <p className="text-2xl font-bold text-purple-400">
                        {loading ? '...' : stats.totalClicks.toLocaleString()}
                    </p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>
                        Click rate: {getClickRate(stats.totalClicks, stats.totalViews)}
                    </p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>CTA Clicks</p>
                    <p className="text-2xl font-bold text-green-400">
                        {loading ? '...' : stats.totalCtaClicks.toLocaleString()}
                    </p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>
                        Button clicks in popups
                    </p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Engagement</p>
                    <p className={`text-2xl font-bold text-${currentTheme.accent}`}>
                        {loading ? '...' : (stats.totalClicks + stats.totalCtaClicks).toLocaleString()}
                    </p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>
                        All interactions
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* By Game */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <h3 className={`text-${currentTheme.text} font-bold mb-3`}>📊 Performance by Game</h3>

                    {loading ? (
                        <div className="animate-pulse space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`h-12 bg-${currentTheme.border} rounded`}></div>
                            ))}
                        </div>
                    ) : sortedGameStats.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-4xl mb-2">📭</p>
                            <p className={`text-${currentTheme.textMuted}`}>No data yet</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Stats will appear once promo cards are shown in games</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedGameStats.map(({ game, views, clicks, ctaClicks }) => (
                                <div key={game} className={`p-3 bg-${currentTheme.border}/30 rounded-lg`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{getGameIcon(game)}</span>
                                            <span className={`text-${currentTheme.text} font-medium`}>{getGameLabel(game)}</span>
                                        </div>
                                        <span className={`text-${currentTheme.textMuted} text-xs`}>
                                            {getClickRate(clicks, views)} click rate
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className={`text-${currentTheme.text} font-bold`}>{views}</p>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>Views</p>
                                        </div>
                                        <div>
                                            <p className="text-purple-400 font-bold">{clicks}</p>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>Clicks</p>
                                        </div>
                                        <div>
                                            <p className="text-green-400 font-bold">{ctaClicks}</p>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>CTA</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* By Card */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <h3 className={`text-${currentTheme.text} font-bold mb-3`}>🎴 Performance by Card</h3>

                    {loading ? (
                        <div className="animate-pulse space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`h-12 bg-${currentTheme.border} rounded`}></div>
                            ))}
                        </div>
                    ) : sortedCardStats.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-4xl mb-2">📭</p>
                            <p className={`text-${currentTheme.textMuted}`}>No data yet</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Stats will appear once promo cards are shown in games</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {sortedCardStats.map(({ cardId, views, clicks, ctaClicks }) => {
                                const card = promoCards.find(c => c.id === cardId)
                                return (
                                    <div key={cardId} className={`p-3 bg-${currentTheme.border}/30 rounded-lg`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-${currentTheme.text} font-medium truncate`}>
                                                    {getCardName(cardId)}
                                                </span>
                                                {card?.has_popup && (
                                                    <span className="text-purple-400 text-xs">💬</span>
                                                )}
                                            </div>
                                            <span className={`text-${currentTheme.textMuted} text-xs`}>
                                                {getClickRate(clicks, views)} click rate
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className={`text-${currentTheme.text} font-bold`}>{views}</p>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Views</p>
                                            </div>
                                            <div>
                                                <p className="text-purple-400 font-bold">{clicks}</p>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Clicks</p>
                                            </div>
                                            <div>
                                                <p className="text-green-400 font-bold">{ctaClicks}</p>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>CTA</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Info Box */}
            <div className={`mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg`}>
                <h4 className="text-blue-400 font-medium mb-1">📈 How Stats Are Tracked</h4>
                <ul className={`text-${currentTheme.textMuted} text-sm space-y-1`}>
                    <li>• <strong>Impressions:</strong> Each time a promo card appears in a game</li>
                    <li>• <strong>Eyeball Clicks:</strong> When a player clicks the 👁 to view the card/popup</li>
                    <li>• <strong>CTA Clicks:</strong> When a player clicks the button inside a popup</li>
                    <li>• <strong>Click Rate:</strong> Eyeball clicks ÷ Impressions × 100</li>
                </ul>
            </div>
        </div>
    )
}
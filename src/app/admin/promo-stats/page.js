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
    const [timeRange, setTimeRange] = useState('week')
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
            let query = supabase.from('promo_card_views').select('*')
            const dateFilter = getDateFilter()
            if (dateFilter) query = query.gte('created_at', dateFilter)
            if (selectedCard !== 'all') query = query.eq('promo_card_id', selectedCard)

            const { data, error } = await query
            if (error) throw error

            const views = data || []
            const totalViews = views.filter(v => v.view_type === 'game_display').length
            const totalClicks = views.filter(v => v.view_type === 'eyeball_click').length
            const totalCtaClicks = views.filter(v => v.view_type === 'cta_click').length

            const byGame = {}
            views.forEach(v => {
                const game = v.game_type || 'unknown'
                if (!byGame[game]) byGame[game] = { views: 0, clicks: 0, ctaClicks: 0 }
                if (v.view_type === 'game_display') byGame[game].views++
                if (v.view_type === 'eyeball_click') byGame[game].clicks++
                if (v.view_type === 'cta_click') byGame[game].ctaClicks++
            })

            const byCard = {}
            views.forEach(v => {
                const cardId = v.promo_card_id
                if (!byCard[cardId]) byCard[cardId] = { views: 0, clicks: 0, ctaClicks: 0 }
                if (v.view_type === 'game_display') byCard[cardId].views++
                if (v.view_type === 'eyeball_click') byCard[cardId].clicks++
                if (v.view_type === 'cta_click') byCard[cardId].ctaClicks++
            })

            setStats({ totalViews, totalClicks, totalCtaClicks, byGame, byCard })
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getCardName = (cardId) => {
        const card = promoCards.find(c => c.id === cardId)
        return card?.display_name || card?.title || 'Unknown'
    }

    const getClickRate = (clicks, views) => {
        if (views === 0) return '0%'
        return ((clicks / views) * 100).toFixed(1) + '%'
    }

    const gameIcons = { slots: '🎰', solitaire: '🃏', memory: '🧠', card_gallery: '🖼️', unknown: '❓' }
    const gameLabels = { slots: 'Slots', solitaire: 'Solitaire', memory: 'Memory', card_gallery: 'Gallery', unknown: '?' }

    const timeOptions = [
        { value: 'day', label: 'Today' },
        { value: 'week', label: '7d' },
        { value: 'month', label: '30d' },
        { value: 'year', label: '1yr' },
        { value: 'all', label: 'All' }
    ]

    const sortedCardStats = Object.entries(stats.byCard)
        .map(([cardId, data]) => ({ cardId, ...data, total: data.views + data.clicks + data.ctaClicks }))
        .sort((a, b) => b.total - a.total)

    const sortedGameStats = Object.entries(stats.byGame)
        .map(([game, data]) => ({ game, ...data, total: data.views + data.clicks + data.ctaClicks }))
        .sort((a, b) => b.total - a.total)

    return (
        <div className="p-3">
            {/* Header + Filters Row */}
            <div className={`flex flex-wrap items-center gap-3 mb-3`}>
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>📊 IT Company Promo Card Stats</h1>

                <div className="flex gap-1">
                    {timeOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setTimeRange(opt.value)}
                            className={`px-2 py-0.5 text-xs rounded ${timeRange === opt.value
                                ? `bg-${currentTheme.accent} text-white font-bold`
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <select
                    value={selectedCard}
                    onChange={(e) => setSelectedCard(e.target.value)}
                    className={`px-2 py-0.5 text-xs bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                >
                    <option value="all">All Cards</option>
                    {promoCards.map(card => (
                        <option key={card.id} value={card.id}>
                            {card.display_name || card.title}{card.has_popup ? ' 💬' : ''}
                        </option>
                    ))}
                </select>

                <button
                    onClick={loadStats}
                    disabled={loading}
                    className={`px-2 py-0.5 text-xs bg-${currentTheme.accent} text-white rounded`}
                >
                    {loading ? '...' : '🔄'}
                </button>
            </div>

            {/* Summary Stats - Compact Row */}
            <div className={`grid grid-cols-4 gap-2 mb-3`}>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2 text-center`}>
                    <p className={`text-xl font-bold text-${currentTheme.text}`}>{loading ? '-' : stats.totalViews}</p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Impressions</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2 text-center`}>
                    <p className="text-xl font-bold text-purple-400">{loading ? '-' : stats.totalClicks}</p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>👁 Clicks ({getClickRate(stats.totalClicks, stats.totalViews)})</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2 text-center`}>
                    <p className="text-xl font-bold text-green-400">{loading ? '-' : stats.totalCtaClicks}</p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>CTA Clicks</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2 text-center`}>
                    <p className={`text-xl font-bold text-${currentTheme.accent}`}>{loading ? '-' : stats.totalClicks + stats.totalCtaClicks}</p>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Engagement</p>
                </div>
            </div>

            {/* Tables Side by Side */}
            <div className="grid md:grid-cols-2 gap-3">
                {/* By Game - Compact Table */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>📊 By Game</h3>
                    {sortedGameStats.length === 0 ? (
                        <p className={`text-${currentTheme.textMuted} text-xs text-center py-2`}>No data</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className={`border-b border-${currentTheme.border}`}>
                                    <th className={`text-left py-1 text-${currentTheme.textMuted}`}>Game</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>Views</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>👁</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>CTA</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedGameStats.map(({ game, views, clicks, ctaClicks }) => (
                                    <tr key={game} className={`border-b border-${currentTheme.border}/50`}>
                                        <td className={`py-1 text-${currentTheme.text}`}>{gameIcons[game]} {gameLabels[game]}</td>
                                        <td className={`py-1 text-right text-${currentTheme.text}`}>{views}</td>
                                        <td className="py-1 text-right text-purple-400">{clicks}</td>
                                        <td className="py-1 text-right text-green-400">{ctaClicks}</td>
                                        <td className={`py-1 text-right text-${currentTheme.textMuted}`}>{getClickRate(clicks, views)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* By Card - Compact Table */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>🎴 By Card</h3>
                    {sortedCardStats.length === 0 ? (
                        <p className={`text-${currentTheme.textMuted} text-xs text-center py-2`}>No data</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className={`border-b border-${currentTheme.border}`}>
                                    <th className={`text-left py-1 text-${currentTheme.textMuted}`}>Card</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>Views</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>👁</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>CTA</th>
                                    <th className={`text-right py-1 text-${currentTheme.textMuted}`}>Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCardStats.map(({ cardId, views, clicks, ctaClicks }) => {
                                    const card = promoCards.find(c => c.id === cardId)
                                    return (
                                        <tr key={cardId} className={`border-b border-${currentTheme.border}/50`}>
                                            <td className={`py-1 text-${currentTheme.text} truncate max-w-[120px]`}>
                                                {getCardName(cardId)}{card?.has_popup ? ' 💬' : ''}
                                            </td>
                                            <td className={`py-1 text-right text-${currentTheme.text}`}>{views}</td>
                                            <td className="py-1 text-right text-purple-400">{clicks}</td>
                                            <td className="py-1 text-right text-green-400">{ctaClicks}</td>
                                            <td className={`py-1 text-right text-${currentTheme.textMuted}`}>{getClickRate(clicks, views)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Compact Legend */}
            <div className={`mt-2 text-${currentTheme.textMuted} text-[10px] flex gap-4`}>
                <span>👁 = Eyeball clicks</span>
                <span>CTA = Button clicks in popups</span>
                <span>Rate = Clicks ÷ Views</span>
            </div>

            {/* Clarification Note */}
            <div className={`mt-3 text-center`}>
                <p className={`text-${currentTheme.accent} text-sm font-bold`}>* This is for IT Company Promo Cards — Not Advertiser Cards *</p>
            </div>
        </div>
    )
}
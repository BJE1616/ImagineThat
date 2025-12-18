'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminAdvertisersPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [campaigns, setCampaigns] = useState([])
    const [stats, setStats] = useState({
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalRevenue: 0,
        totalViews: 0
    })
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        loadCampaigns()
    }, [filter])

    const loadCampaigns = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('ad_campaigns')
                .select(`
                    *,
                    users (id, username, email, first_name, last_name)
                `)
                .order('created_at', { ascending: false })

            if (filter === 'active') {
                query = query.eq('status', 'active')
            } else if (filter === 'completed') {
                query = query.eq('status', 'completed')
            }

            const { data, error } = await query

            if (error) throw error

            setCampaigns(data || [])

            const allCampaigns = data || []
            const active = allCampaigns.filter(c => c.status === 'active')
            const totalRev = allCampaigns.reduce((sum, c) => sum + parseFloat(c.amount_paid || 0), 0)
            const totalViews = allCampaigns.reduce((sum, c) => sum + (c.views_from_game || 0) + (c.views_from_flips || 0) + (c.bonus_views || 0), 0)

            setStats({
                totalCampaigns: allCampaigns.length,
                activeCampaigns: active.length,
                totalRevenue: totalRev,
                totalViews: totalViews
            })
        } catch (error) {
            console.error('Error loading campaigns:', error)
        } finally {
            setLoading(false)
        }
    }

    const getTotalViews = (campaign) => {
        return (campaign.views_from_game || 0) + (campaign.views_from_flips || 0) + (campaign.bonus_views || 0)
    }

    const getViewProgress = (campaign) => {
        const total = getTotalViews(campaign)
        const guaranteed = campaign.views_guaranteed || 1000
        return Math.min((total / guaranteed) * 100, 100)
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const getPaymentMethodIcon = (method) => {
        switch (method) {
            case 'stripe': return '💳'
            case 'cashapp': return '💵'
            case 'venmo': return '📱'
            default: return '💰'
        }
    }

    if (loading && campaigns.length === 0) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Advertisers</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage ad campaigns and track views</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Campaigns</p>
                    <p className="text-xl font-bold text-blue-400">{stats.totalCampaigns}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Active Campaigns</p>
                    <p className="text-xl font-bold text-green-400">{stats.activeCampaigns}</p>
                </div>
                <div className={`bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Revenue</p>
                    <p className={`text-xl font-bold text-${currentTheme.accent}`}>${stats.totalRevenue}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Views</p>
                    <p className="text-xl font-bold text-purple-400">{stats.totalViews.toLocaleString()}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 mb-3">
                {['all', 'active', 'completed'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-all ${filter === tab
                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Campaigns Table */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b border-${currentTheme.border}`}>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium`}>Advertiser</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium`}>Payment</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium`}>Date</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium`}>Views Progress</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium`}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.length > 0 ? campaigns.map(campaign => (
                                <tr key={campaign.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                    <td className="py-2 px-3">
                                        <p className={`text-${currentTheme.text} font-medium`}>
                                            {campaign.users?.username || 'Unknown'}
                                        </p>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>
                                            {campaign.users?.email}
                                        </p>
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm">{getPaymentMethodIcon(campaign.payment_method)}</span>
                                            <span className="text-green-400 font-medium">${campaign.amount_paid}</span>
                                        </div>
                                        <p className={`text-${currentTheme.textMuted} text-xs capitalize`}>{campaign.payment_method}</p>
                                    </td>
                                    <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>
                                        {formatDate(campaign.paid_at)}
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="w-full max-w-36">
                                            <div className="flex justify-between text-xs mb-0.5">
                                                <span className={`text-${currentTheme.textMuted}`}>
                                                    {getTotalViews(campaign).toLocaleString()} / {campaign.views_guaranteed?.toLocaleString()}
                                                </span>
                                                <span className={`text-${currentTheme.textMuted}`}>
                                                    {Math.round(getViewProgress(campaign))}%
                                                </span>
                                            </div>
                                            <div className={`h-1.5 bg-${currentTheme.border} rounded-full overflow-hidden`}>
                                                <div
                                                    className={`h-full rounded-full ${getViewProgress(campaign) >= 100
                                                        ? 'bg-green-500'
                                                        : `bg-${currentTheme.accent}`
                                                        }`}
                                                    style={{ width: `${getViewProgress(campaign)}%` }}
                                                ></div>
                                            </div>
                                            {campaign.bonus_views > 0 && (
                                                <p className="text-green-400 text-[10px] mt-0.5">
                                                    +{campaign.bonus_views.toLocaleString()} bonus
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'active'
                                            ? 'bg-green-500/20 text-green-400'
                                            : `bg-${currentTheme.textMuted}/20 text-${currentTheme.textMuted}`
                                            }`}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className={`py-8 text-center text-${currentTheme.textMuted} text-sm`}>
                                        No ad campaigns yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
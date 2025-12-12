'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminAdvertisersPage() {
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

            // Calculate stats
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
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-64"></div>
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>
                        ))}
                    </div>
                    <div className="h-96 bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Advertisers</h1>
                <p className="text-slate-400 mt-1">Manage ad campaigns and track views</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Total Campaigns</p>
                    <p className="text-3xl font-bold text-blue-400 mt-1">{stats.totalCampaigns}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Active Campaigns</p>
                    <p className="text-3xl font-bold text-green-400 mt-1">{stats.activeCampaigns}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold text-amber-400 mt-1">${stats.totalRevenue}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                    <p className="text-slate-400 text-sm font-medium">Total Views Delivered</p>
                    <p className="text-3xl font-bold text-purple-400 mt-1">{stats.totalViews.toLocaleString()}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {['all', 'active', 'completed'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${filter === tab
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Campaigns Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Advertiser</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Payment</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Date</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Views Progress</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.length > 0 ? campaigns.map(campaign => (
                                <tr key={campaign.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="text-white font-medium">
                                                {campaign.users?.username || 'Unknown'}
                                            </p>
                                            <p className="text-slate-400 text-sm">
                                                {campaign.users?.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <span>{getPaymentMethodIcon(campaign.payment_method)}</span>
                                            <span className="text-green-400 font-medium">${campaign.amount_paid}</span>
                                        </div>
                                        <p className="text-slate-500 text-sm capitalize">{campaign.payment_method}</p>
                                    </td>
                                    <td className="py-4 px-6 text-slate-300">
                                        {formatDate(campaign.paid_at)}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="w-full max-w-48">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-400">
                                                    {getTotalViews(campaign).toLocaleString()} / {campaign.views_guaranteed?.toLocaleString()}
                                                </span>
                                                <span className="text-slate-400">
                                                    {Math.round(getViewProgress(campaign))}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${getViewProgress(campaign) >= 100
                                                            ? 'bg-green-500'
                                                            : 'bg-amber-500'
                                                        }`}
                                                    style={{ width: `${getViewProgress(campaign)}%` }}
                                                ></div>
                                            </div>
                                            {campaign.bonus_views > 0 && (
                                                <p className="text-green-400 text-xs mt-1">
                                                    +{campaign.bonus_views.toLocaleString()} bonus views
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${campaign.status === 'active'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-slate-400">
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
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function CampaignDashboardPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [campaigns, setCampaigns] = useState([])
    const [users, setUsers] = useState({})
    const [businessCards, setBusinessCards] = useState({})
    const [thresholds, setThresholds] = useState({ warning: 75, critical: 90 })
    const [activeTab, setActiveTab] = useState('alerts') // 'alerts', 'all', 'stats'
    const [filters, setFilters] = useState({
        status: 'active',
        search: '',
        sortBy: 'percent_complete',
        sortDir: 'desc'
    })

    // Stats
    const [stats, setStats] = useState({
        totalActive: 0,
        totalCompleted: 0,
        avgCompletionDays: 0,
        avgViewsPerDay: 0,
        viewSources: { game: 0, flips: 0, clicks: 0, cardBack: 0 }
    })

    useEffect(() => {
        loadThresholds()
        loadCampaigns()
    }, [])

    const loadThresholds = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['campaign_alert_warning', 'campaign_alert_critical'])

            const settings = {}
            data?.forEach(s => {
                if (s.setting_key === 'campaign_alert_warning') settings.warning = parseInt(s.setting_value)
                if (s.setting_key === 'campaign_alert_critical') settings.critical = parseInt(s.setting_value)
            })
            setThresholds({ ...thresholds, ...settings })
        } catch (error) {
            console.error('Error loading thresholds:', error)
        }
    }

    const loadCampaigns = async () => {
        try {
            // Load all campaigns
            const { data: campaignData, error } = await supabase
                .from('ad_campaigns')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            setCampaigns(campaignData || [])

            // Get unique user IDs and business card IDs
            const userIds = [...new Set(campaignData?.map(c => c.user_id) || [])]
            const cardIds = [...new Set(campaignData?.map(c => c.business_card_id).filter(Boolean) || [])]

            // Load users
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const usersMap = {}
                usersData?.forEach(u => {
                    usersMap[u.id] = u
                })
                setUsers(usersMap)
            }

            // Load business cards
            if (cardIds.length > 0) {
                const { data: cardsData } = await supabase
                    .from('business_cards')
                    .select('id, title, card_type')
                    .in('id', cardIds)

                const cardsMap = {}
                cardsData?.forEach(c => {
                    cardsMap[c.id] = c
                })
                setBusinessCards(cardsMap)
            }

            // Calculate stats
            calculateStats(campaignData || [])

        } catch (error) {
            console.error('Error loading campaigns:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (campaignData) => {
        const active = campaignData.filter(c => c.status === 'active')
        const completed = campaignData.filter(c => c.status === 'completed')

        // Average completion time (days)
        let totalCompletionDays = 0
        let completedWithDates = 0
        completed.forEach(c => {
            if (c.started_at && c.completed_at) {
                const start = new Date(c.started_at)
                const end = new Date(c.completed_at)
                const days = (end - start) / (1000 * 60 * 60 * 24)
                totalCompletionDays += days
                completedWithDates++
            }
        })
        const avgCompletionDays = completedWithDates > 0 ? totalCompletionDays / completedWithDates : 0

        // Average views per day for active campaigns
        let totalViewsPerDay = 0
        let activeWithDates = 0
        active.forEach(c => {
            if (c.started_at && c.total_views > 0) {
                const start = new Date(c.started_at)
                const now = new Date()
                const days = Math.max(1, (now - start) / (1000 * 60 * 60 * 24))
                totalViewsPerDay += c.total_views / days
                activeWithDates++
            }
        })
        const avgViewsPerDay = activeWithDates > 0 ? totalViewsPerDay / activeWithDates : 0

        // View sources totals
        const viewSources = { game: 0, flips: 0, clicks: 0, cardBack: 0 }
        campaignData.forEach(c => {
            viewSources.game += c.views_from_game || 0
            viewSources.flips += c.views_from_flips || 0
            viewSources.clicks += c.views_from_clicks || 0
            viewSources.cardBack += c.views_from_card_back || 0
        })

        setStats({
            totalActive: active.length,
            totalCompleted: completed.length,
            avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
            avgViewsPerDay: Math.round(avgViewsPerDay * 10) / 10,
            viewSources
        })
    }

    const getPercentComplete = (campaign) => {
        const total = (campaign.contracted_views || 0) + (campaign.bonus_views || 0)
        if (total === 0) return 0
        return Math.min(100, Math.round((campaign.total_views / total) * 100))
    }

    const getViewsRemaining = (campaign) => {
        const total = (campaign.contracted_views || 0) + (campaign.bonus_views || 0)
        return Math.max(0, total - (campaign.total_views || 0))
    }

    const getProjectedCompletion = (campaign) => {
        if (!campaign.started_at || campaign.total_views === 0) return null

        const start = new Date(campaign.started_at)
        const now = new Date()
        const daysActive = Math.max(1, (now - start) / (1000 * 60 * 60 * 24))
        const viewsPerDay = campaign.total_views / daysActive

        if (viewsPerDay === 0) return null

        const remaining = getViewsRemaining(campaign)
        const daysRemaining = remaining / viewsPerDay

        const projected = new Date()
        projected.setDate(projected.getDate() + daysRemaining)
        return projected
    }

    const getAlertLevel = (campaign) => {
        const percent = getPercentComplete(campaign)
        if (percent >= thresholds.critical) return 'critical'
        if (percent >= thresholds.warning) return 'warning'
        return 'ok'
    }

    const getFilteredCampaigns = () => {
        let filtered = [...campaigns]

        // Status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status)
        }

        // Search filter
        if (filters.search) {
            const search = filters.search.toLowerCase()
            filtered = filtered.filter(c => {
                const user = users[c.user_id]
                const card = businessCards[c.business_card_id]
                return (
                    user?.email?.toLowerCase().includes(search) ||
                    user?.username?.toLowerCase().includes(search) ||
                    user?.first_name?.toLowerCase().includes(search) ||
                    user?.last_name?.toLowerCase().includes(search) ||
                    card?.title?.toLowerCase().includes(search)
                )
            })
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal, bVal
            switch (filters.sortBy) {
                case 'percent_complete':
                    aVal = getPercentComplete(a)
                    bVal = getPercentComplete(b)
                    break
                case 'views_remaining':
                    aVal = getViewsRemaining(a)
                    bVal = getViewsRemaining(b)
                    break
                case 'created_at':
                    aVal = new Date(a.created_at)
                    bVal = new Date(b.created_at)
                    break
                case 'total_views':
                    aVal = a.total_views || 0
                    bVal = b.total_views || 0
                    break
                default:
                    aVal = getPercentComplete(a)
                    bVal = getPercentComplete(b)
            }
            return filters.sortDir === 'asc' ? aVal - bVal : bVal - aVal
        })

        return filtered
    }

    const getAlertCampaigns = () => {
        return campaigns
            .filter(c => c.status === 'active')
            .filter(c => getAlertLevel(c) !== 'ok')
            .sort((a, b) => getPercentComplete(b) - getPercentComplete(a))
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getUserDisplay = (userId) => {
        const user = users[userId]
        if (!user) return 'Unknown'
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`
        return user.username || user.email || 'Unknown'
    }

    const getUserEmail = (userId) => {
        return users[userId]?.email || ''
    }

    const getCardTitle = (cardId) => {
        return businessCards[cardId]?.title || 'Unknown Card'
    }

    const updateThreshold = async (key, value) => {
        const settingKey = key === 'warning' ? 'campaign_alert_warning' : 'campaign_alert_critical'
        try {
            await supabase
                .from('admin_settings')
                .update({ setting_value: value.toString() })
                .eq('setting_key', settingKey)

            setThresholds({ ...thresholds, [key]: value })
        } catch (error) {
            console.error('Error updating threshold:', error)
        }
    }

    const totalViewSources = stats.viewSources.game + stats.viewSources.flips + stats.viewSources.clicks + stats.viewSources.cardBack

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>📊 Campaign Dashboard</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Monitor advertiser campaigns and view delivery stats</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Active Campaigns</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.totalActive}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Completed</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.totalCompleted}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Avg Completion</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.avgCompletionDays} days</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Avg Views/Day</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.avgViewsPerDay}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Needs Attention</p>
                    <p className={`text-xl font-bold ${getAlertCampaigns().length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {getAlertCampaigns().length}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {[
                    { key: 'alerts', label: `🚨 Alerts (${getAlertCampaigns().length})` },
                    { key: 'all', label: '📋 All Campaigns' },
                    { key: 'stats', label: '📈 Analytics' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                : `bg-${currentTheme.card} text-${currentTheme.textMuted} hover:bg-${currentTheme.border}`
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    {/* Threshold Settings */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h3 className={`text-${currentTheme.text} font-bold mb-3`}>⚙️ Alert Thresholds</h3>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-${currentTheme.textMuted} text-sm`}>Warning at:</span>
                                <input
                                    type="number"
                                    value={thresholds.warning}
                                    onChange={(e) => updateThreshold('warning', parseInt(e.target.value))}
                                    className={`w-16 px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                />
                                <span className="text-yellow-400 text-sm">% (yellow)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-${currentTheme.textMuted} text-sm`}>Critical at:</span>
                                <input
                                    type="number"
                                    value={thresholds.critical}
                                    onChange={(e) => updateThreshold('critical', parseInt(e.target.value))}
                                    className={`w-16 px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                />
                                <span className="text-red-400 text-sm">% (red)</span>
                            </div>
                        </div>
                    </div>

                    {/* Alert List */}
                    {getAlertCampaigns().length === 0 ? (
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-8 text-center`}>
                            <p className="text-4xl mb-2">✅</p>
                            <p className={`text-${currentTheme.text} font-medium`}>All campaigns healthy!</p>
                            <p className={`text-${currentTheme.textMuted} text-sm mt-1`}>No campaigns above {thresholds.warning}% completion</p>
                        </div>
                    ) : (
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                            <th className="text-left py-2 px-3">Status</th>
                                            <th className="text-left py-2 px-3">Advertiser</th>
                                            <th className="text-left py-2 px-3">Campaign</th>
                                            <th className="text-left py-2 px-3">Progress</th>
                                            <th className="text-left py-2 px-3">Remaining</th>
                                            <th className="text-left py-2 px-3">Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getAlertCampaigns().map(campaign => {
                                            const percent = getPercentComplete(campaign)
                                            const level = getAlertLevel(campaign)
                                            return (
                                                <tr key={campaign.id} className={`border-t border-${currentTheme.border}/50`}>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${level === 'critical'
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : 'bg-yellow-500/20 text-yellow-400'
                                                            }`}>
                                                            {level === 'critical' ? '🔴 CRITICAL' : '🟡 WARNING'}
                                                        </span>
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.text}`}>
                                                        {getUserDisplay(campaign.user_id)}
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                        {getCardTitle(campaign.business_card_id)}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`}
                                                                    style={{ width: `${percent}%` }}
                                                                />
                                                            </div>
                                                            <span className={`text-${currentTheme.text} text-xs font-bold`}>{percent}%</span>
                                                        </div>
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                        {getViewsRemaining(campaign).toLocaleString()} views
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <a
                                                            href={`mailto:${getUserEmail(campaign.user_id)}?subject=Your campaign is almost complete!`}
                                                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-all"
                                                        >
                                                            📧 Email
                                                        </a>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* All Campaigns Tab */}
            {activeTab === 'all' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                >
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Sort By</label>
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                                    className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                >
                                    <option value="percent_complete">% Complete</option>
                                    <option value="views_remaining">Views Remaining</option>
                                    <option value="total_views">Total Views</option>
                                    <option value="created_at">Created Date</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Order</label>
                                <select
                                    value={filters.sortDir}
                                    onChange={(e) => setFilters({ ...filters, sortDir: e.target.value })}
                                    className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                >
                                    <option value="desc">High to Low</option>
                                    <option value="asc">Low to High</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[150px]">
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Search</label>
                                <input
                                    type="text"
                                    value={filters.search}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    placeholder="Search by name, email, or card..."
                                    className={`w-full px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Campaign List */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                        <th className="text-left py-2 px-3">Advertiser</th>
                                        <th className="text-left py-2 px-3">Campaign</th>
                                        <th className="text-left py-2 px-3">Status</th>
                                        <th className="text-left py-2 px-3">Progress</th>
                                        <th className="text-left py-2 px-3">Views</th>
                                        <th className="text-left py-2 px-3">Projected</th>
                                        <th className="text-left py-2 px-3">Started</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getFilteredCampaigns().length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                                No campaigns found
                                            </td>
                                        </tr>
                                    ) : (
                                        getFilteredCampaigns().map(campaign => {
                                            const percent = getPercentComplete(campaign)
                                            const level = getAlertLevel(campaign)
                                            const projected = getProjectedCompletion(campaign)
                                            return (
                                                <tr key={campaign.id} className={`border-t border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                                    <td className={`py-2 px-3 text-${currentTheme.text}`}>
                                                        <div>{getUserDisplay(campaign.user_id)}</div>
                                                        <div className={`text-${currentTheme.textMuted} text-xs`}>{getUserEmail(campaign.user_id)}</div>
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                        {getCardTitle(campaign.business_card_id)}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${campaign.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                                campaign.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {campaign.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${level === 'critical' ? 'bg-red-500' :
                                                                            level === 'warning' ? 'bg-yellow-500' :
                                                                                'bg-green-500'
                                                                        }`}
                                                                    style={{ width: `${percent}%` }}
                                                                />
                                                            </div>
                                                            <span className={`text-${currentTheme.text} text-xs`}>{percent}%</span>
                                                        </div>
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>
                                                        <div>{(campaign.total_views || 0).toLocaleString()} / {((campaign.contracted_views || 0) + (campaign.bonus_views || 0)).toLocaleString()}</div>
                                                        <div className={`text-${currentTheme.textMuted}`}>{getViewsRemaining(campaign).toLocaleString()} left</div>
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>
                                                        {campaign.status === 'active' && projected ? formatDate(projected) : '-'}
                                                    </td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>
                                                        {formatDate(campaign.started_at)}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {/* View Sources Breakdown */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h3 className={`text-${currentTheme.text} font-bold mb-3`}>👁️ View Sources</h3>
                        <div className="space-y-3">
                            {[
                                { label: '🎮 Game Views', value: stats.viewSources.game, color: 'blue' },
                                { label: '🔄 Flip Views', value: stats.viewSources.flips, color: 'purple' },
                                { label: '👆 Click Views', value: stats.viewSources.clicks, color: 'green' },
                                { label: '🃏 Card Back', value: stats.viewSources.cardBack, color: 'yellow' }
                            ].map(source => {
                                const percent = totalViewSources > 0 ? Math.round((source.value / totalViewSources) * 100) : 0
                                return (
                                    <div key={source.label}>
                                        <div className="flex justify-between mb-1">
                                            <span className={`text-${currentTheme.text} text-sm`}>{source.label}</span>
                                            <span className={`text-${currentTheme.textMuted} text-sm`}>
                                                {source.value.toLocaleString()} ({percent}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-${source.color}-500`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className={`mt-3 pt-3 border-t border-${currentTheme.border}`}>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.text} font-medium`}>Total Views</span>
                                <span className={`text-${currentTheme.text} font-bold`}>{totalViewSources.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Campaign Performance */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h3 className={`text-${currentTheme.text} font-bold mb-3`}>📊 Campaign Performance</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.textMuted}`}>Average Completion Time</span>
                                <span className={`text-${currentTheme.text} font-bold text-lg`}>{stats.avgCompletionDays} days</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.textMuted}`}>Average Views per Day</span>
                                <span className={`text-${currentTheme.text} font-bold text-lg`}>{stats.avgViewsPerDay}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.textMuted}`}>Active Campaigns</span>
                                <span className="text-green-400 font-bold text-lg">{stats.totalActive}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.textMuted}`}>Completed Campaigns</span>
                                <span className="text-blue-400 font-bold text-lg">{stats.totalCompleted}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.textMuted}`}>Completion Rate</span>
                                <span className={`text-${currentTheme.text} font-bold text-lg`}>
                                    {stats.totalActive + stats.totalCompleted > 0
                                        ? Math.round((stats.totalCompleted / (stats.totalActive + stats.totalCompleted)) * 100)
                                        : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
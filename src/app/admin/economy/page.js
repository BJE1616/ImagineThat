'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== ECONOMY DASHBOARD =====
// Central hub for token economy health, settings, alerts, and analysis

// ===== DEFAULT VALUES =====
const DEFAULTS = {
    token_value: 0.10,
    campaign_price: 100,
    views_per_campaign: 500,
    house_edge_percent: 11,
    max_free_spins_daily: 5,
    merch_markup_multiplier: 3.0
}

// ===== SETTING EXPLANATIONS =====
const EXPLANATIONS = {
    token_value: {
        title: 'Token Value',
        what: 'The real dollar value of 1 token. This is the foundation of your entire economy.',
        why: 'Lower value = users earn MORE tokens per action (feels rewarding). Higher value = users need fewer tokens for prizes (but earning feels slow).',
        tip: 'Most successful platforms use $0.05 - $0.15 per token.'
    },
    campaign_price: {
        title: 'Campaign Price',
        what: 'What advertisers pay for one ad campaign. This is your primary revenue source.',
        why: 'This money funds everything: token rewards, prizes, merch fulfillment, and profit.',
        tip: 'Balance revenue needs with advertiser appeal. $75-$150 is typical.'
    },
    views_per_campaign: {
        title: 'Views Per Campaign',
        what: 'How many guaranteed ad views each campaign receives.',
        why: 'More views = better value for advertisers. Fewer views = faster fulfillment.',
        tip: 'Calculate: Campaign Price ÷ Views = value per view. Aim for $0.15-$0.30 per view.'
    },
    house_edge_percent: {
        title: 'House Edge %',
        what: 'The percentage the slot machine keeps from all wagers over time.',
        why: 'Too low = house loses money. Too high = players feel cheated and stop playing.',
        tip: 'Casinos use 2-15%. For play-money, 8-15% is fair and sustainable.'
    },
    max_free_spins_daily: {
        title: 'Max Free Spins Daily',
        what: 'How many free slot machine plays each user gets per day.',
        why: 'Free spins drive engagement but give away tokens. Too many = inflation.',
        tip: '3-8 spins balances engagement with economy health.'
    },
    merch_markup_multiplier: {
        title: 'Merch Markup Multiplier',
        what: 'How much to multiply your cost when pricing merch in tokens.',
        why: 'Below 2x = you lose money on redemptions. Above 5x = merch feels unreachable.',
        tip: '2.5x - 4x covers costs and shipping while feeling fair to users.'
    }
}

// ===== HEALTH SCORE THRESHOLDS =====
const HEALTH_THRESHOLDS = {
    excellent: 80,
    good: 60,
    warning: 40,
    critical: 20
}

export default function EconomyDashboardPage() {
    // ===== STATE =====
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState([])
    const [stats, setStats] = useState(null)
    const [warnings, setWarnings] = useState([])
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('overview')

    // ===== HEALTH & ANALYSIS STATE =====
    const [healthScore, setHealthScore] = useState(null)
    const [healthFactors, setHealthFactors] = useState([])
    const [alerts, setAlerts] = useState([])
    const [trends, setTrends] = useState(null)
    const [projections, setProjections] = useState(null)

    // ===== EDITING STATE =====
    const [expandedSetting, setExpandedSetting] = useState(null)
    const [editingValue, setEditingValue] = useState(null)
    const [lastSavedValue, setLastSavedValue] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadAllData()
    }, [])

    // ===== LOAD ALL DATA =====
    const loadAllData = async () => {
        setLoading(true)
        await Promise.all([
            loadSettings(),
            loadStats(),
            loadTrends(),
            loadAlerts()
        ])
        setLoading(false)
    }

    // ===== LOAD SETTINGS =====
    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('economy_settings')
                .select('*')
                .order('setting_key')
            if (error) throw error
            setSettings(data || [])
            checkWarnings(data || [])
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    // ===== LOAD STATS =====
    const loadStats = async () => {
        try {
            // Get token balances
            const { data: balances } = await supabase.from('bb_balances').select('balance, lifetime_earned, lifetime_spent')
            const totalInCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalEverIssued = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0
            const totalSpent = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0
            const usersWithBalance = balances?.filter(b => b.balance > 0).length || 0

            // Get active campaigns
            const { data: campaigns } = await supabase.from('ad_campaigns').select('id').eq('status', 'active')

            // Get merch orders (token redemptions)
            const { data: merchOrders } = await supabase
                .from('merch_orders')
                .select('bb_cost')
                .not('bb_cost', 'is', null)
            const totalMerchBurn = merchOrders?.reduce((sum, o) => sum + (o.bb_cost || 0), 0) || 0

            // Get user count
            const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })

            const statsData = {
                totalInCirculation,
                totalEverIssued,
                totalSpent,
                totalBurned: totalSpent,
                totalMerchBurn,
                activeCampaigns: campaigns?.length || 0,
                usersWithBalance,
                totalUsers: totalUsers || 0,
                avgBalance: usersWithBalance > 0 ? Math.round(totalInCirculation / usersWithBalance) : 0
            }

            setStats(statsData)
            calculateHealthScore(statsData, settings)
        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    // ===== LOAD TRENDS =====
    const loadTrends = async () => {
        try {
            const now = new Date()
            const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

            // Get transaction history for trends
            const { data: recentTransactions } = await supabase
                .from('bb_transactions')
                .select('amount, type, source, created_at')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: true })

            if (!recentTransactions || recentTransactions.length === 0) {
                setTrends({
                    hasData: false,
                    message: 'Trends will appear once token activity begins'
                })
                return
            }

            // Calculate 7-day vs previous 7-day
            const last7Days = recentTransactions.filter(t => new Date(t.created_at) >= sevenDaysAgo)
            const previous7Days = recentTransactions.filter(t => {
                const date = new Date(t.created_at)
                return date >= new Date(sevenDaysAgo - 7 * 24 * 60 * 60 * 1000) && date < sevenDaysAgo
            })

            const last7Earned = last7Days.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
            const prev7Earned = previous7Days.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
            const last7Spent = Math.abs(last7Days.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
            const prev7Spent = Math.abs(previous7Days.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))

            // Daily breakdown for chart
            const dailyData = []
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now)
                date.setDate(date.getDate() - i)
                const dateStr = date.toISOString().split('T')[0]
                const dayTransactions = recentTransactions.filter(t => t.created_at.startsWith(dateStr))
                dailyData.push({
                    date: dateStr,
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    earned: dayTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                    spent: Math.abs(dayTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
                })
            }

            setTrends({
                hasData: true,
                last7Days: {
                    earned: last7Earned,
                    spent: last7Spent,
                    net: last7Earned - last7Spent
                },
                previous7Days: {
                    earned: prev7Earned,
                    spent: prev7Spent,
                    net: prev7Earned - prev7Spent
                },
                earnedChange: prev7Earned > 0 ? ((last7Earned - prev7Earned) / prev7Earned * 100).toFixed(1) : 0,
                spentChange: prev7Spent > 0 ? ((last7Spent - prev7Spent) / prev7Spent * 100).toFixed(1) : 0,
                dailyData
            })
        } catch (error) {
            console.error('Error loading trends:', error)
            setTrends({ hasData: false, message: 'Error loading trend data' })
        }
    }

    // ===== LOAD ALERTS =====
    const loadAlerts = async () => {
        const newAlerts = []

        try {
            // Check for merch items with high markup that might be digital
            const { data: merchItems } = await supabase
                .from('merch_items')
                .select('id, name, our_cost, bb_price, item_type')

            merchItems?.forEach(item => {
                if (item.our_cost && item.bb_price) {
                    const markup = item.bb_price / item.our_cost
                    // Flag potential digital items with high markup
                    const lowerName = (item.name || '').toLowerCase()
                    if ((lowerName.includes('gift card') || lowerName.includes('digital') || lowerName.includes('code') || lowerName.includes('voucher')) && markup > 1.5) {
                        newAlerts.push({
                            type: 'warning',
                            category: 'merch',
                            title: 'Digital Item Markup',
                            message: `"${item.name}" appears to be a digital item with ${markup.toFixed(1)}x markup. Customers can see face value.`,
                            action: 'Review pricing in Merch Store',
                            link: '/admin/merch-store'
                        })
                    }
                }
            })

            // Check for stale campaigns
            const { data: staleCampaigns } = await supabase
                .from('ad_campaigns')
                .select('id, created_at, views_guaranteed, views_from_game, views_from_flips')
                .eq('status', 'active')

            staleCampaigns?.forEach(camp => {
                const totalViews = (camp.views_from_game || 0) + (camp.views_from_flips || 0)
                const progress = camp.views_guaranteed > 0 ? (totalViews / camp.views_guaranteed) * 100 : 0
                const daysSinceCreated = (Date.now() - new Date(camp.created_at).getTime()) / (1000 * 60 * 60 * 24)

                if (daysSinceCreated > 30 && progress < 50) {
                    newAlerts.push({
                        type: 'info',
                        category: 'campaigns',
                        title: 'Slow Campaign Progress',
                        message: `Campaign created ${Math.floor(daysSinceCreated)} days ago is only ${progress.toFixed(0)}% complete.`,
                        action: 'May need more user engagement'
                    })
                }
            })

            // Check for pending matrix payouts
            const { data: pendingPayouts } = await supabase
                .from('matrix_entries')
                .select('id')
                .eq('is_completed', true)
                .eq('payout_status', 'pending')

            if (pendingPayouts && pendingPayouts.length > 0) {
                newAlerts.push({
                    type: 'urgent',
                    category: 'payouts',
                    title: 'Pending Matrix Payouts',
                    message: `${pendingPayouts.length} completed matrix${pendingPayouts.length > 1 ? 'es' : ''} awaiting payout.`,
                    action: 'Process payouts',
                    link: '/admin/payout-queue'
                })
            }

            // Check token economy health
            const { data: balances } = await supabase.from('bb_balances').select('balance, lifetime_earned')
            const totalCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalIssued = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0

            if (totalIssued > 0) {
                const burnRate = ((totalIssued - totalCirculation) / totalIssued) * 100
                if (burnRate < 20) {
                    newAlerts.push({
                        type: 'warning',
                        category: 'economy',
                        title: 'Low Token Burn Rate',
                        message: `Only ${burnRate.toFixed(1)}% of issued tokens have been spent. Tokens may be accumulating.`,
                        action: 'Consider adding more token sinks or reducing rewards'
                    })
                }
            }

            setAlerts(newAlerts)
        } catch (error) {
            console.error('Error loading alerts:', error)
        }
    }

    // ===== CALCULATE HEALTH SCORE =====
    const calculateHealthScore = (statsData, settingsData) => {
        if (!statsData) {
            setHealthScore(null)
            setHealthFactors([])
            return
        }

        const factors = []
        let totalScore = 0
        let totalWeight = 0

        // Factor 1: Burn Rate (weight: 25)
        // Healthy economy should have 30-60% burn rate
        const burnRate = statsData.totalEverIssued > 0
            ? (statsData.totalBurned / statsData.totalEverIssued) * 100
            : 50 // Default to neutral if no data
        let burnScore = 0
        if (burnRate >= 30 && burnRate <= 60) burnScore = 100
        else if (burnRate >= 20 && burnRate < 30) burnScore = 70
        else if (burnRate > 60 && burnRate <= 75) burnScore = 70
        else if (burnRate >= 10 && burnRate < 20) burnScore = 40
        else if (burnRate > 75) burnScore = 50
        else burnScore = 20

        factors.push({
            name: 'Burn Rate',
            score: burnScore,
            weight: 25,
            value: `${burnRate.toFixed(1)}%`,
            status: burnScore >= 70 ? 'good' : burnScore >= 40 ? 'warning' : 'critical',
            description: burnRate < 30 ? 'Tokens accumulating - add more sinks' : burnRate > 60 ? 'High burn - users spending quickly' : 'Healthy balance'
        })
        totalScore += burnScore * 25
        totalWeight += 25

        // Factor 2: User Engagement (weight: 25)
        // % of users with token balance
        const engagementRate = statsData.totalUsers > 0
            ? (statsData.usersWithBalance / statsData.totalUsers) * 100
            : 0
        let engagementScore = Math.min(100, Math.round(engagementRate * 2)) // 50% engagement = 100 score

        factors.push({
            name: 'User Engagement',
            score: Math.round(engagementScore),
            weight: 25,
            value: `${engagementRate.toFixed(1)}%`,
            status: engagementScore >= 70 ? 'good' : engagementScore >= 40 ? 'warning' : 'critical',
            description: `${statsData.usersWithBalance} of ${statsData.totalUsers} users have tokens`
        })
        totalScore += engagementScore * 25
        totalWeight += 25

        // Factor 3: Campaign Activity (weight: 20)
        const campaignScore = statsData.activeCampaigns > 0 ? Math.min(100, statsData.activeCampaigns * 20) : 0

        factors.push({
            name: 'Campaign Activity',
            score: campaignScore,
            weight: 20,
            value: `${statsData.activeCampaigns} active`,
            status: campaignScore >= 60 ? 'good' : campaignScore >= 20 ? 'warning' : 'critical',
            description: statsData.activeCampaigns === 0 ? 'No active campaigns - no revenue' : 'Campaigns generating revenue'
        })
        totalScore += campaignScore * 20
        totalWeight += 20

        // Factor 4: Settings Health (weight: 15)
        const settingsWithWarnings = settingsData?.filter(s => {
            if (s.warning_threshold_low && s.setting_value < s.warning_threshold_low) return true
            if (s.warning_threshold_high && s.setting_value > s.warning_threshold_high) return true
            return false
        }).length || 0
        const totalSettings = settingsData?.length || 1
        const settingsScore = ((totalSettings - settingsWithWarnings) / totalSettings) * 100

        factors.push({
            name: 'Settings Health',
            score: settingsScore,
            weight: 15,
            value: settingsWithWarnings === 0 ? 'All good' : `${settingsWithWarnings} issues`,
            status: settingsScore === 100 ? 'good' : settingsScore >= 70 ? 'warning' : 'critical',
            description: settingsWithWarnings > 0 ? 'Some settings outside safe ranges' : 'All settings within safe ranges'
        })
        totalScore += settingsScore * 15
        totalWeight += 15

        // Factor 5: Circulation Health (weight: 15)
        // Check if circulation is reasonable (not too concentrated)
        const avgBalance = statsData.avgBalance || 0
        const tokenValue = settingsData?.find(s => s.setting_key === 'token_value')?.setting_value || 0.10
        const avgBalanceValue = avgBalance * tokenValue
        let circulationScore = 100
        if (avgBalanceValue > 100) circulationScore = 60 // High accumulation
        if (avgBalanceValue > 500) circulationScore = 30 // Very high accumulation

        factors.push({
            name: 'Token Distribution',
            score: circulationScore,
            weight: 15,
            value: `~$${avgBalanceValue.toFixed(2)}/user`,
            status: circulationScore >= 70 ? 'good' : circulationScore >= 40 ? 'warning' : 'critical',
            description: avgBalanceValue > 100 ? 'High average balance - may indicate hoarding' : 'Healthy distribution'
        })
        totalScore += circulationScore * 15
        totalWeight += 15

        // Calculate final score
        const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
        setHealthScore(finalScore)
        setHealthFactors(factors)

        // Generate projections
        generateProjections(statsData, settingsData)
    }

    // ===== GENERATE PROJECTIONS =====
    const generateProjections = (statsData, settingsData) => {
        if (!statsData || statsData.totalEverIssued === 0) {
            setProjections(null)
            return
        }

        const tokenValue = settingsData?.find(s => s.setting_key === 'token_value')?.setting_value || 0.10
        const circulationValue = statsData.totalInCirculation * tokenValue

        // Calculate daily issuance rate (estimate based on settings)
        const maxFreeSpins = settingsData?.find(s => s.setting_key === 'max_free_spins_daily')?.setting_value || 5
        const estimatedDailyIssuance = statsData.usersWithBalance * maxFreeSpins * 2 // rough estimate

        setProjections({
            circulationValue: circulationValue.toFixed(2),
            estimatedDailyIssuance,
            estimatedDailyIssuanceValue: (estimatedDailyIssuance * tokenValue).toFixed(2),
            daysUntilCirculationDoubles: estimatedDailyIssuance > 0
                ? Math.round(statsData.totalInCirculation / estimatedDailyIssuance)
                : null
        })
    }

    // ===== CHECK WARNINGS =====
    const checkWarnings = (settingsData) => {
        const newWarnings = []
        settingsData.forEach(s => {
            if (s.warning_threshold_low && s.setting_value < s.warning_threshold_low) {
                newWarnings.push({ setting: s.setting_key, type: 'low', current: s.setting_value, threshold: s.warning_threshold_low })
            }
            if (s.warning_threshold_high && s.setting_value > s.warning_threshold_high) {
                newWarnings.push({ setting: s.setting_key, type: 'high', current: s.setting_value, threshold: s.warning_threshold_high })
            }
        })
        setWarnings(newWarnings)
    }

    // ===== EXPAND SETTING =====
    const expandSetting = (setting) => {
        if (expandedSetting?.setting_key === setting.setting_key) {
            setExpandedSetting(null)
            setEditingValue(null)
            setLastSavedValue(null)
        } else {
            setExpandedSetting(setting)
            setEditingValue(setting.setting_value)
            setLastSavedValue(setting.setting_value)
        }
    }

    // ===== RESET TO DEFAULT =====
    const resetToDefault = () => {
        if (expandedSetting) {
            setEditingValue(DEFAULTS[expandedSetting.setting_key])
        }
    }

    // ===== RESET TO LAST SAVED =====
    const resetToLastSaved = () => {
        setEditingValue(lastSavedValue)
    }

    // ===== SAVE SETTING =====
    const saveSetting = async () => {
        if (!expandedSetting) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('economy_settings')
                .update({ setting_value: editingValue, updated_at: new Date().toISOString() })
                .eq('setting_key', expandedSetting.setting_key)
            if (error) throw error

            const updatedSettings = settings.map(s =>
                s.setting_key === expandedSetting.setting_key ? { ...s, setting_value: editingValue } : s
            )
            setSettings(updatedSettings)
            checkWarnings(updatedSettings)
            setLastSavedValue(editingValue)
            calculateHealthScore(stats, updatedSettings)
            setMessage({ type: 'success', text: 'Saved!' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save' })
        } finally {
            setSaving(false)
        }
    }

    // ===== GET IMPACT =====
    const getImpact = (settingKey, newValue) => {
        const tokenValue = settingKey === 'token_value' ? newValue : (settings.find(s => s.setting_key === 'token_value')?.setting_value || 0.10)
        const campaignPrice = settingKey === 'campaign_price' ? newValue : (settings.find(s => s.setting_key === 'campaign_price')?.setting_value || 100)
        const viewsPerCampaign = settingKey === 'views_per_campaign' ? newValue : (settings.find(s => s.setting_key === 'views_per_campaign')?.setting_value || 500)

        switch (settingKey) {
            case 'token_value':
                return [
                    { label: '$10 merch costs', value: `🪙 ${Math.ceil(10 / newValue)}` },
                    { label: '$30 merch costs', value: `🪙 ${Math.ceil(30 / newValue)}` },
                    { label: 'User feel', value: newValue <= 0.10 ? '😊 Rewarding' : newValue <= 0.20 ? '😐 Moderate' : '😕 Slow earning' }
                ]
            case 'campaign_price':
                return [
                    { label: 'Value per view', value: `$${(newValue / viewsPerCampaign).toFixed(3)}` },
                    { label: 'Revenue/campaign', value: `$${newValue}` },
                    { label: 'Advertiser appeal', value: newValue <= 100 ? '📈 High' : newValue <= 150 ? '➡️ Medium' : '📉 Lower' }
                ]
            case 'views_per_campaign':
                return [
                    { label: 'Value per view', value: `$${(campaignPrice / newValue).toFixed(3)}` },
                    { label: 'Advertiser value', value: newValue >= 500 ? '👍 Great' : newValue >= 300 ? '👌 Good' : '👎 Low' },
                    { label: 'Fulfillment speed', value: newValue <= 300 ? '⚡ Fast' : newValue <= 600 ? '🚶 Normal' : '🐢 Slow' }
                ]
            case 'house_edge_percent':
                return [
                    { label: 'House keeps', value: `🪙 ${newValue} per 100 wagered` },
                    { label: 'Player return', value: `${100 - newValue}%` },
                    { label: 'Sustainability', value: newValue < 8 ? '🚨 LOSING MONEY' : newValue <= 15 ? '✅ Healthy' : '⚠️ High' }
                ]
            case 'max_free_spins_daily':
                return [
                    { label: 'Free spins/user/day', value: newValue },
                    { label: 'Est. free tokens/day', value: `~🪙 ${newValue * 2}` },
                    { label: 'Inflation risk', value: newValue <= 5 ? '✅ Low' : newValue <= 8 ? '⚠️ Medium' : '🚨 High' }
                ]
            case 'merch_markup_multiplier':
                return [
                    { label: '$10 cost item', value: `🪙 ${Math.ceil(10 * newValue)}` },
                    { label: '$25 cost item', value: `🪙 ${Math.ceil(25 * newValue)}` },
                    { label: 'Profit margin', value: newValue < 2 ? '🚨 LOSING' : newValue <= 4 ? '✅ Good' : '💰 High' }
                ]
            default:
                return []
        }
    }

    // ===== GET RECOMMENDATION =====
    const getRecommendation = (settingKey, newValue) => {
        const def = DEFAULTS[settingKey]
        const setting = settings.find(s => s.setting_key === settingKey)
        const low = setting?.warning_threshold_low
        const high = setting?.warning_threshold_high

        if (low && newValue < low) {
            return { type: 'danger', text: `⛔ Below safe minimum (${low}). This could harm your economy!` }
        }
        if (high && newValue > high) {
            return { type: 'danger', text: `⛔ Above safe maximum (${high}). This could cause problems!` }
        }
        if (newValue === def) {
            return { type: 'good', text: `✅ This is the recommended default value.` }
        }
        if (newValue === lastSavedValue) {
            return { type: 'neutral', text: `ℹ️ No change from current saved value.` }
        }

        switch (settingKey) {
            case 'token_value':
                if (newValue >= 0.05 && newValue <= 0.15) return { type: 'good', text: '✅ Great value! Users will feel rewarded.' }
                if (newValue > 0.15 && newValue <= 0.25) return { type: 'caution', text: '⚠️ Acceptable, but users may feel earning is slow.' }
                return { type: 'caution', text: '⚠️ Outside typical range. Test carefully.' }
            case 'campaign_price':
                if (newValue >= 75 && newValue <= 125) return { type: 'good', text: '✅ Good balance of revenue and advertiser appeal.' }
                if (newValue < 75) return { type: 'caution', text: '⚠️ Low price - make sure it covers your costs.' }
                return { type: 'caution', text: '⚠️ Higher price may reduce advertiser signups.' }
            case 'views_per_campaign':
                if (newValue >= 400 && newValue <= 600) return { type: 'good', text: '✅ Good value proposition for advertisers.' }
                return { type: 'caution', text: '⚠️ Consider how this affects advertiser satisfaction.' }
            case 'house_edge_percent':
                if (newValue >= 10 && newValue <= 12) return { type: 'good', text: '✅ Perfect! Fair for players, profitable for you.' }
                if (newValue >= 8 && newValue <= 15) return { type: 'good', text: '✅ Within healthy range.' }
                return { type: 'caution', text: '⚠️ Outside optimal range. Monitor closely.' }
            case 'max_free_spins_daily':
                if (newValue >= 3 && newValue <= 6) return { type: 'good', text: '✅ Good balance of engagement and economy health.' }
                return { type: 'caution', text: '⚠️ Monitor token circulation if you change this.' }
            case 'merch_markup_multiplier':
                if (newValue >= 2.5 && newValue <= 4) return { type: 'good', text: '✅ Good profit margin while staying fair.' }
                return { type: 'caution', text: '⚠️ Test to ensure profitability and user satisfaction.' }
            default:
                return { type: 'neutral', text: 'ℹ️ Change will take effect immediately.' }
        }
    }

    // ===== HELPERS =====
    const formatSettingName = (key) => EXPLANATIONS[key]?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    const getHealthColor = (score) => {
        if (score >= HEALTH_THRESHOLDS.excellent) return 'text-green-400'
        if (score >= HEALTH_THRESHOLDS.good) return 'text-blue-400'
        if (score >= HEALTH_THRESHOLDS.warning) return 'text-yellow-400'
        return 'text-red-400'
    }

    const getHealthBg = (score) => {
        if (score >= HEALTH_THRESHOLDS.excellent) return 'bg-green-500/20 border-green-500/30'
        if (score >= HEALTH_THRESHOLDS.good) return 'bg-blue-500/20 border-blue-500/30'
        if (score >= HEALTH_THRESHOLDS.warning) return 'bg-yellow-500/20 border-yellow-500/30'
        return 'bg-red-500/20 border-red-500/30'
    }

    const getHealthLabel = (score) => {
        if (score >= HEALTH_THRESHOLDS.excellent) return 'Excellent'
        if (score >= HEALTH_THRESHOLDS.good) return 'Good'
        if (score >= HEALTH_THRESHOLDS.warning) return 'Needs Attention'
        return 'Critical'
    }

    // ===== LOADING =====
    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    // ===== CALCULATED VALUES =====
    const tokenValue = settings.find(s => s.setting_key === 'token_value')?.setting_value || 0.10

    // ===== RENDER =====
    return (
        <div className="p-3">
            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-lg font-bold text-white">💰 Economy Dashboard</h1>
                    <p className="text-slate-400 text-xs">Monitor and manage your token economy</p>
                </div>
                <div className="flex items-center gap-2">
                    {message && (
                        <span className={`text-xs px-2 py-1 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </span>
                    )}
                    <button
                        onClick={loadAllData}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-1 mb-3">
                {['overview', 'alerts', 'settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === tab
                            ? 'bg-yellow-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab === 'overview' && '📊 '}
                        {tab === 'alerts' && `🔔 `}
                        {tab === 'settings' && '⚙️ '}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'alerts' && alerts.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                                {alerts.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ===== OVERVIEW TAB ===== */}
            {activeTab === 'overview' && (
                <div className="space-y-3">
                    {/* Health Score Card */}
                    <div className={`border rounded-lg p-4 ${getHealthBg(healthScore || 0)}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-white font-semibold text-sm">Economy Health Score</h2>
                                <p className="text-slate-400 text-xs">Overall health of your token economy</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-4xl font-bold ${getHealthColor(healthScore || 0)}`}>
                                    {healthScore !== null ? healthScore : '—'}
                                </p>
                                <p className={`text-xs ${getHealthColor(healthScore || 0)}`}>
                                    {healthScore !== null ? getHealthLabel(healthScore) : 'Calculating...'}
                                </p>
                            </div>
                        </div>

                        {/* Health Factors */}
                        {healthFactors.length > 0 && (
                            <div className="grid grid-cols-5 gap-2">
                                {healthFactors.map((factor, i) => (
                                    <div key={i} className="bg-slate-800/50 rounded p-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-slate-400 text-[10px]">{factor.name}</span>
                                            <span className={`text-[10px] font-bold ${factor.status === 'good' ? 'text-green-400' :
                                                factor.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {factor.score}
                                            </span>
                                        </div>
                                        <p className="text-white text-xs font-medium">{factor.value}</p>
                                        <p className="text-slate-500 text-[10px] mt-1">{factor.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-slate-800 border border-slate-700 rounded p-3">
                            <p className="text-slate-400 text-[10px]">In Circulation</p>
                            <p className="text-yellow-400 font-bold text-lg">🪙 {stats?.totalInCirculation?.toLocaleString() || 0}</p>
                            <p className="text-slate-500 text-[10px]">${((stats?.totalInCirculation || 0) * tokenValue).toFixed(2)} value</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded p-3">
                            <p className="text-slate-400 text-[10px]">Total Issued</p>
                            <p className="text-green-400 font-bold text-lg">🪙 {stats?.totalEverIssued?.toLocaleString() || 0}</p>
                            <p className="text-slate-500 text-[10px]">Lifetime earned by users</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded p-3">
                            <p className="text-slate-400 text-[10px]">Total Burned</p>
                            <p className="text-red-400 font-bold text-lg">🔥 {stats?.totalBurned?.toLocaleString() || 0}</p>
                            <p className="text-slate-500 text-[10px]">
                                {stats?.totalEverIssued > 0
                                    ? `${((stats.totalBurned / stats.totalEverIssued) * 100).toFixed(1)}% burn rate`
                                    : 'No activity yet'}
                            </p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded p-3">
                            <p className="text-slate-400 text-[10px]">Active Campaigns</p>
                            <p className="text-blue-400 font-bold text-lg">📢 {stats?.activeCampaigns || 0}</p>
                            <p className="text-slate-500 text-[10px]">Generating revenue</p>
                        </div>
                    </div>

                    {/* Trends Section */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h3 className="text-white font-semibold text-sm mb-2">📈 7-Day Trends</h3>
                        {trends?.hasData ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-700/50 rounded p-2">
                                        <p className="text-slate-400 text-[10px]">Tokens Earned</p>
                                        <p className="text-green-400 font-bold">🪙 {trends.last7Days.earned.toLocaleString()}</p>
                                        <p className={`text-[10px] ${parseFloat(trends.earnedChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {parseFloat(trends.earnedChange) >= 0 ? '↑' : '↓'} {Math.abs(trends.earnedChange)}% vs last week
                                        </p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded p-2">
                                        <p className="text-slate-400 text-[10px]">Tokens Spent</p>
                                        <p className="text-red-400 font-bold">🪙 {trends.last7Days.spent.toLocaleString()}</p>
                                        <p className={`text-[10px] ${parseFloat(trends.spentChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {parseFloat(trends.spentChange) >= 0 ? '↑' : '↓'} {Math.abs(trends.spentChange)}% vs last week
                                        </p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded p-2">
                                        <p className="text-slate-400 text-[10px]">Net Change</p>
                                        <p className={`font-bold ${trends.last7Days.net >= 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
                                            {trends.last7Days.net >= 0 ? '+' : ''}{trends.last7Days.net.toLocaleString()}
                                        </p>
                                        <p className="text-slate-500 text-[10px]">
                                            {trends.last7Days.net >= 0 ? 'Circulation growing' : 'Circulation shrinking'}
                                        </p>
                                    </div>
                                </div>

                                {/* Simple Bar Chart */}
                                <div className="mt-2">
                                    <p className="text-slate-400 text-[10px] mb-2">Daily Activity</p>
                                    <div className="flex items-end gap-1 h-16">
                                        {trends.dailyData.map((day, i) => {
                                            const maxVal = Math.max(...trends.dailyData.map(d => Math.max(d.earned, d.spent)), 1)
                                            const earnedHeight = (day.earned / maxVal) * 100
                                            const spentHeight = (day.spent / maxVal) * 100
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                                    <div className="w-full flex gap-0.5 items-end h-12">
                                                        <div
                                                            className="flex-1 bg-green-500/50 rounded-t"
                                                            style={{ height: `${earnedHeight}%`, minHeight: day.earned > 0 ? '4px' : '0' }}
                                                            title={`Earned: ${day.earned}`}
                                                        />
                                                        <div
                                                            className="flex-1 bg-red-500/50 rounded-t"
                                                            style={{ height: `${spentHeight}%`, minHeight: day.spent > 0 ? '4px' : '0' }}
                                                            title={`Spent: ${day.spent}`}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-slate-500">{day.day}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="flex gap-3 mt-1 justify-center">
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-500/50 rounded"></span> Earned
                                        </span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-red-500/50 rounded"></span> Spent
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-slate-500 text-sm">📊 {trends?.message || 'No trend data available yet'}</p>
                                <p className="text-slate-600 text-xs mt-1">Trends will appear once token activity begins</p>
                            </div>
                        )}
                    </div>

                    {/* Projections */}
                    {projections && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <h3 className="text-white font-semibold text-sm mb-2">🔮 Projections</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Circulation Value</p>
                                    <p className="text-yellow-400 font-bold">${projections.circulationValue}</p>
                                    <p className="text-slate-500 text-[10px]">Real $ value in user hands</p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Est. Daily Issuance</p>
                                    <p className="text-green-400 font-bold">~🪙 {projections.estimatedDailyIssuance}</p>
                                    <p className="text-slate-500 text-[10px]">${projections.estimatedDailyIssuanceValue}/day</p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Growth Rate</p>
                                    <p className="text-blue-400 font-bold">
                                        {projections.daysUntilCirculationDoubles
                                            ? `~${projections.daysUntilCirculationDoubles} days`
                                            : 'N/A'}
                                    </p>
                                    <p className="text-slate-500 text-[10px]">Until circulation doubles</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== ALERTS TAB ===== */}
            {activeTab === 'alerts' && (
                <div className="space-y-3">
                    {/* Settings Warnings */}
                    {warnings.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <h3 className="text-red-400 font-semibold text-sm mb-2">⚠️ Settings Warnings</h3>
                            <div className="space-y-2">
                                {warnings.map((w, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                                        <div>
                                            <p className="text-white text-sm">{formatSettingName(w.setting)}</p>
                                            <p className="text-slate-400 text-xs">
                                                Current: {w.current} • {w.type === 'low' ? 'Minimum' : 'Maximum'}: {w.threshold}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { setActiveTab('settings'); }}
                                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                                        >
                                            Fix →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Smart Alerts */}
                    {alerts.length > 0 ? (
                        <div className="space-y-2">
                            {alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    className={`border rounded-lg p-3 ${alert.type === 'urgent' ? 'bg-red-500/10 border-red-500/30' :
                                        alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                            'bg-blue-500/10 border-blue-500/30'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${alert.type === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                                    alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {alert.category}
                                                </span>
                                                <h4 className="text-white font-medium text-sm">{alert.title}</h4>
                                            </div>
                                            <p className="text-slate-300 text-xs mb-1">{alert.message}</p>
                                            <p className="text-slate-500 text-[10px]">💡 {alert.action}</p>
                                        </div>
                                        {alert.link && (
                                            <a
                                                href={alert.link}
                                                className={`px-2 py-1 rounded text-xs ${alert.type === 'urgent' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                                                    alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' :
                                                        'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                                    }`}
                                            >
                                                View →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : warnings.length === 0 ? (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                            <span className="text-4xl">✅</span>
                            <h3 className="text-green-400 font-semibold mt-2">All Clear!</h3>
                            <p className="text-slate-400 text-sm">No alerts or warnings at this time.</p>
                        </div>
                    ) : null}

                    {/* Alert Legend */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h4 className="text-slate-400 text-xs font-medium mb-2">Alert Types</h4>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 rounded bg-red-500"></span>
                                <span className="text-slate-400">Urgent - Needs immediate action</span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 rounded bg-yellow-500"></span>
                                <span className="text-slate-400">Warning - Should address soon</span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 rounded bg-blue-500"></span>
                                <span className="text-slate-400">Info - Worth reviewing</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SETTINGS TAB ===== */}
            {activeTab === 'settings' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-700 bg-slate-700/50">
                        <h2 className="text-white font-semibold text-sm">⚙️ Economy Settings</h2>
                        <p className="text-slate-400 text-xs">Click any setting to edit and see impact preview</p>
                    </div>

                    <div className="divide-y divide-slate-700">
                        {settings.map(s => {
                            const hasWarning = warnings.some(w => w.setting === s.setting_key)
                            const isExpanded = expandedSetting?.setting_key === s.setting_key
                            const explanation = EXPLANATIONS[s.setting_key] || {}
                            const defaultValue = DEFAULTS[s.setting_key]
                            const impact = isExpanded ? getImpact(s.setting_key, editingValue) : []
                            const recommendation = isExpanded ? getRecommendation(s.setting_key, editingValue) : null

                            return (
                                <div key={s.setting_key}>
                                    {/* Collapsed Row */}
                                    <div
                                        onClick={() => expandSetting(s)}
                                        className={`p-3 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'} ${hasWarning && !isExpanded ? 'bg-red-500/10' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs ${isExpanded ? 'rotate-90' : ''} transition-transform`}>▶</span>
                                                <div>
                                                    <span className={`font-medium text-sm ${hasWarning ? 'text-red-400' : 'text-white'}`}>
                                                        {hasWarning && '⚠️ '}{formatSettingName(s.setting_key)}
                                                    </span>
                                                    <p className="text-slate-500 text-xs">{explanation.what?.substring(0, 60)}...</p>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded font-bold text-sm ${hasWarning ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}>
                                                {s.setting_value}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Section */}
                                    {isExpanded && (
                                        <div className="p-3 bg-slate-900/50 border-t border-slate-600">
                                            {/* Explanation */}
                                            <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                                <p className="text-blue-400 font-medium text-xs mb-1">📖 {explanation.title}</p>
                                                <p className="text-slate-300 text-xs mb-1"><strong>What:</strong> {explanation.what}</p>
                                                <p className="text-slate-300 text-xs mb-1"><strong>Why it matters:</strong> {explanation.why}</p>
                                                <p className="text-slate-300 text-xs"><strong>💡 Tip:</strong> {explanation.tip}</p>
                                            </div>

                                            {/* Value Controls */}
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <div className="bg-slate-800 rounded p-2 text-center">
                                                    <p className="text-[10px] text-slate-400 mb-1">Default</p>
                                                    <p className="text-slate-300 font-bold text-sm">{defaultValue}</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); resetToDefault(); }}
                                                        className="mt-1 text-[10px] text-blue-400 hover:text-blue-300"
                                                    >
                                                        Reset to default
                                                    </button>
                                                </div>
                                                <div className="bg-slate-800 rounded p-2 text-center">
                                                    <p className="text-[10px] text-slate-400 mb-1">Last Saved</p>
                                                    <p className="text-slate-300 font-bold text-sm">{lastSavedValue}</p>
                                                    {editingValue !== lastSavedValue && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); resetToLastSaved(); }}
                                                            className="mt-1 text-[10px] text-blue-400 hover:text-blue-300"
                                                        >
                                                            Undo changes
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-center">
                                                    <p className="text-[10px] text-yellow-400 mb-1">New Value</p>
                                                    <input
                                                        type="number"
                                                        step={s.setting_key === 'token_value' || s.setting_key === 'merch_markup_multiplier' ? '0.01' : '1'}
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(parseFloat(e.target.value) || 0)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-yellow-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Impact Preview */}
                                            <div className="mb-3">
                                                <p className="text-slate-400 text-xs mb-2">📊 Impact at this value:</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {impact.map((item, i) => (
                                                        <div key={i} className="bg-slate-800 rounded p-2 text-center">
                                                            <p className="text-[10px] text-slate-400">{item.label}</p>
                                                            <p className="text-white text-xs font-medium">{item.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Recommendation */}
                                            {recommendation && (
                                                <div className={`mb-3 p-2 rounded text-xs ${recommendation.type === 'danger' ? 'bg-red-500/20 border border-red-500 text-red-300' :
                                                    recommendation.type === 'good' ? 'bg-green-500/20 border border-green-500 text-green-300' :
                                                        recommendation.type === 'caution' ? 'bg-orange-500/20 border border-orange-500 text-orange-300' :
                                                            'bg-slate-700 text-slate-300'
                                                    }`}>
                                                    <strong>Suggestion:</strong> {recommendation.text}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); expandSetting(s); }}
                                                    className="flex-1 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-600"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); saveSetting(); }}
                                                    disabled={saving || editingValue === lastSavedValue}
                                                    className={`flex-1 py-2 rounded text-sm font-medium disabled:opacity-50 ${recommendation?.type === 'danger'
                                                        ? 'bg-red-600 hover:bg-red-500 text-white'
                                                        : recommendation?.type === 'caution'
                                                            ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                                        }`}
                                                >
                                                    {saving ? 'Saving...' : editingValue === lastSavedValue ? 'No Changes' : recommendation?.type === 'danger' ? '⚠️ Save Anyway' : 'Save Change'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
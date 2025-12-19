'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== ECONOMY DASHBOARD =====
// Central hub for token economy health, settings, and warnings

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

export default function EconomyDashboardPage() {
    // ===== STATE =====
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState([])
    const [stats, setStats] = useState(null)
    const [warnings, setWarnings] = useState([])
    const [message, setMessage] = useState(null)

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
        await Promise.all([loadSettings(), loadStats()])
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
            const { data: balances } = await supabase.from('bb_balances').select('balance, total_earned')
            const totalInCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalEverIssued = balances?.reduce((sum, b) => sum + (b.total_earned || 0), 0) || 0
            const { data: campaigns } = await supabase.from('ad_campaigns').select('id').eq('status', 'active')
            setStats({
                totalInCirculation,
                totalEverIssued,
                totalBurned: totalEverIssued - totalInCirculation,
                activeCampaigns: campaigns?.length || 0
            })
        } catch (error) {
            console.error('Error loading stats:', error)
        }
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

        // Setting-specific suggestions
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
    const campaignPrice = settings.find(s => s.setting_key === 'campaign_price')?.setting_value || 100
    const viewsPerCampaign = settings.find(s => s.setting_key === 'views_per_campaign')?.setting_value || 500

    // ===== RENDER =====
    return (
        <div className="p-3">
            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-bold text-white">💰 Economy Dashboard</h1>
                <div className="flex items-center gap-2">
                    {warnings.length === 0 ? (
                        <span className="text-green-400 text-xs">✓ All settings healthy</span>
                    ) : (
                        <span className="text-red-400 text-xs">⚠️ {warnings.length} issue{warnings.length > 1 ? 's' : ''}</span>
                    )}
                    {message && (
                        <span className={`text-xs px-2 py-1 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </span>
                    )}
                </div>
            </div>

            {/* ===== HEALTH STATS ===== */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-slate-800 border border-slate-700 rounded p-2 text-center">
                    <p className="text-[10px] text-slate-400">Circulation</p>
                    <p className="text-yellow-400 font-bold text-sm">🪙 {stats?.totalInCirculation?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2 text-center">
                    <p className="text-[10px] text-slate-400">Total Issued</p>
                    <p className="text-green-400 font-bold text-sm">🪙 {stats?.totalEverIssued?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2 text-center">
                    <p className="text-[10px] text-slate-400">Burned</p>
                    <p className="text-red-400 font-bold text-sm">🔥 {stats?.totalBurned?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2 text-center">
                    <p className="text-[10px] text-slate-400">Active Campaigns</p>
                    <p className="text-blue-400 font-bold text-sm">📢 {stats?.activeCampaigns || 0}</p>
                </div>
            </div>

            {/* ===== SETTINGS LIST ===== */}
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
                                {/* ===== COLLAPSED ROW ===== */}
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

                                {/* ===== EXPANDED SECTION ===== */}
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
        </div>
    )
}
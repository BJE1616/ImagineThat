'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== ECONOMY DASHBOARD =====
// Central hub for token economy health, settings, and warnings
// IMPORTANT: Changes here affect the entire token economy!

export default function EconomyDashboardPage() {
    // ===== STATE =====
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState([])
    const [originalSettings, setOriginalSettings] = useState([])
    const [stats, setStats] = useState(null)
    const [warnings, setWarnings] = useState([])
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)
    const [showDocs, setShowDocs] = useState(false)

    // ===== EDITING STATE =====
    const [editingSetting, setEditingSetting] = useState(null)
    const [editingValue, setEditingValue] = useState(null)

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
            setOriginalSettings(data || [])
            checkWarnings(data || [])
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    // ===== LOAD ECONOMY STATS =====
    const loadStats = async () => {
        try {
            const { data: balances } = await supabase
                .from('bb_balances')
                .select('balance, total_earned')

            const totalInCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
            const totalEverIssued = balances?.reduce((sum, b) => sum + (b.total_earned || 0), 0) || 0

            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id')
                .eq('status', 'active')

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

    // ===== GET IMPACT PREVIEW =====
    const getImpactPreview = (settingKey, newValue) => {
        const currentSettings = {}
        originalSettings.forEach(s => { currentSettings[s.setting_key] = s.setting_value })

        const oldValue = currentSettings[settingKey]
        currentSettings[settingKey] = newValue

        const tokenValue = currentSettings['token_value'] || 0.10
        const campaignPrice = currentSettings['campaign_price'] || 100
        const viewsPerCampaign = currentSettings['views_per_campaign'] || 500

        const isIncrease = newValue > oldValue
        const changeDirection = isIncrease ? '📈 Increasing' : '📉 Decreasing'

        switch (settingKey) {
            case 'token_value':
                const oldMerch10 = Math.ceil(10 / oldValue)
                const newMerch10 = Math.ceil(10 / newValue)
                const oldMerch30 = Math.ceil(30 / oldValue)
                const newMerch30 = Math.ceil(30 / newValue)
                return {
                    title: 'Token Value',
                    change: `${changeDirection} from $${oldValue} to $${newValue}`,
                    impacts: [
                        {
                            label: '$10 merch item cost',
                            before: `🪙 ${oldMerch10}`,
                            after: `🪙 ${newMerch10}`,
                            good: newMerch10 >= oldMerch10
                        },
                        {
                            label: '$30 merch item cost',
                            before: `🪙 ${oldMerch30}`,
                            after: `🪙 ${newMerch30}`,
                            good: newMerch30 >= oldMerch30
                        },
                        {
                            label: 'User perception',
                            before: '',
                            after: newValue < oldValue ? '😊 Earn MORE tokens (feels rewarding!)' : '😐 Earn FEWER tokens',
                            good: newValue <= oldValue
                        }
                    ],
                    recommendation: newValue >= 0.05 && newValue <= 0.20
                        ? '✅ Good value! Within recommended range.'
                        : newValue < 0.05
                            ? '⚠️ Very low - users may earn too many tokens'
                            : '⚠️ High value - users may feel unrewarded',
                    risk: newValue < 0.05 || newValue > 0.50 ? 'high' : newValue > 0.20 ? 'medium' : 'low'
                }

            case 'campaign_price':
                const oldVPV = oldValue / viewsPerCampaign
                const newVPV = newValue / viewsPerCampaign
                return {
                    title: 'Campaign Price',
                    change: `${changeDirection} from $${oldValue} to $${newValue}`,
                    impacts: [
                        {
                            label: 'Value per ad view',
                            before: `$${oldVPV.toFixed(3)}`,
                            after: `$${newVPV.toFixed(3)}`,
                            good: newVPV >= oldVPV
                        },
                        {
                            label: 'Revenue per campaign',
                            before: `$${oldValue}`,
                            after: `$${newValue}`,
                            good: newValue >= oldValue
                        },
                        {
                            label: 'Advertiser appeal',
                            before: '',
                            after: newValue > oldValue ? '📉 Higher price may reduce signups' : '📈 Lower price attracts more advertisers',
                            good: newValue <= oldValue
                        }
                    ],
                    recommendation: newValue >= 50 && newValue <= 200
                        ? '✅ Good price! Balanced revenue and value.'
                        : newValue < 50
                            ? '⚠️ Low price - may not cover costs'
                            : '⚠️ High price - may deter advertisers',
                    risk: newValue < 50 ? 'high' : newValue > 200 ? 'medium' : 'low'
                }

            case 'views_per_campaign':
                const oldVPV2 = campaignPrice / oldValue
                const newVPV2 = campaignPrice / newValue
                return {
                    title: 'Views Per Campaign',
                    change: `${changeDirection} from ${oldValue} to ${newValue}`,
                    impacts: [
                        {
                            label: 'Value per view',
                            before: `$${oldVPV2.toFixed(3)}`,
                            after: `$${newVPV2.toFixed(3)}`,
                            good: true
                        },
                        {
                            label: 'Advertiser value',
                            before: `${oldValue} guaranteed views`,
                            after: `${newValue} guaranteed views`,
                            good: newValue >= oldValue
                        },
                        {
                            label: 'Campaign fulfillment',
                            before: '',
                            after: newValue > oldValue ? '⏱️ Takes longer to fulfill' : '⚡ Faster fulfillment',
                            good: true
                        }
                    ],
                    recommendation: newValue >= 200 && newValue <= 1000
                        ? '✅ Good balance of value and fulfillment speed.'
                        : newValue < 200
                            ? '⚠️ Low views - advertisers may feel shortchanged'
                            : '⚠️ Very high - may take long to fulfill',
                    risk: newValue < 200 ? 'medium' : 'low'
                }

            case 'house_edge_percent':
                const playerReturn = 100 - newValue
                const oldReturn = 100 - oldValue
                return {
                    title: 'House Edge %',
                    change: `${changeDirection} from ${oldValue}% to ${newValue}%`,
                    impacts: [
                        {
                            label: 'House keeps (per 100 wagered)',
                            before: `🪙 ${oldValue}`,
                            after: `🪙 ${newValue}`,
                            good: newValue >= 8
                        },
                        {
                            label: 'Player wins back',
                            before: `${oldReturn}%`,
                            after: `${playerReturn}%`,
                            good: playerReturn >= 80 && playerReturn <= 92
                        },
                        {
                            label: 'Sustainability',
                            before: '',
                            after: newValue < 8 ? '🚨 HOUSE LOSES MONEY!' : newValue > 20 ? '😤 Players may feel cheated' : '✅ Sustainable profit',
                            good: newValue >= 8 && newValue <= 20
                        }
                    ],
                    recommendation: newValue >= 8 && newValue <= 15
                        ? '✅ Perfect! Fair for players, profitable for house.'
                        : newValue < 8
                            ? '🚨 DANGER: House will lose money over time!'
                            : newValue <= 20
                                ? '⚠️ Slightly high but acceptable'
                                : '🚨 Too high - players will stop playing',
                    risk: newValue < 8 ? 'high' : newValue > 20 ? 'high' : newValue > 15 ? 'medium' : 'low'
                }

            case 'max_free_spins_daily':
                const estimatedFreeTokens = newValue * 2
                const oldFreeTokens = oldValue * 2
                return {
                    title: 'Max Free Spins Daily',
                    change: `${changeDirection} from ${oldValue} to ${newValue}`,
                    impacts: [
                        {
                            label: 'Free spins per user/day',
                            before: `${oldValue}`,
                            after: `${newValue}`,
                            good: true
                        },
                        {
                            label: 'Est. free tokens/user/day',
                            before: `~🪙 ${oldFreeTokens}`,
                            after: `~🪙 ${estimatedFreeTokens}`,
                            good: estimatedFreeTokens <= 16
                        },
                        {
                            label: 'User engagement',
                            before: '',
                            after: newValue > oldValue ? '📈 More engagement, more inflation' : '📉 Less freebies, less inflation',
                            good: newValue <= 8
                        }
                    ],
                    recommendation: newValue >= 3 && newValue <= 8
                        ? '✅ Good balance of engagement and economy control.'
                        : newValue < 3
                            ? '⚠️ Very few - may hurt engagement'
                            : '🚨 High inflation risk! Tokens given away too freely',
                    risk: newValue > 10 ? 'high' : newValue > 8 ? 'medium' : 'low'
                }

            case 'merch_markup_multiplier':
                const old10Item = Math.ceil(10 * oldValue)
                const new10Item = Math.ceil(10 * newValue)
                const old25Item = Math.ceil(25 * oldValue)
                const new25Item = Math.ceil(25 * newValue)
                return {
                    title: 'Merch Markup Multiplier',
                    change: `${changeDirection} from ${oldValue}x to ${newValue}x`,
                    impacts: [
                        {
                            label: '$10 cost item price',
                            before: `🪙 ${old10Item}`,
                            after: `🪙 ${new10Item}`,
                            good: newValue >= 2
                        },
                        {
                            label: '$25 cost item price',
                            before: `🪙 ${old25Item}`,
                            after: `🪙 ${new25Item}`,
                            good: newValue >= 2
                        },
                        {
                            label: 'Profitability',
                            before: '',
                            after: newValue < 2 ? '🚨 May LOSE money on merch!' : newValue > 5 ? '💰 High profit, harder to redeem' : '✅ Good profit margin',
                            good: newValue >= 2 && newValue <= 5
                        }
                    ],
                    recommendation: newValue >= 2 && newValue <= 5
                        ? '✅ Good markup! Profitable without being unfair.'
                        : newValue < 2
                            ? '🚨 DANGER: You may lose money on every redemption!'
                            : '⚠️ Very high - merch may feel unreachable',
                    risk: newValue < 2 ? 'high' : newValue > 5 ? 'medium' : 'low'
                }

            default:
                return {
                    title: formatSettingName(settingKey),
                    change: `Changing from ${oldValue} to ${newValue}`,
                    impacts: [],
                    recommendation: 'No specific guidance available.',
                    risk: 'low'
                }
        }
    }

    // ===== START EDITING =====
    const startEditing = (setting) => {
        setEditingSetting(setting)
        setEditingValue(setting.setting_value)
    }

    // ===== CANCEL EDITING =====
    const cancelEditing = () => {
        setEditingSetting(null)
        setEditingValue(null)
    }

    // ===== SAVE SETTING =====
    const saveSetting = async () => {
        if (!editingSetting) return

        setSaving(editingSetting.setting_key)
        try {
            const { error } = await supabase
                .from('economy_settings')
                .update({ setting_value: editingValue, updated_at: new Date().toISOString() })
                .eq('setting_key', editingSetting.setting_key)

            if (error) throw error

            const updatedSettings = settings.map(s =>
                s.setting_key === editingSetting.setting_key ? { ...s, setting_value: editingValue } : s
            )
            setSettings(updatedSettings)
            setOriginalSettings(updatedSettings)
            checkWarnings(updatedSettings)
            setMessage({ type: 'success', text: 'Saved!' })
            setTimeout(() => setMessage(null), 2000)
            cancelEditing()
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save' })
        } finally {
            setSaving(null)
        }
    }

    // ===== HELPERS =====
    const formatSettingName = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

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
    const valuePerView = campaignPrice / viewsPerCampaign
    const tokensPerView = valuePerView / tokenValue

    // ===== CURRENT IMPACT PREVIEW =====
    const currentImpact = editingSetting ? getImpactPreview(editingSetting.setting_key, editingValue) : null

    // ===== RENDER =====
    return (
        <div className="p-3">
            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-bold text-white">💰 Economy Dashboard</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDocs(!showDocs)}
                        className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                    >
                        📖 {showDocs ? 'Hide' : 'Show'} Docs
                    </button>
                    {warnings.length === 0 && <span className="text-green-400 text-xs">✓ Healthy</span>}
                    {message && (
                        <span className={`text-xs ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {message.text}
                        </span>
                    )}
                </div>
            </div>

            {/* ===== DOCUMENTATION ===== */}
            {showDocs && (
                <div className="mb-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs">
                    <h3 className="text-blue-400 font-bold mb-2">📖 Quick Reference</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300">
                        <div><strong className="text-yellow-400">Token Value:</strong> $ per token. Lower = more tokens earned.</div>
                        <div><strong className="text-yellow-400">Campaign Price:</strong> What advertisers pay. Funds everything.</div>
                        <div><strong className="text-yellow-400">Views/Campaign:</strong> Guaranteed views per campaign.</div>
                        <div><strong className="text-yellow-400">House Edge:</strong> Slot profit %. Below 8% = lose money!</div>
                        <div><strong className="text-yellow-400">Free Spins:</strong> Daily freebies. Too many = inflation.</div>
                        <div><strong className="text-yellow-400">Markup:</strong> Merch pricing. Below 2x = lose money!</div>
                    </div>
                </div>
            )}

            {/* ===== WARNINGS BANNER ===== */}
            {warnings.length > 0 && (
                <div className="mb-2 p-2 bg-red-500/20 border-2 border-red-500 rounded-lg">
                    <p className="text-red-400 font-bold text-xs">🚨 Economy Issues:</p>
                    {warnings.map((w, i) => (
                        <span key={i} className="text-red-300 text-xs mr-3">
                            {formatSettingName(w.setting)}: {w.current} ({w.type === 'low' ? 'too low' : 'too high'})
                        </span>
                    ))}
                </div>
            )}

            {/* ===== HEALTH + CALCULATED ROW ===== */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                    <h2 className="text-white font-semibold text-xs mb-2">📊 Health</h2>
                    <div className="grid grid-cols-4 gap-1 text-center">
                        <div><p className="text-[10px] text-slate-400">Circulation</p><p className="text-yellow-400 font-bold text-xs">🪙{stats?.totalInCirculation || 0}</p></div>
                        <div><p className="text-[10px] text-slate-400">Issued</p><p className="text-green-400 font-bold text-xs">🪙{stats?.totalEverIssued || 0}</p></div>
                        <div><p className="text-[10px] text-slate-400">Burned</p><p className="text-red-400 font-bold text-xs">🔥{stats?.totalBurned || 0}</p></div>
                        <div><p className="text-[10px] text-slate-400">Campaigns</p><p className="text-blue-400 font-bold text-xs">📢{stats?.activeCampaigns || 0}</p></div>
                    </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                    <h2 className="text-white font-semibold text-xs mb-2">🧮 Calculated</h2>
                    <div className="grid grid-cols-4 gap-1 text-center">
                        <div><p className="text-[10px] text-slate-400">$/View</p><p className="text-blue-400 font-bold text-xs">${valuePerView.toFixed(3)}</p></div>
                        <div><p className="text-[10px] text-slate-400">Tok/View</p><p className="text-yellow-400 font-bold text-xs">🪙{tokensPerView.toFixed(1)}</p></div>
                        <div><p className="text-[10px] text-slate-400">$10 Item</p><p className="text-green-400 font-bold text-xs">🪙{Math.ceil(10 / tokenValue)}</p></div>
                        <div><p className="text-[10px] text-slate-400">$30 Item</p><p className="text-purple-400 font-bold text-xs">🪙{Math.ceil(30 / tokenValue)}</p></div>
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT: SETTINGS + PREVIEW ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* ===== SETTINGS TABLE ===== */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-700 bg-slate-700/50">
                        <h2 className="text-white font-semibold text-sm">⚙️ Settings <span className="text-slate-400 text-xs">(click to edit)</span></h2>
                    </div>
                    <div className="divide-y divide-slate-700">
                        {settings.map(s => {
                            const hasWarning = warnings.some(w => w.setting === s.setting_key)
                            const isEditing = editingSetting?.setting_key === s.setting_key
                            return (
                                <div
                                    key={s.setting_key}
                                    onClick={() => !isEditing && startEditing(s)}
                                    className={`p-2 cursor-pointer hover:bg-slate-700/50 transition-colors ${isEditing ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''} ${hasWarning ? 'bg-red-500/10' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className={`font-medium text-xs ${hasWarning ? 'text-red-400' : 'text-white'}`}>
                                                {hasWarning && '⚠️ '}{formatSettingName(s.setting_key)}
                                            </span>
                                            <p className="text-slate-500 text-[10px]">{s.description}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-sm font-bold ${hasWarning ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}>
                                            {s.setting_value}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ===== IMPACT PREVIEW PANEL ===== */}
                <div className={`bg-slate-800 border rounded-lg overflow-hidden ${currentImpact ? (currentImpact.risk === 'high' ? 'border-red-500' : currentImpact.risk === 'medium' ? 'border-orange-500' : 'border-green-500') : 'border-slate-700'}`}>
                    {!editingSetting ? (
                        <div className="p-4 text-center text-slate-400">
                            <p className="text-lg mb-1">👆</p>
                            <p className="text-sm">Click a setting to see impact preview</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className={`p-2 border-b ${currentImpact.risk === 'high' ? 'bg-red-500/20 border-red-500' : currentImpact.risk === 'medium' ? 'bg-orange-500/20 border-orange-500' : 'bg-green-500/20 border-green-500'}`}>
                                <h2 className="text-white font-semibold text-sm">{currentImpact.title}</h2>
                                <p className="text-slate-300 text-xs">{currentImpact.change}</p>
                            </div>

                            {/* Value Editor */}
                            <div className="p-3 border-b border-slate-700 bg-slate-700/30">
                                <div className="flex items-center gap-3">
                                    <label className="text-slate-400 text-xs">New Value:</label>
                                    <input
                                        type="number"
                                        step={editingSetting.setting_key === 'token_value' || editingSetting.setting_key === 'merch_markup_multiplier' ? '0.01' : '1'}
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(parseFloat(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:border-yellow-500"
                                        autoFocus
                                    />
                                    <span className="text-slate-500 text-xs">
                                        Range: {editingSetting.min_value} - {editingSetting.max_value}
                                    </span>
                                </div>
                            </div>

                            {/* Impact Details */}
                            <div className="p-3">
                                <p className="text-slate-400 text-xs mb-2">What this change will do:</p>
                                <div className="space-y-2">
                                    {currentImpact.impacts.map((impact, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs bg-slate-700/30 rounded p-2">
                                            <span className="text-slate-300">{impact.label}</span>
                                            <div className="flex items-center gap-2">
                                                {impact.before && <span className="text-slate-500">{impact.before}</span>}
                                                {impact.before && <span className="text-slate-600">→</span>}
                                                <span className={impact.good ? 'text-green-400' : 'text-orange-400'}>{impact.after}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Recommendation */}
                                <div className={`mt-3 p-2 rounded text-xs ${currentImpact.risk === 'high' ? 'bg-red-500/20 text-red-300' : currentImpact.risk === 'medium' ? 'bg-orange-500/20 text-orange-300' : 'bg-green-500/20 text-green-300'}`}>
                                    {currentImpact.recommendation}
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={cancelEditing}
                                        className="flex-1 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveSetting}
                                        disabled={saving}
                                        className={`flex-1 py-2 rounded text-sm font-medium ${currentImpact.risk === 'high'
                                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                                : currentImpact.risk === 'medium'
                                                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                            }`}
                                    >
                                        {saving ? 'Saving...' : currentImpact.risk === 'high' ? '⚠️ Save Anyway' : 'Save Change'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
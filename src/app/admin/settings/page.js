'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import Tooltip from '@/components/Tooltip'

// ===== TOOLTIP CONTENT =====
const TIPS = {
    // Theme
    colorTheme: "Changes the look of the entire platform. Affects all users. Use arrow keys to preview before saving.",

    // Email
    emailTestMode: "When ON, all emails go to the test recipient only. Turn OFF for production to send real emails to users.",
    testRecipient: "The email address that receives all emails when Test Mode is ON.",

    // Ad Campaign
    adPrice: "What advertisers pay for one campaign. This is your primary revenue source. Typical range: $75-$150.",
    guaranteedViews: "How many ad views each campaign receives. Higher = better value for advertisers, slower fulfillment.",

    // Matrix
    matrixPayout: "Amount paid to users when they complete their matrix (fill all 7 spots). Funded by their referrals' ad purchases.",

    // Card Back
    showAdvertiserCards: "When ON, random advertiser cards appear on card backs during games. When OFF, your company logo shows.",
    companyLogo: "Your logo shown on card backs when 'Show Advertiser Cards' is OFF. Recommended: square image, 200x200px or larger."
}

// Default values and recommended ranges for slot settings
const slotDefaults = {
    slot_jackpot_chance: { default: '2', min: 1, max: 3, label: 'Jackpot Chance' },
    slot_triple_chance: { default: '8', min: 5, max: 10, label: 'Triple Chance' },
    slot_pair_chance: { default: '25', min: 20, max: 30, label: 'Pair Chance' },
    slot_jackpot_tokens: { default: '100', min: 50, max: 150, label: 'Jackpot Tokens' },
    slot_jackpot_tickets: { default: '25', min: 10, max: 50, label: 'Jackpot Tickets' },
    slot_triple_tokens: { default: '25', min: 15, max: 40, label: 'Triple Tokens' },
    slot_triple_tickets: { default: '5', min: 3, max: 10, label: 'Triple Tickets' },
    slot_pair_tokens: { default: '5', min: 3, max: 10, label: 'Pair Tokens' },
    slot_lose_tokens: { default: '1', min: 1, max: 3, label: 'Lose Tokens' }
}

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200',
        card_back_logo_url: '',
        show_advertiser_cards: 'false',
        email_test_mode: 'true',
        test_email_recipient: 'bje1616@gmail.com',
        slot_jackpot_chance: '2',
        slot_triple_chance: '8',
        slot_pair_chance: '25',
        slot_jackpot_tokens: '100',
        slot_jackpot_tickets: '25',
        slot_triple_tokens: '25',
        slot_triple_tickets: '5',
        slot_pair_tokens: '5',
        slot_lose_tokens: '1',
        audit_log_auto_cleanup: 'false',
        audit_log_retention_days: '365',
        ip_log_auto_cleanup: 'true',
        ip_log_retention_days: '365'
    })
    const [uploading, setUploading] = useState(false)
    const { theme, themes, updateTheme, currentTheme } = useTheme()

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState([])

    const toggleSection = (section) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        )
    }

    // Calculate lose chance and win rate automatically
    const jackpotChance = parseInt(settings.slot_jackpot_chance || 0)
    const tripleChance = parseInt(settings.slot_triple_chance || 0)
    const pairChance = parseInt(settings.slot_pair_chance || 0)
    const loseChance = Math.max(0, 100 - jackpotChance - tripleChance - pairChance)
    const winRate = jackpotChance + tripleChance + pairChance

    // Check if a value is within recommended range
    const getValueStatus = (key, value) => {
        const config = slotDefaults[key]
        if (!config) return 'normal'
        const numValue = parseInt(value || 0)
        if (numValue < config.min || numValue > config.max) {
            if (numValue < config.min * 0.5 || numValue > config.max * 1.5) {
                return 'danger'
            }
            return 'warning'
        }
        return 'normal'
    }

    // Get border color based on status
    const getInputBorderClass = (key, value, baseColor) => {
        const status = getValueStatus(key, value)
        if (status === 'danger') return 'border-red-500 bg-red-500/10'
        if (status === 'warning') return 'border-yellow-500 bg-yellow-500/10'
        return `border-${baseColor}`
    }

    // Reset single value to default
    const resetToDefault = (key) => {
        if (slotDefaults[key]) {
            setSettings(prev => ({ ...prev, [key]: slotDefaults[key].default }))
        }
    }

    // State for reset confirmation modal
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    // Get list of values that would change on reset
    const getResetChanges = () => {
        const changes = []
        Object.keys(slotDefaults).forEach(key => {
            const current = settings[key]
            const defaultVal = slotDefaults[key].default
            if (current !== defaultVal) {
                changes.push({
                    label: slotDefaults[key].label,
                    from: current,
                    to: defaultVal
                })
            }
        })
        return changes
    }

    // Reset all slot settings to defaults
    const resetAllSlotSettings = () => {
        const resetValues = {}
        Object.keys(slotDefaults).forEach(key => {
            resetValues[key] = slotDefaults[key].default
        })
        setSettings(prev => ({ ...prev, ...resetValues }))
        setShowResetConfirm(false)
        setMessage('All slot settings reset to defaults. Click "Save All Settings" to apply.')
        setTimeout(() => setMessage(''), 4000)
    }

    // Check if any slot settings differ from defaults
    const hasSlotChanges = () => {
        return Object.keys(slotDefaults).some(key =>
            settings[key] !== slotDefaults[key].default
        )
    }

    // Economy health based on win rate
    const getEconomyHealth = () => {
        if (winRate > 50) {
            return {
                status: 'critical',
                icon: '🔴',
                label: 'Too Generous',
                color: 'red',
                message: 'House is paying out more tokens than players are spending. Token inflation will make rewards feel worthless over time.'
            }
        } else if (winRate > 35) {
            return {
                status: 'warning',
                icon: '🟡',
                label: 'Slightly Generous',
                color: 'yellow',
                message: 'Players are winning often. Check the Economy Dashboard weekly to ensure token supply isn\'t growing faster than token spending.'
            }
        } else if (winRate >= 25) {
            return {
                status: 'good',
                icon: '🟢',
                label: 'Balanced',
                color: 'green',
                message: 'Players win enough to stay engaged, but tokens remain valuable. Ideal for long-term sustainability.'
            }
        } else {
            return {
                status: 'tight',
                icon: '🟠',
                label: 'Too Tight',
                color: 'orange',
                message: 'Players lose too often and may quit out of frustration. Consider increasing Pair or Triple odds.'
            }
        }
    }

    const economyHealth = getEconomyHealth()

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')

            if (error) throw error

            const settingsObj = {}
            data.forEach(item => {
                settingsObj[item.setting_key] = item.setting_value
            })
            setSettings(prev => ({ ...prev, ...settingsObj }))
        } catch (error) {
            console.error('Error loading settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `card-back-logo-${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('business-card-images')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('business-card-images')
                .getPublicUrl(fileName)

            setSettings(prev => ({ ...prev, card_back_logo_url: publicUrl }))
            setMessage('Logo uploaded! Click "Save All Settings" to apply.')
            setTimeout(() => setMessage(''), 4000)
        } catch (error) {
            console.error('Upload error:', error)
            setMessage('Error uploading image')
        } finally {
            setUploading(false)
        }
    }

    const handleSaveAll = async () => {
        setSaving(true)
        setMessage('')

        try {
            for (const [key, value] of Object.entries(settings)) {
                const { error } = await supabase
                    .from('admin_settings')
                    .update({
                        setting_value: value,
                        updated_at: new Date().toISOString()
                    })
                    .eq('setting_key', key)

                if (error) {
                    console.error('Error updating setting:', key, error)
                    throw error
                }
            }

            setMessage('All settings saved successfully!')
            setTimeout(() => setMessage(''), 3000)
        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    // Reusable input component with reset button
    const SlotInput = ({ settingKey, label, color, showReset = true }) => {
        const config = slotDefaults[settingKey]
        const currentValue = settings[settingKey]
        const isDefault = currentValue === config?.default
        const status = getValueStatus(settingKey, currentValue)

        return (
            <div>
                <div className="flex items-center justify-between">
                    <label className={`text-${color} text-[10px]`}>{label}</label>
                    {showReset && !isDefault && (
                        <button
                            onClick={() => resetToDefault(settingKey)}
                            className={`text-[9px] text-${currentTheme.textMuted} hover:text-${currentTheme.text} transition-colors`}
                            title={`Reset to ${config?.default}`}
                        >
                            ↩️
                        </button>
                    )}
                </div>
                <div className="relative">
                    <input
                        type="number"
                        value={currentValue}
                        onChange={(e) => handleChange(settingKey, e.target.value)}
                        className={`w-full px-1.5 py-0.5 text-xs bg-${currentTheme.border} rounded text-${currentTheme.text} text-center ${getInputBorderClass(settingKey, currentValue, color + '-500/30')} border`}
                    />
                </div>
                <div className={`text-[8px] text-${currentTheme.textMuted} text-center mt-0.5`}>
                    Rec: {config?.min}-{config?.max} (default: {config?.default})
                </div>
                {status === 'warning' && (
                    <div className="text-[8px] text-yellow-400 text-center">⚠️ Outside recommended</div>
                )}
                {status === 'danger' && (
                    <div className="text-[8px] text-red-400 text-center">🚨 Far from recommended</div>
                )}
            </div>
        )
    }

    // Section Header Component
    const SectionHeader = ({ id, icon, title, subtitle, isExpanded }) => (
        <button
            onClick={() => toggleSection(id)}
            className={`w-full flex items-center justify-between p-2 text-left hover:bg-${currentTheme.border}/30 transition-colors rounded`}
        >
            <div className="flex items-center gap-2">
                <span>{icon}</span>
                <div>
                    <h2 className={`text-xs font-bold text-${currentTheme.text}`}>{title}</h2>
                    {subtitle && <p className={`text-${currentTheme.textMuted} text-[10px]`}>{subtitle}</p>}
                </div>
            </div>
            <span className={`text-${currentTheme.textMuted} transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
            </span>
        </button>
    )

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-2">
                    <div className={`h-5 bg-${currentTheme.border} rounded w-40`}></div>
                    <div className={`h-48 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-3">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Platform Settings</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Click a section to expand. Configure settings, then save.</p>
            </div>

            {message && (
                <div className={`mb-2 px-2 py-1.5 rounded text-xs ${message.includes('Error')
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-green-500/10 border border-green-500/30 text-green-400'
                    }`}>
                    {message}
                </div>
            )}

            {/* Save Button - Always Visible */}
            <div className={`mb-3 p-2 bg-${currentTheme.card} border border-${currentTheme.border} rounded sticky top-0 z-10`}>
                <div className="flex items-center justify-between">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Make changes below, then save.</p>
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`px-4 py-1.5 text-xs bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                    >
                        {saving ? 'Saving...' : '💾 Save All Settings'}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {/* Theme Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="theme"
                        icon="🎨"
                        title="Site Theme"
                        isExpanded={expandedSections.includes('theme')}
                    />
                    {expandedSections.includes('theme') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                        <Tooltip text={TIPS.colorTheme}>Color Theme</Tooltip>
                                    </label>
                                    <select
                                        value={theme}
                                        onChange={(e) => updateTheme(e.target.value)}
                                        className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    >
                                        {Object.entries(themes).map(([key, t]) => (
                                            <option key={key} value={key}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Preview:</p>
                                    <div className="flex gap-1">
                                        <div className={`w-6 h-6 rounded bg-${themes[theme]?.accent || 'amber-500'}`}></div>
                                        <div className={`w-6 h-6 rounded bg-${currentTheme.card} border border-${currentTheme.border}`}></div>
                                        <div className={`w-6 h-6 rounded bg-${currentTheme.bg}`}></div>
                                    </div>
                                    <p className={`text-${currentTheme.text} text-[10px] font-medium`}>{themes[theme]?.name}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Slot Machine Odds */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="slots"
                        icon="🎰"
                        title="Slot Machine Odds & Payouts"
                        subtitle={`Economy: ${economyHealth.icon} ${economyHealth.label} (${winRate}% win rate)`}
                        isExpanded={expandedSections.includes('slots')}
                    />
                    {expandedSections.includes('slots') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="flex justify-end mt-2 mb-2">
                                {hasSlotChanges() && (
                                    <button
                                        onClick={() => setShowResetConfirm(true)}
                                        className={`text-[10px] px-2 py-0.5 bg-${currentTheme.border} hover:bg-${currentTheme.border}/80 text-${currentTheme.textMuted} hover:text-${currentTheme.text} rounded transition-colors`}
                                    >
                                        ↩️ Reset All to Defaults
                                    </button>
                                )}
                            </div>

                            {/* Economy Health Indicator */}
                            <div className={`mb-3 p-2 rounded border ${economyHealth.status === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                                economyHealth.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                    economyHealth.status === 'good' ? 'bg-green-500/10 border-green-500/30' :
                                        'bg-orange-500/10 border-orange-500/30'
                                }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">{economyHealth.icon}</span>
                                    <span className={`font-bold text-xs ${economyHealth.status === 'critical' ? 'text-red-400' :
                                        economyHealth.status === 'warning' ? 'text-yellow-400' :
                                            economyHealth.status === 'good' ? 'text-green-400' :
                                                'text-orange-400'
                                        }`}>
                                        Economy Health: {economyHealth.label}
                                    </span>
                                    <span className={`ml-auto text-${currentTheme.text} font-bold text-xs`}>
                                        {winRate}% Win Rate
                                    </span>
                                </div>
                                <p className={`text-[10px] ${economyHealth.status === 'critical' ? 'text-red-300' :
                                    economyHealth.status === 'warning' ? 'text-yellow-300' :
                                        economyHealth.status === 'good' ? 'text-green-300' :
                                            'text-orange-300'
                                    }`}>
                                    {economyHealth.message}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {/* Jackpot */}
                                <div className={`bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded p-2`}>
                                    <div className="text-center mb-2">
                                        <div className="text-lg">🎰🎰🎰</div>
                                        <div className={`text-${currentTheme.text} font-bold text-xs`}>JACKPOT</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <SlotInput settingKey="slot_jackpot_chance" label="How often? (%)" color="yellow-400" />
                                        <SlotInput settingKey="slot_jackpot_tokens" label="Win tokens 🪙" color="yellow-400" />
                                        <SlotInput settingKey="slot_jackpot_tickets" label="Win tickets 🎟️" color="yellow-400" />
                                    </div>
                                </div>

                                {/* Triple */}
                                <div className={`bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded p-2`}>
                                    <div className="text-center mb-2">
                                        <div className="text-lg">🍒🍒🍒</div>
                                        <div className={`text-${currentTheme.text} font-bold text-xs`}>TRIPLE</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <SlotInput settingKey="slot_triple_chance" label="How often? (%)" color="purple-400" />
                                        <SlotInput settingKey="slot_triple_tokens" label="Win tokens 🪙" color="purple-400" />
                                        <SlotInput settingKey="slot_triple_tickets" label="Win tickets 🎟️" color="purple-400" />
                                    </div>
                                </div>

                                {/* Pair */}
                                <div className={`bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded p-2`}>
                                    <div className="text-center mb-2">
                                        <div className="text-lg">🍋🍋➖</div>
                                        <div className={`text-${currentTheme.text} font-bold text-xs`}>PAIR</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <SlotInput settingKey="slot_pair_chance" label="How often? (%)" color="blue-400" />
                                        <SlotInput settingKey="slot_pair_tokens" label="Win tokens 🪙" color="blue-400" />
                                        <div>
                                            <label className="text-blue-400 text-[10px]">Win tickets 🎟️</label>
                                            <div className={`w-full px-1.5 py-0.5 text-xs bg-${currentTheme.border}/50 border border-blue-500/30 rounded text-${currentTheme.textMuted} text-center`}>0 (fixed)</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lose */}
                                <div className={`bg-${currentTheme.border}/50 border border-${currentTheme.border} rounded p-2`}>
                                    <div className="text-center mb-2">
                                        <div className="text-lg">🍒🍋🍇</div>
                                        <div className={`text-${currentTheme.text} font-bold text-xs`}>LOSE</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div>
                                            <label className={`text-${currentTheme.textMuted} text-[10px]`}>How often? (%)</label>
                                            <div className={`w-full px-1.5 py-0.5 text-xs bg-${currentTheme.border}/50 border border-${currentTheme.border} rounded text-${currentTheme.textMuted} text-center`}>{loseChance}% (auto)</div>
                                        </div>
                                        <SlotInput settingKey="slot_lose_tokens" label="Lose tokens 🪙" color="red-400" />
                                        <div>
                                            <label className={`text-${currentTheme.textMuted} text-[10px]`}>Win tickets 🎟️</label>
                                            <div className={`w-full px-1.5 py-0.5 text-xs bg-${currentTheme.border}/50 border border-${currentTheme.border} rounded text-${currentTheme.textMuted} text-center`}>0 (fixed)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="email"
                        icon="📧"
                        title="Email Settings"
                        subtitle={settings.email_test_mode === 'true' ? '🧪 Test Mode ON' : '✅ Live Mode'}
                        isExpanded={expandedSections.includes('email')}
                    />
                    {expandedSections.includes('email') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div className={`p-2 bg-${currentTheme.border}/50 rounded`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className={`text-${currentTheme.text} font-medium text-xs`}>
                                                <Tooltip text={TIPS.emailTestMode}>Email Test Mode</Tooltip>
                                            </h3>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>Only send to test address</p>
                                        </div>
                                        <button
                                            onClick={() => handleChange('email_test_mode', settings.email_test_mode === 'true' ? 'false' : 'true')}
                                            className={`relative w-9 h-4 rounded-full transition-colors ${settings.email_test_mode === 'true' ? `bg-${currentTheme.accent}` : 'bg-green-500'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.email_test_mode === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                        </button>
                                    </div>
                                    {settings.email_test_mode === 'true' ? (
                                        <p className={`text-${currentTheme.accent} text-[10px] mt-1`}>🧪 Test Mode ON</p>
                                    ) : (
                                        <p className="text-green-400 text-[10px] mt-1">✅ Live Mode - Emails sent to all users</p>
                                    )}

                                    <div className="mt-2">
                                        <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                            <Tooltip text={TIPS.testRecipient}>Test Recipient</Tooltip>
                                        </label>
                                        <select
                                            value={settings.test_email_recipient}
                                            onChange={(e) => handleChange('test_email_recipient', e.target.value)}
                                            className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        >
                                            <option value="bje1616@gmail.com">bje1616@gmail.com</option>
                                            <option value="imaginethat.icu@gmail.com">imaginethat.icu@gmail.com</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                    <h3 className={`text-${currentTheme.text} font-medium text-[10px] mb-1`}>Email Types</h3>
                                    <div className={`text-${currentTheme.textMuted} text-[10px] space-y-0.5`}>
                                        <p>• Welcome (new registrations)</p>
                                        <p>• Campaign activated</p>
                                        <p>• Campaign completed</p>
                                        <p>• Prize winner notification</p>
                                        <p>• Matrix completion</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Ad Campaign Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="adcampaign"
                        icon="💰"
                        title="Ad Campaign Settings"
                        subtitle={`$${settings.ad_price} per campaign, ${settings.guaranteed_views} views`}
                        isExpanded={expandedSections.includes('adcampaign')}
                    />
                    {expandedSections.includes('adcampaign') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                        <Tooltip text={TIPS.adPrice}>Ad Price ($)</Tooltip>
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-${currentTheme.textMuted} text-xs`}>$</span>
                                        <input
                                            type="number"
                                            value={settings.ad_price}
                                            onChange={(e) => handleChange('ad_price', e.target.value)}
                                            className={`w-full pl-5 pr-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                        <Tooltip text={TIPS.guaranteedViews}>Guaranteed Views</Tooltip>
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.guaranteed_views}
                                        onChange={(e) => handleChange('guaranteed_views', e.target.value)}
                                        className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Matrix Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="matrix"
                        icon="🔷"
                        title="Matrix Settings"
                        subtitle={`$${settings.matrix_payout} payout per completion`}
                        isExpanded={expandedSections.includes('matrix')}
                    />
                    {expandedSections.includes('matrix') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                        <Tooltip text={TIPS.matrixPayout}>Matrix Payout ($)</Tooltip>
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-${currentTheme.textMuted} text-xs`}>$</span>
                                        <input
                                            type="number"
                                            value={settings.matrix_payout}
                                            onChange={(e) => handleChange('matrix_payout', e.target.value)}
                                            className={`w-full pl-5 pr-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        />
                                    </div>
                                </div>

                                <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                    <h3 className={`text-${currentTheme.text} font-medium text-[10px] mb-1`}>Matrix Structure</h3>
                                    <div className={`text-${currentTheme.textMuted} text-[10px] space-y-0.5`}>
                                        <p>• Spot 1: The user (paid advertiser)</p>
                                        <p>• Spots 2-3: Direct referrals</p>
                                        <p>• Spots 4-7: Referrals of 2-3</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Card Back Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="cardback"
                        icon="🎴"
                        title="Card Back Settings"
                        subtitle={settings.show_advertiser_cards === 'true' ? 'Advertiser cards shown' : 'Company logo shown'}
                        isExpanded={expandedSections.includes('cardback')}
                    />
                    {expandedSections.includes('cardback') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>
                                        <Tooltip text={TIPS.companyLogo}>Company Logo</Tooltip>
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        disabled={uploading}
                                        className={`w-full px-2 py-1 text-[10px] bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent} file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-${currentTheme.accent} file:text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} file:text-[10px] file:font-medium hover:file:bg-${currentTheme.accentHover}`}
                                    />
                                    {uploading && <p className={`text-${currentTheme.accent} text-[10px] mt-1`}>Uploading...</p>}

                                    <div className={`mt-2 p-1.5 bg-${currentTheme.border}/50 rounded`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className={`text-${currentTheme.text} font-medium text-[10px]`}>
                                                    <Tooltip text={TIPS.showAdvertiserCards}>Show Advertiser Cards</Tooltip>
                                                </h3>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Random card on backs</p>
                                            </div>
                                            <button
                                                onClick={() => handleChange('show_advertiser_cards', settings.show_advertiser_cards === 'true' ? 'false' : 'true')}
                                                className={`relative w-9 h-4 rounded-full transition-colors ${settings.show_advertiser_cards === 'true' ? `bg-${currentTheme.accent}` : `bg-${currentTheme.border}`}`}
                                            >
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.show_advertiser_cards === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center">
                                    <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>Preview:</p>
                                    <div className="w-20 h-14 rounded border-2 border-indigo-400 bg-indigo-600 flex items-center justify-center overflow-hidden">
                                        {settings.show_advertiser_cards === 'true' ? (
                                            <div className="text-center">
                                                <span className="text-sm">🎴</span>
                                                <p className="text-white text-[8px]">Advertiser</p>
                                            </div>
                                        ) : settings.card_back_logo_url ? (
                                            <img src={settings.card_back_logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                                        ) : (
                                            <span className="text-lg text-white">?</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Data Retention Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="retention"
                        icon="🗑️"
                        title="Data Retention"
                        subtitle={`Audit: ${settings.audit_log_auto_cleanup === 'true' ? settings.audit_log_retention_days + ' days' : 'Keep forever'}`}
                        isExpanded={expandedSections.includes('retention')}
                    />
                    {expandedSections.includes('retention') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <p className={`text-${currentTheme.textMuted} text-[10px] mt-2 mb-2`}>Auto-cleanup runs every Sunday at 9 AM. Logs older than retention days are deleted.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Audit Log */}
                                <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h3 className={`text-${currentTheme.text} font-medium text-xs`}>📋 Audit Logs</h3>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>Admin action history</p>
                                        </div>
                                        <button
                                            onClick={() => handleChange('audit_log_auto_cleanup', settings.audit_log_auto_cleanup === 'true' ? 'false' : 'true')}
                                            className={`relative w-9 h-4 rounded-full transition-colors ${settings.audit_log_auto_cleanup === 'true' ? 'bg-green-500' : `bg-${currentTheme.border}`}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.audit_log_auto_cleanup === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                        </button>
                                    </div>
                                    {settings.audit_log_auto_cleanup === 'true' ? (
                                        <p className="text-green-400 text-[10px] mb-2">✅ Auto-cleanup ON</p>
                                    ) : (
                                        <p className={`text-${currentTheme.accent} text-[10px] mb-2`}>⚠️ Logs kept forever</p>
                                    )}
                                    <div>
                                        <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Retention (days)</label>
                                        <input
                                            type="number"
                                            value={settings.audit_log_retention_days}
                                            onChange={(e) => handleChange('audit_log_retention_days', e.target.value)}
                                            className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                        />
                                    </div>
                                </div>

                                {/* IP Logs */}
                                <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h3 className={`text-${currentTheme.text} font-medium text-xs`}>🌍 IP / Geography Logs</h3>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>User login locations</p>
                                        </div>
                                        <button
                                            onClick={() => handleChange('ip_log_auto_cleanup', settings.ip_log_auto_cleanup === 'true' ? 'false' : 'true')}
                                            className={`relative w-9 h-4 rounded-full transition-colors ${settings.ip_log_auto_cleanup === 'true' ? 'bg-green-500' : `bg-${currentTheme.border}`}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.ip_log_auto_cleanup === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                        </button>
                                    </div>
                                    {settings.ip_log_auto_cleanup === 'true' ? (
                                        <p className="text-green-400 text-[10px] mb-2">✅ Auto-cleanup ON</p>
                                    ) : (
                                        <p className={`text-${currentTheme.accent} text-[10px] mb-2`}>⚠️ Logs kept forever</p>
                                    )}
                                    <div>
                                        <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Retention (days)</label>
                                        <input
                                            type="number"
                                            value={settings.ip_log_retention_days}
                                            onChange={(e) => handleChange('ip_log_retention_days', e.target.value)}
                                            className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Payment Methods */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded`}>
                    <SectionHeader
                        id="payments"
                        icon="💳"
                        title="Payment Methods"
                        subtitle="Stripe (auto), CashApp & Venmo (manual)"
                        isExpanded={expandedSections.includes('payments')}
                    />
                    {expandedSections.includes('payments') && (
                        <div className="p-2 pt-0 border-t border-slate-700">
                            <div className="grid grid-cols-3 gap-1.5 mt-2">
                                <div className={`bg-${currentTheme.border}/50 rounded p-1.5 border border-${currentTheme.border}`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-sm">💳</span>
                                        <h3 className={`text-${currentTheme.text} font-medium text-[10px]`}>Stripe</h3>
                                    </div>
                                    <span className="inline-block px-1 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">Auto</span>
                                </div>

                                <div className={`bg-${currentTheme.border}/50 rounded p-1.5 border border-${currentTheme.border}`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-sm">💵</span>
                                        <h3 className={`text-${currentTheme.text} font-medium text-[10px]`}>CashApp</h3>
                                    </div>
                                    <span className={`inline-block px-1 py-0.5 bg-${currentTheme.accent}/20 text-${currentTheme.accent} text-[10px] rounded`}>Manual</span>
                                </div>

                                <div className={`bg-${currentTheme.border}/50 rounded p-1.5 border border-${currentTheme.border}`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-sm">📱</span>
                                        <h3 className={`text-${currentTheme.text} font-medium text-[10px]`}>Venmo</h3>
                                    </div>
                                    <span className={`inline-block px-1 py-0.5 bg-${currentTheme.accent}/20 text-${currentTheme.accent} text-[10px] rounded`}>Manual</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 max-w-md w-full mx-4 shadow-xl`}>
                        <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>⚠️ Reset All Slot Settings?</h3>
                        <p className={`text-${currentTheme.textMuted} text-xs mb-3`}>
                            The following values will be changed back to defaults:
                        </p>

                        <div className={`bg-${currentTheme.border}/30 rounded p-2 mb-3 max-h-48 overflow-y-auto`}>
                            {getResetChanges().map((change, idx) => (
                                <div key={idx} className={`flex justify-between items-center py-1 ${idx > 0 ? `border-t border-${currentTheme.border}` : ''}`}>
                                    <span className={`text-${currentTheme.text} text-xs`}>{change.label}</span>
                                    <span className="text-xs">
                                        <span className="text-red-400">{change.from}</span>
                                        <span className={`text-${currentTheme.textMuted} mx-1`}>→</span>
                                        <span className="text-green-400">{change.to}</span>
                                    </span>
                                </div>
                            ))}
                        </div>

                        <p className={`text-${currentTheme.textMuted} text-[10px] mb-3`}>
                            This only updates the form. You'll still need to click "Save All Settings" to apply changes to the database.
                        </p>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className={`px-3 py-1.5 text-xs bg-${currentTheme.border} text-${currentTheme.text} rounded hover:bg-${currentTheme.border}/80 transition-colors`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={resetAllSlotSettings}
                                className="px-3 py-1.5 text-xs bg-red-500 text-white font-medium rounded hover:bg-red-600 transition-colors"
                            >
                                Reset to Defaults
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
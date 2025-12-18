'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

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
        test_email_recipient: 'bje1616@gmail.com'
    })
    const [uploading, setUploading] = useState(false)
    const { theme, themes, updateTheme, currentTheme } = useTheme()

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

                if (error) throw error
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
                <p className={`text-${currentTheme.textMuted} text-xs`}>Configure ad campaigns, matrix payouts, and more</p>
            </div>

            {message && (
                <div className={`mb-2 px-2 py-1.5 rounded text-xs ${message.includes('Error')
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-green-500/10 border border-green-500/30 text-green-400'
                    }`}>
                    {message}
                </div>
            )}

            <div className="space-y-2">
                {/* Theme Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>🎨 Site Theme</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Color Theme (use arrow keys to preview)</label>
                            <select
                                value={theme}
                                onChange={(e) => updateTheme(e.target.value)}
                                onKeyDown={(e) => {
                                    const themeKeys = Object.keys(themes)
                                    const currentIndex = themeKeys.indexOf(theme)
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault()
                                        const nextIndex = (currentIndex + 1) % themeKeys.length
                                        updateTheme(themeKeys[nextIndex])
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault()
                                        const prevIndex = (currentIndex - 1 + themeKeys.length) % themeKeys.length
                                        updateTheme(themeKeys[prevIndex])
                                    }
                                }}
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

                {/* Email Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>📧 Email Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className={`p-2 bg-${currentTheme.border}/50 rounded`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className={`text-${currentTheme.text} font-medium text-xs`}>Email Test Mode</h3>
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
                                <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Test Recipient</label>
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

                {/* Ad Campaign Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>💰 Ad Campaign Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Ad Price ($)</label>
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
                            <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Guaranteed Views</label>
                            <input
                                type="number"
                                value={settings.guaranteed_views}
                                onChange={(e) => handleChange('guaranteed_views', e.target.value)}
                                className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Matrix Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>🔷 Matrix Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Matrix Payout ($)</label>
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

                {/* Card Back Settings */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>🎴 Card Back Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className={`block text-[10px] font-medium text-${currentTheme.textMuted} mb-0.5`}>Company Logo</label>
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
                                        <h3 className={`text-${currentTheme.text} font-medium text-[10px]`}>Show Advertiser Cards</h3>
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

                {/* Payment Methods */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-2`}>
                    <h2 className={`text-xs font-bold text-${currentTheme.text} mb-2`}>💳 Payment Methods</h2>

                    <div className="grid grid-cols-3 gap-1.5">
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

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`px-3 py-1.5 text-xs bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                    >
                        {saving ? 'Saving...' : 'Save All Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
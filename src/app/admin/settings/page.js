'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200',
        card_back_logo_url: '',
        show_advertiser_cards: 'false'
    })
    const [uploading, setUploading] = useState(false)

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
                <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-slate-700 rounded w-48"></div>
                    <div className="h-64 bg-slate-800 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-lg font-bold text-white">Platform Settings</h1>
                <p className="text-slate-400 text-xs">Configure ad campaigns, matrix payouts, and more</p>
            </div>

            {message && (
                <div className={`mb-3 px-3 py-2 rounded text-xs ${message.includes('Error')
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-green-500/10 border border-green-500/30 text-green-400'
                    }`}>
                    {message}
                </div>
            )}

            <div className="space-y-3">
                {/* Ad Campaign Settings */}
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <h2 className="text-sm font-bold text-white mb-3">💰 Ad Campaign Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Ad Campaign Price ($)
                            </label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    value={settings.ad_price}
                                    onChange={(e) => handleChange('ad_price', e.target.value)}
                                    className="w-full pl-6 pr-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            <p className="text-slate-500 text-[10px] mt-0.5">How much users pay for an ad campaign</p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Guaranteed Views per Campaign
                            </label>
                            <input
                                type="number"
                                value={settings.guaranteed_views}
                                onChange={(e) => handleChange('guaranteed_views', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <p className="text-slate-500 text-[10px] mt-0.5">Minimum views each advertiser is guaranteed</p>
                        </div>
                    </div>
                </div>

                {/* Matrix Settings */}
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <h2 className="text-sm font-bold text-white mb-3">🔷 Matrix Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Matrix Completion Payout ($)
                            </label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    value={settings.matrix_payout}
                                    onChange={(e) => handleChange('matrix_payout', e.target.value)}
                                    className="w-full pl-6 pr-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            <p className="text-slate-500 text-[10px] mt-0.5">Total payout when user completes their matrix</p>
                        </div>

                        <div className="bg-slate-700/50 rounded p-2">
                            <h3 className="text-white font-medium text-xs mb-1">Matrix Structure</h3>
                            <div className="text-slate-400 text-[10px] space-y-0.5">
                                <p>• Spot 1: The user (paid advertiser)</p>
                                <p>• Spots 2-3: Their direct referrals</p>
                                <p>• Spots 4-7: Referrals of spots 2-3</p>
                                <p>• All 7 spots must be paid advertisers</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card Back Settings */}
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <h2 className="text-sm font-bold text-white mb-3">🎴 Card Back Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Company Logo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={uploading}
                                className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-amber-500 file:text-slate-900 file:text-xs file:font-medium hover:file:bg-amber-400"
                            />
                            {uploading && <p className="text-amber-400 text-xs mt-1">Uploading...</p>}
                            <p className="text-slate-500 text-[10px] mt-0.5">This logo shows on card backs by default</p>

                            {/* Toggle for Advertiser Cards */}
                            <div className="mt-3 p-2 bg-slate-700/50 rounded">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-white font-medium text-xs">Show Advertiser Cards Instead</h3>
                                        <p className="text-slate-400 text-[10px]">Display a random advertiser's card on card backs</p>
                                    </div>
                                    <button
                                        onClick={() => handleChange('show_advertiser_cards', settings.show_advertiser_cards === 'true' ? 'false' : 'true')}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_advertiser_cards === 'true' ? 'bg-amber-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.show_advertiser_cards === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                    </button>
                                </div>
                                {settings.show_advertiser_cards === 'true' && (
                                    <p className="text-amber-400 text-[10px] mt-2">
                                        ✓ A random advertiser's card will be shown on card backs.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex flex-col items-center justify-center">
                            <p className="text-slate-400 text-xs mb-2">Current Card Back Preview:</p>
                            <div className="w-24 h-16 rounded border-2 border-indigo-400 bg-indigo-600 flex items-center justify-center overflow-hidden">
                                {settings.show_advertiser_cards === 'true' ? (
                                    <div className="text-center p-1">
                                        <span className="text-lg">🎴</span>
                                        <p className="text-white text-[8px]">Advertiser Card</p>
                                    </div>
                                ) : settings.card_back_logo_url ? (
                                    <img
                                        src={settings.card_back_logo_url}
                                        alt="Logo preview"
                                        className="max-w-full max-h-full object-contain p-1"
                                    />
                                ) : (
                                    <span className="text-2xl text-white">?</span>
                                )}
                            </div>
                            <p className="text-slate-500 text-[10px] mt-1">
                                {settings.show_advertiser_cards === 'true'
                                    ? 'Random advertiser each game'
                                    : settings.card_back_logo_url
                                        ? 'Your logo'
                                        : 'Upload a logo'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Payment Methods Info */}
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <h2 className="text-sm font-bold text-white mb-3">💳 Payment Methods</h2>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-700/50 rounded p-2 border border-slate-600">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">💳</span>
                                <h3 className="text-white font-medium text-xs">Stripe</h3>
                            </div>
                            <p className="text-slate-400 text-[10px]">Auto payments & refunds</p>
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full">Auto</span>
                        </div>

                        <div className="bg-slate-700/50 rounded p-2 border border-slate-600">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">💵</span>
                                <h3 className="text-white font-medium text-xs">CashApp</h3>
                            </div>
                            <p className="text-slate-400 text-[10px]">Manual payouts required</p>
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">Manual</span>
                        </div>

                        <div className="bg-slate-700/50 rounded p-2 border border-slate-600">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">📱</span>
                                <h3 className="text-white font-medium text-xs">Venmo</h3>
                            </div>
                            <p className="text-slate-400 text-[10px]">Manual payouts required</p>
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">Manual</span>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="px-4 py-1.5 text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save All Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminHouseCardsPage() {
    const [houseCards, setHouseCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [showTemplateForm, setShowTemplateForm] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

    // Settings
    const [houseCardFrequency, setHouseCardFrequency] = useState('10')
    const [fallbackEnabled, setFallbackEnabled] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)

    const [templateData, setTemplateData] = useState({
        business_name: '',
        tagline: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF'
    })

    const backgroundColors = [
        { name: 'Indigo', value: '#4F46E5' },
        { name: 'Blue', value: '#2563EB' },
        { name: 'Sky', value: '#0EA5E9' },
        { name: 'Cyan', value: '#06B6D4' },
        { name: 'Navy', value: '#1E3A8A' },
        { name: 'Green', value: '#16A34A' },
        { name: 'Emerald', value: '#10B981' },
        { name: 'Teal', value: '#0D9488' },
        { name: 'Lime', value: '#84CC16' },
        { name: 'Forest', value: '#166534' },
        { name: 'Red', value: '#DC2626' },
        { name: 'Rose', value: '#E11D48' },
        { name: 'Pink', value: '#DB2777' },
        { name: 'Crimson', value: '#BE123C' },
        { name: 'Coral', value: '#F97316' },
        { name: 'Purple', value: '#9333EA' },
        { name: 'Violet', value: '#7C3AED' },
        { name: 'Fuchsia', value: '#C026D3' },
        { name: 'Plum', value: '#6B21A8' },
        { name: 'Slate', value: '#475569' },
        { name: 'Gray', value: '#6B7280' },
        { name: 'Charcoal', value: '#374151' },
        { name: 'Black', value: '#1F2937' },
        { name: 'Midnight', value: '#0F172A' },
        { name: 'Orange', value: '#EA580C' },
        { name: 'Amber', value: '#D97706' },
        { name: 'Yellow', value: '#CA8A04' },
        { name: 'Gold', value: '#B45309' },
        { name: 'Brown', value: '#92400E' },
    ]

    const textColors = [
        { name: 'White', value: '#FFFFFF' },
        { name: 'Light Gray', value: '#E5E7EB' },
        { name: 'Silver', value: '#D1D5DB' },
        { name: 'Black', value: '#1F2937' },
        { name: 'Dark Gray', value: '#374151' },
        { name: 'Yellow', value: '#FDE047' },
        { name: 'Gold', value: '#FBBF24' },
        { name: 'Amber', value: '#FCD34D' },
        { name: 'Cyan', value: '#67E8F9' },
        { name: 'Lime', value: '#BEF264' },
        { name: 'Pink', value: '#F9A8D4' },
        { name: 'Orange', value: '#FDBA74' },
    ]

    useEffect(() => {
        loadHouseCards()
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['house_card_frequency', 'house_card_fallback_enabled'])

            if (error) throw error

            data?.forEach(setting => {
                if (setting.setting_key === 'house_card_frequency') {
                    setHouseCardFrequency(setting.setting_value || '10')
                } else if (setting.setting_key === 'house_card_fallback_enabled') {
                    setFallbackEnabled(setting.setting_value === 'true')
                }
            })
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    const saveSettings = async () => {
        setSavingSettings(true)
        try {
            await supabase
                .from('admin_settings')
                .update({ setting_value: houseCardFrequency, updated_at: new Date().toISOString() })
                .eq('setting_key', 'house_card_frequency')

            await supabase
                .from('admin_settings')
                .update({ setting_value: fallbackEnabled ? 'true' : 'false', updated_at: new Date().toISOString() })
                .eq('setting_key', 'house_card_fallback_enabled')

        } catch (error) {
            console.error('Error saving settings:', error)
            alert('Error saving settings: ' + error.message)
        } finally {
            setSavingSettings(false)
        }
    }

    const loadHouseCards = async () => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .eq('is_house_card', true)
                .order('created_at', { ascending: false })

            if (error) throw error
            setHouseCards(data || [])
        } catch (error) {
            console.error('Error loading house cards:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleBatchUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        setUploading(true)
        setUploadProgress({ current: 0, total: files.length })

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                setUploadProgress({ current: i + 1, total: files.length })

                if (file.size > 2 * 1024 * 1024) {
                    alert(`Skipping ${file.name} - exceeds 2MB limit`)
                    continue
                }

                const fileExt = file.name.split('.').pop()
                const fileName = `house-${Date.now()}-${i}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('business-card-images')
                    .upload(fileName, file)

                if (uploadError) continue

                const { data: urlData } = supabase.storage
                    .from('business-card-images')
                    .getPublicUrl(fileName)

                const originalName = file.name.split('.').slice(0, -1).join('.')

                await supabase
                    .from('business_cards')
                    .insert([{
                        card_type: 'uploaded',
                        title: originalName,
                        business_name: originalName,
                        image_url: urlData.publicUrl,
                        is_house_card: true
                    }])
            }

            await loadHouseCards()
            e.target.value = ''
        } catch (error) {
            alert('Error during upload: ' + error.message)
        } finally {
            setUploading(false)
            setUploadProgress({ current: 0, total: 0 })
        }
    }

    const handleTemplateSubmit = async (e) => {
        e.preventDefault()
        setUploading(true)

        try {
            const { error } = await supabase
                .from('business_cards')
                .insert([{
                    card_type: 'template',
                    title: templateData.business_name,
                    business_name: templateData.business_name,
                    tagline: templateData.tagline,
                    message: templateData.tagline,
                    card_color: templateData.card_color,
                    text_color: templateData.text_color,
                    is_house_card: true
                }])

            if (error) throw error

            setTemplateData({ business_name: '', tagline: '', card_color: '#4F46E5', text_color: '#FFFFFF' })
            setShowTemplateForm(false)
            await loadHouseCards()
        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (cardId, imageUrl) => {
        if (!confirm('Delete this house card?')) return

        try {
            await supabase.from('business_cards').delete().eq('id', cardId)

            if (imageUrl && imageUrl.includes('business-card-images')) {
                const fileName = imageUrl.split('/').pop()
                await supabase.storage.from('business-card-images').remove([fileName])
            }

            await loadHouseCards()
        } catch (error) {
            alert('Error: ' + error.message)
        }
    }

    if (loading) {
        return (
            <div className="p-3">
                <div className="animate-pulse h-64 bg-slate-800 rounded"></div>
            </div>
        )
    }

    return (
        <div className="p-3">
            {/* Header + Stats Row */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-lg font-bold text-white">House Cards</h1>
                    <p className="text-slate-400 text-xs">Default filler cards when not enough advertisers</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-center">
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="text-lg font-bold text-amber-400">{houseCards.length}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-center">
                        <p className="text-xs text-slate-400">Uploaded</p>
                        <p className="text-lg font-bold text-blue-400">{houseCards.filter(c => c.card_type === 'uploaded').length}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-center">
                        <p className="text-xs text-slate-400">Templates</p>
                        <p className="text-lg font-bold text-green-400">{houseCards.filter(c => c.card_type === 'template').length}</p>
                    </div>
                </div>
            </div>

            {/* Settings + Upload Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                {/* Settings */}
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Frequency:</span>
                            <span className="text-slate-400 text-xs">1 in</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={houseCardFrequency}
                                onChange={(e) => setHouseCardFrequency(e.target.value)}
                                className="w-12 px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Fallback:</span>
                            <button
                                onClick={() => setFallbackEnabled(!fallbackEnabled)}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${fallbackEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}
                            >
                                {fallbackEnabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        <button
                            onClick={saveSettings}
                            disabled={savingSettings}
                            className="px-2 py-0.5 text-xs bg-amber-500 text-slate-900 font-bold rounded hover:bg-amber-400 disabled:opacity-50"
                        >
                            {savingSettings ? '...' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Batch Upload */}
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">📤</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleBatchUpload}
                            disabled={uploading}
                            className="flex-1 text-xs bg-slate-700 border border-slate-600 rounded text-white file:mr-1 file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-amber-500 file:text-slate-900 file:text-xs file:font-bold cursor-pointer disabled:opacity-50"
                        />
                    </div>
                    {uploadProgress.total > 0 && (
                        <div className="mt-1 h-1 bg-slate-600 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}></div>
                        </div>
                    )}
                </div>

                {/* Template Button */}
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <button
                        onClick={() => setShowTemplateForm(!showTemplateForm)}
                        className="w-full px-3 py-1 text-xs bg-amber-500 text-slate-900 font-bold rounded hover:bg-amber-400"
                    >
                        {showTemplateForm ? '✕ Hide Template Form' : '🎨 Create Template Card'}
                    </button>
                </div>
            </div>

            {/* Template Form */}
            {showTemplateForm && (
                <form onSubmit={handleTemplateSubmit} className="bg-slate-800 border border-slate-700 rounded p-2 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <input
                                type="text"
                                required
                                maxLength={20}
                                value={templateData.business_name}
                                onChange={(e) => setTemplateData({ ...templateData, business_name: e.target.value })}
                                className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                                placeholder="Title / Business Name"
                            />
                            <input
                                type="text"
                                maxLength={40}
                                value={templateData.tagline}
                                onChange={(e) => setTemplateData({ ...templateData, tagline: e.target.value })}
                                className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                                placeholder="Tagline / Message"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-wrap gap-0.5">
                                {backgroundColors.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setTemplateData({ ...templateData, card_color: color.value })}
                                        className={`w-4 h-4 rounded border ${templateData.card_color === color.value ? 'border-white scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                                {textColors.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setTemplateData({ ...templateData, text_color: color.value })}
                                        className={`w-4 h-4 rounded border ${templateData.text_color === color.value ? 'border-white scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div
                                className="flex-1 aspect-[4/3] rounded p-2 flex flex-col justify-between border border-slate-600"
                                style={{ backgroundColor: templateData.card_color }}
                            >
                                <h3 className="font-bold text-xs text-center" style={{ color: templateData.text_color }}>
                                    {templateData.business_name || 'Title'}
                                </h3>
                                <p className="text-[10px] text-center" style={{ color: templateData.text_color, opacity: 0.9 }}>
                                    {templateData.tagline || 'Tagline'}
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={uploading || !templateData.business_name}
                                className="px-3 text-xs bg-amber-500 text-slate-900 font-bold rounded hover:bg-amber-400 disabled:opacity-50"
                            >
                                {uploading ? '...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* House Cards Grid */}
            <div className="bg-slate-800 border border-slate-700 rounded p-2">
                <h2 className="text-xs font-bold text-white mb-2">Existing House Cards ({houseCards.length})</h2>

                {houseCards.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-slate-400 text-xs">No house cards yet. Upload images or create templates above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
                        {houseCards.map((card) => (
                            <div key={card.id} className="relative group">
                                <button
                                    onClick={() => handleDelete(card.id, card.image_url)}
                                    className="absolute -top-1 -right-1 z-10 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {card.card_type === 'uploaded' && card.image_url ? (
                                    <div className="bg-slate-700 border border-slate-600 rounded overflow-hidden aspect-[4/3]">
                                        <img src={card.image_url} alt={card.title || 'House Card'} className="w-full h-full object-contain" />
                                    </div>
                                ) : (
                                    <div
                                        className="rounded p-1 aspect-[4/3] flex flex-col justify-between border border-slate-600"
                                        style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                    >
                                        <h3 className="font-bold text-[8px] text-center" style={{ color: card.text_color || '#FFFFFF' }}>
                                            {card.title || card.business_name}
                                        </h3>
                                        <p className="text-[6px] text-center" style={{ color: card.text_color || '#FFFFFF', opacity: 0.9 }}>
                                            {card.tagline || card.message || ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
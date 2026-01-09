'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

// Color options
const BG_COLORS = [
    { value: '#4F46E5', label: 'Indigo' },
    { value: '#7C3AED', label: 'Purple' },
    { value: '#2563EB', label: 'Blue' },
    { value: '#0891B2', label: 'Cyan' },
    { value: '#059669', label: 'Emerald' },
    { value: '#16A34A', label: 'Green' },
    { value: '#CA8A04', label: 'Yellow' },
    { value: '#EA580C', label: 'Orange' },
    { value: '#DC2626', label: 'Red' },
    { value: '#DB2777', label: 'Pink' },
    { value: '#9333EA', label: 'Violet' },
    { value: '#475569', label: 'Slate' },
    { value: '#1E293B', label: 'Dark Slate' },
    { value: '#18181B', label: 'Zinc' },
    { value: '#292524', label: 'Stone' },
    { value: '#1C1917', label: 'Warm Black' },
    { value: '#0C4A6E', label: 'Sky Dark' },
    { value: '#134E4A', label: 'Teal Dark' },
    { value: '#365314', label: 'Lime Dark' },
    { value: '#713F12', label: 'Amber Dark' },
]

const TEXT_COLORS = [
    { value: '#FFFFFF', label: 'White' },
    { value: '#000000', label: 'Black' },
    { value: '#DC2626', label: 'Red' },
    { value: '#EA580C', label: 'Orange' },
    { value: '#F59E0B', label: 'Amber' },
    { value: '#FACC15', label: 'Yellow' },
    { value: '#22C55E', label: 'Green' },
    { value: '#14B8A6', label: 'Teal' },
    { value: '#0EA5E9', label: 'Sky' },
    { value: '#3B82F6', label: 'Blue' },
    { value: '#8B5CF6', label: 'Violet' },
    { value: '#EC4899', label: 'Pink' },
]

// Gradient options for backgrounds
const GRADIENT_COLORS = [
    { value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: 'Purple Blend' },
    { value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', label: 'Pink Sunset' },
    { value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: 'Ocean Blue' },
    { value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', label: 'Mint Fresh' },
    { value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: 'Warm Glow' },
    { value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', label: 'Soft Pastel' },
    { value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', label: 'Rose' },
    { value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', label: 'Peach' },
    { value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', label: 'Lavender' },
    { value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)', label: 'Coral Fire' },
    { value: 'linear-gradient(135deg, #232526 0%, #414345 100%)', label: 'Dark Steel' },
    { value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', label: 'Night Sky' },
]

export default function PromoCardsPage() {
    const { currentTheme } = useTheme()
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState(null)

    // Template card form
    const [showTemplateForm, setShowTemplateForm] = useState(false)
    const [templateForm, setTemplateForm] = useState({
        title: '',
        message: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF'
    })

    // Settings
    const [frequency, setFrequency] = useState(10)
    const [fallbackEnabled, setFallbackEnabled] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)

    // Popup editor
    const [editingPopup, setEditingPopup] = useState(null)

    // Preview modal
    const [previewCard, setPreviewCard] = useState(null)
    const [popupForm, setPopupForm] = useState({
        has_popup: false,
        popup_title: '',
        popup_message: '',
        popup_image_url: '',
        popup_bg_color: '#4F46E5',
        popup_text_color: '#FFFFFF',
        popup_cta_text: '',
        popup_cta_url: ''
    })

    useEffect(() => {
        loadCards()
        loadSettings()
    }, [])

    const loadCards = async () => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .eq('is_house_card', true)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCards(data || [])
        } catch (error) {
            console.error('Error loading promo cards:', error)
            setMessage({ type: 'error', text: 'Failed to load promo cards' })
        } finally {
            setLoading(false)
        }
    }

    const loadSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['house_card_frequency', 'house_card_fallback_enabled'])

            data?.forEach(s => {
                if (s.setting_key === 'house_card_frequency') setFrequency(parseInt(s.setting_value) || 10)
                if (s.setting_key === 'house_card_fallback_enabled') setFallbackEnabled(s.setting_value === 'true')
            })
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    const saveSettings = async () => {
        setSavingSettings(true)
        try {
            const settings = [
                { setting_key: 'house_card_frequency', setting_value: frequency.toString() },
                { setting_key: 'house_card_fallback_enabled', setting_value: fallbackEnabled.toString() }
            ]

            for (const setting of settings) {
                const { data: existing } = await supabase
                    .from('admin_settings')
                    .select('id')
                    .eq('setting_key', setting.setting_key)
                    .maybeSingle()

                if (existing) {
                    await supabase
                        .from('admin_settings')
                        .update({ setting_value: setting.setting_value, updated_at: new Date().toISOString() })
                        .eq('id', existing.id)
                } else {
                    await supabase
                        .from('admin_settings')
                        .insert([setting])
                }
            }

            setMessage({ type: 'success', text: 'Settings saved!' })
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSavingSettings(false)
        }
    }

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        setUploading(true)
        setMessage({ type: 'info', text: `Uploading ${files.length} image(s)...` })

        try {
            for (const file of files) {
                const fileExt = file.name.split('.').pop()
                const fileName = `promo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
                const filePath = `promo-cards/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('business-cards')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('business-cards')
                    .getPublicUrl(filePath)

                const { error: insertError } = await supabase
                    .from('business_cards')
                    .insert([{
                        title: file.name.split('.')[0],
                        card_type: 'uploaded',
                        image_url: publicUrl,
                        is_house_card: true,
                        card_color: '#4F46E5',
                        text_color: '#FFFFFF'
                    }])

                if (insertError) throw insertError
            }

            setMessage({ type: 'success', text: `${files.length} image(s) uploaded successfully!` })
            loadCards()
        } catch (error) {
            console.error('Error uploading:', error)
            setMessage({ type: 'error', text: 'Failed to upload images' })
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const createTemplateCard = async () => {
        if (!templateForm.title.trim()) {
            setMessage({ type: 'error', text: 'Title is required' })
            return
        }

        try {
            const { error } = await supabase
                .from('business_cards')
                .insert([{
                    title: templateForm.title,
                    message: templateForm.message,
                    card_type: 'template',
                    card_color: templateForm.card_color,
                    text_color: templateForm.text_color,
                    is_house_card: true
                }])

            if (error) throw error

            setMessage({ type: 'success', text: 'Promo card created!' })
            setTemplateForm({ title: '', message: '', card_color: '#4F46E5', text_color: '#FFFFFF' })
            setShowTemplateForm(false)
            loadCards()
        } catch (error) {
            console.error('Error creating card:', error)
            setMessage({ type: 'error', text: 'Failed to create card' })
        }
    }

    const deleteCard = async (id) => {
        if (!confirm('Delete this promo card?')) return

        try {
            const { error } = await supabase
                .from('business_cards')
                .delete()
                .eq('id', id)

            if (error) throw error
            setMessage({ type: 'success', text: 'Card deleted' })
            loadCards()
        } catch (error) {
            console.error('Error deleting card:', error)
            setMessage({ type: 'error', text: 'Failed to delete card' })
        }
    }

    const openPopupEditor = (card) => {
        setEditingPopup(card)
        setPopupForm({
            has_popup: card.has_popup || false,
            popup_title: card.popup_title || '',
            popup_message: card.popup_message || '',
            popup_image_url: card.popup_image_url || '',
            popup_bg_color: card.popup_bg_color || '#4F46E5',
            popup_text_color: card.popup_text_color || '#FFFFFF',
            popup_cta_text: card.popup_cta_text || '',
            popup_cta_url: card.popup_cta_url || ''
        })
    }

    const savePopup = async () => {
        if (!editingPopup) return

        try {
            const { error } = await supabase
                .from('business_cards')
                .update({
                    has_popup: popupForm.has_popup,
                    popup_title: popupForm.popup_title,
                    popup_message: popupForm.popup_message,
                    popup_image_url: popupForm.popup_image_url,
                    popup_bg_color: popupForm.popup_bg_color,
                    popup_text_color: popupForm.popup_text_color,
                    popup_cta_text: popupForm.popup_cta_text,
                    popup_cta_url: popupForm.popup_cta_url,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingPopup.id)

            if (error) throw error

            setMessage({ type: 'success', text: 'Popup settings saved!' })
            setEditingPopup(null)
            loadCards()
        } catch (error) {
            console.error('Error saving popup:', error)
            setMessage({ type: 'error', text: 'Failed to save popup settings' })
        }
    }

    const handlePopupImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `popup-${Date.now()}.${fileExt}`
            const filePath = `promo-cards/popups/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('business-cards')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('business-cards')
                .getPublicUrl(filePath)

            setPopupForm(prev => ({ ...prev, popup_image_url: publicUrl }))
        } catch (error) {
            console.error('Error uploading popup image:', error)
            setMessage({ type: 'error', text: 'Failed to upload image' })
        }
    }

    if (loading) {
        return (
            <div className={`p-4 flex items-center justify-center`}>
                <div className={`w-6 h-6 border-3 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="mb-3">
                <h1 className={`text-xl font-bold text-${currentTheme.text}`}>🎴 IT Company Promo Cards</h1>
                <p className={`text-${currentTheme.textMuted} text-sm`}>
                    Create promotional cards for direct communication with players.
                </p>
                <p className={`text-${currentTheme.accent} text-xs font-bold mt-1`}>* IT Company Promo Cards — Not Advertiser Cards *</p>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-3 p-2 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' :
                    message.type === 'success' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Settings Card - Compact Inline */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-3`}>
                <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-sm font-bold text-${currentTheme.text}`}>⚙️ Display</span>

                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs text-${currentTheme.textMuted}`}>1 promo per</span>
                        <input
                            type="number"
                            min="0"
                            value={frequency}
                            onChange={(e) => setFrequency(parseInt(e.target.value) || 0)}
                            className={`w-14 px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm text-center`}
                        />
                        <span className={`text-xs text-${currentTheme.textMuted}`}>ads</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setFallbackEnabled(!fallbackEnabled)}
                            className={`w-9 h-5 rounded-full transition-all ${fallbackEnabled ? 'bg-green-500' : `bg-${currentTheme.border}`}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-all ${fallbackEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                        </button>
                        <span className={`text-xs text-${currentTheme.textMuted}`}>
                            {fallbackEnabled ? 'Fallback ON' : 'Fallback OFF'}
                        </span>
                    </div>

                    <button
                        onClick={saveSettings}
                        disabled={savingSettings}
                        className={`px-3 py-1 bg-${currentTheme.accent} text-slate-900 rounded text-xs font-bold hover:opacity-90 disabled:opacity-50`}
                    >
                        {savingSettings ? '...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Upload & Create Section - Compact */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-3`}>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold text-${currentTheme.text}`}>➕ Add</span>

                    <label className={`px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium cursor-pointer hover:bg-blue-500 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading ? '...' : '📷 Upload Images'}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                    </label>

                    <button
                        onClick={() => setShowTemplateForm(!showTemplateForm)}
                        className={`px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-500`}
                    >
                        🎨 {showTemplateForm ? 'Cancel' : 'Template Card'}
                    </button>
                </div>

                {/* Upload Recommendation */}
                <p className={`text-${currentTheme.textMuted} text-xs mt-2`}>
                    📐 Recommended image size: <span className={`text-${currentTheme.accent} font-medium`}>700×400px</span> or any 7:4 ratio (standard business card proportions)
                </p>

                {/* Template Form */}
                {showTemplateForm && (
                    <div className={`mt-3 p-3 bg-${currentTheme.bg} rounded-lg border border-${currentTheme.border}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Title *</label>
                                <input
                                    type="text"
                                    value={templateForm.title}
                                    onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                                    className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    placeholder="Card title"
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Message</label>
                                <input
                                    type="text"
                                    value={templateForm.message}
                                    onChange={(e) => setTemplateForm(prev => ({ ...prev, message: e.target.value }))}
                                    className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    placeholder="Optional message"
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Background</label>
                                <div className="flex flex-wrap gap-1">
                                    {BG_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setTemplateForm(prev => ({ ...prev, card_color: color.value }))}
                                            className={`w-5 h-5 rounded border-2 ${templateForm.card_color === color.value ? 'border-white' : 'border-transparent'}`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Text Color</label>
                                <div className="flex flex-wrap gap-1">
                                    {TEXT_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setTemplateForm(prev => ({ ...prev, text_color: color.value }))}
                                            className={`w-5 h-5 rounded border-2 ${templateForm.text_color === color.value ? 'border-blue-500' : 'border-gray-400'}`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-3 flex items-center gap-3">
                            <div
                                className="w-36 h-20 rounded-lg flex flex-col items-center justify-center p-2"
                                style={{ backgroundColor: templateForm.card_color }}
                            >
                                <p className="font-bold text-xs text-center" style={{ color: templateForm.text_color }}>
                                    {templateForm.title || 'Title'}
                                </p>
                                {templateForm.message && (
                                    <p className="text-[10px] text-center mt-0.5" style={{ color: templateForm.text_color }}>
                                        {templateForm.message}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={createTemplateCard}
                                    className={`px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500`}
                                >
                                    Create Card
                                </button>
                                <button
                                    onClick={() => setShowTemplateForm(false)}
                                    className={`px-3 py-1.5 bg-slate-600 text-white rounded text-xs font-medium hover:bg-slate-500`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cards Grid */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>📋 Your Promo Cards ({cards.length})</h2>

                {cards.length === 0 ? (
                    <p className={`text-${currentTheme.textMuted} text-center py-6 text-sm`}>
                        No promo cards yet. Upload images or create template cards above.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                        {cards.map(card => (
                            <div key={card.id} className="relative group">
                                {card.card_type === 'uploaded' && card.image_url ? (
                                    <img
                                        src={card.image_url}
                                        alt={card.title}
                                        className="w-full aspect-[7/4] object-cover rounded-lg"
                                    />
                                ) : (
                                    <div
                                        className="w-full aspect-[7/4] rounded-lg flex flex-col items-center justify-center p-1.5"
                                        style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                    >
                                        <p className="font-bold text-[10px] text-center leading-tight" style={{ color: card.text_color || '#FFFFFF' }}>
                                            {card.title}
                                        </p>
                                        {card.message && (
                                            <p className="text-[8px] text-center mt-0.5 leading-tight" style={{ color: card.text_color || '#FFFFFF' }}>
                                                {card.message}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Popup indicator */}
                                {card.has_popup && (
                                    <div className="absolute top-0.5 right-0.5 bg-purple-500 text-white text-[6px] px-1 rounded">
                                        POPUP
                                    </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => setPreviewCard(card)}
                                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 text-xs"
                                        title="Preview"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        onClick={() => openPopupEditor(card)}
                                        className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-500 text-xs"
                                        title="Edit Popup"
                                    >
                                        💬
                                    </button>
                                    <button
                                        onClick={() => deleteCard(card.id)}
                                        className="p-1.5 bg-red-600 text-white rounded hover:bg-red-500 text-xs"
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Popup Editor Modal */}
            {editingPopup && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setEditingPopup(null)}
                >
                    <div
                        className={`bg-${currentTheme.card} rounded-xl p-4 max-w-md w-full max-h-[90vh] overflow-y-auto`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-3`}>💬 Edit Popup</h2>

                        {/* Enable Toggle */}
                        <div className="flex items-center gap-2 mb-3">
                            <button
                                onClick={() => setPopupForm(prev => ({ ...prev, has_popup: !prev.has_popup }))}
                                className={`w-10 h-5 rounded-full transition-all ${popupForm.has_popup ? 'bg-green-500' : `bg-${currentTheme.border}`}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-all ${popupForm.has_popup ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                            </button>
                            <span className={`text-${currentTheme.text} text-sm font-medium`}>
                                {popupForm.has_popup ? 'Popup Enabled' : 'Popup Disabled'}
                            </span>
                        </div>

                        {popupForm.has_popup && (
                            <>
                                {/* Title */}
                                <div className="mb-2">
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Title *</label>
                                    <input
                                        type="text"
                                        value={popupForm.popup_title}
                                        onChange={(e) => setPopupForm(prev => ({ ...prev, popup_title: e.target.value }))}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    />
                                </div>

                                {/* Message */}
                                <div className="mb-2">
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Message *</label>
                                    <textarea
                                        value={popupForm.popup_message}
                                        onChange={(e) => setPopupForm(prev => ({ ...prev, popup_message: e.target.value }))}
                                        rows={2}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    />
                                </div>

                                {/* Image Upload */}
                                <div className="mb-2">
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Image (optional)</label>
                                    <div className="flex gap-2">
                                        <label className="px-2 py-1 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-500 text-xs">
                                            Upload
                                            <input type="file" accept="image/*" onChange={handlePopupImageUpload} className="hidden" />
                                        </label>
                                        {popupForm.popup_image_url && (
                                            <button
                                                onClick={() => setPopupForm(prev => ({ ...prev, popup_image_url: '' }))}
                                                className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    {popupForm.popup_image_url && (
                                        <img src={popupForm.popup_image_url} alt="Preview" className="mt-1 h-16 rounded" />
                                    )}
                                </div>

                                {/* Colors */}
                                <div className="space-y-2 mb-2">
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Solid Background</label>
                                        <div className="flex flex-wrap gap-1">
                                            {BG_COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setPopupForm(prev => ({ ...prev, popup_bg_color: color.value }))}
                                                    className={`w-4 h-4 rounded border ${popupForm.popup_bg_color === color.value ? 'border-white ring-1 ring-blue-400' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Gradient Background</label>
                                        <div className="flex flex-wrap gap-1">
                                            {GRADIENT_COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setPopupForm(prev => ({ ...prev, popup_bg_color: color.value }))}
                                                    className={`w-6 h-4 rounded border ${popupForm.popup_bg_color === color.value ? 'border-white ring-1 ring-blue-400' : 'border-transparent'}`}
                                                    style={{ background: color.value }}
                                                    title={color.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Text Color</label>
                                        <div className="flex flex-wrap gap-1">
                                            {TEXT_COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setPopupForm(prev => ({ ...prev, popup_text_color: color.value }))}
                                                    className={`w-4 h-4 rounded border ${popupForm.popup_text_color === color.value ? 'border-white ring-1 ring-blue-400' : 'border-gray-500'}`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* CTA */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>CTA Button Text</label>
                                        <input
                                            type="text"
                                            value={popupForm.popup_cta_text}
                                            onChange={(e) => setPopupForm(prev => ({ ...prev, popup_cta_text: e.target.value }))}
                                            placeholder="e.g. Learn More"
                                            className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>CTA URL</label>
                                        <input
                                            type="url"
                                            value={popupForm.popup_cta_url}
                                            onChange={(e) => setPopupForm(prev => ({ ...prev, popup_cta_url: e.target.value }))}
                                            placeholder="https://..."
                                            className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        />
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="mb-3">
                                    <p className={`text-xs text-${currentTheme.textMuted} mb-1`}>Preview:</p>
                                    <div
                                        className="rounded-lg overflow-hidden max-w-[200px]"
                                        style={{ background: popupForm.popup_bg_color }}
                                    >
                                        {popupForm.popup_image_url && (
                                            <img src={popupForm.popup_image_url} alt="Preview" className="w-full h-16 object-cover" />
                                        )}
                                        <div className="p-2">
                                            <h3 className="font-bold text-xs text-center mb-1" style={{ color: popupForm.popup_text_color }}>
                                                {popupForm.popup_title || 'Title'}
                                            </h3>
                                            <p className="text-[10px] text-center mb-2" style={{ color: popupForm.popup_text_color, opacity: 0.9 }}>
                                                {popupForm.popup_message || 'Message'}
                                            </p>
                                            {popupForm.popup_cta_text && (
                                                <div className="text-center">
                                                    <span
                                                        className="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
                                                        style={{ backgroundColor: popupForm.popup_text_color, color: popupForm.popup_bg_color }}
                                                    >
                                                        {popupForm.popup_cta_text}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={savePopup}
                                className="flex-1 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setEditingPopup(null)}
                                className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.text} rounded text-sm font-medium hover:opacity-80`}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewCard && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setPreviewCard(null)}
                >
                    <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                        {/* Close button */}
                        <button
                            onClick={() => setPreviewCard(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 text-sm"
                        >
                            ✕ Close
                        </button>

                        {/* Card preview */}
                        {previewCard.card_type === 'uploaded' && previewCard.image_url ? (
                            <img
                                src={previewCard.image_url}
                                alt={previewCard.title}
                                className="w-full rounded-xl shadow-2xl"
                            />
                        ) : (
                            <div
                                className="w-full aspect-[7/4] rounded-xl flex flex-col items-center justify-center p-6 shadow-2xl"
                                style={{ backgroundColor: previewCard.card_color || '#4F46E5' }}
                            >
                                <p className="font-bold text-2xl text-center" style={{ color: previewCard.text_color || '#FFFFFF' }}>
                                    {previewCard.title}
                                </p>
                                {previewCard.message && (
                                    <p className="text-base text-center mt-2" style={{ color: previewCard.text_color || '#FFFFFF' }}>
                                        {previewCard.message}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Card info */}
                        <div className={`mt-3 text-center`}>
                            <p className="text-white text-sm font-medium">{previewCard.title}</p>
                            <p className="text-gray-400 text-xs mt-1">
                                {previewCard.card_type === 'uploaded' ? 'Uploaded Image' : 'Template Card'}
                                {previewCard.has_popup && ' • Has Popup'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
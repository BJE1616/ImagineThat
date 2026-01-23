'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import Tooltip from '@/components/Tooltip'

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

const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]

const CATEGORIES = [
    {
        value: 'Home Services',
        label: 'Home Services (Plumbing, HVAC, Cleaning, etc.)',
        subcategories: ['Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Landscaping', 'Lawn Care', 'Tree Trimming', 'Pest Control', 'Other']
    },
    {
        value: 'Handyman',
        label: 'Handyman (Repairs, Painting, Pressure Washing, etc.)',
        subcategories: ['General Repairs', 'Furniture Assembly', 'Drywall / Patching', 'Painting', 'Mounting & Installation', 'Pressure Washing', 'Gutter Cleaning', 'Other']
    },
    {
        value: 'Restaurant / Food',
        label: 'Restaurant / Food (Restaurants, Cafes, Catering, etc.)',
        subcategories: ['Restaurants', 'Cafes', 'Bakeries', 'Catering', 'Food Trucks', 'Other']
    },
    {
        value: 'Retail / Shopping',
        label: 'Retail / Shopping (Clothing, Furniture, Gift Shops, etc.)',
        subcategories: ['Clothing', 'Furniture', 'Gift Shops', 'Hardware Stores', 'Other']
    },
    {
        value: 'Professional Services',
        label: 'Professional Services (Accounting, Consulting, Marketing, etc.)',
        subcategories: ['Accounting', 'Consulting', 'Marketing', 'IT Support', 'Photography', 'Other']
    },
    {
        value: 'Health & Wellness',
        label: 'Health & Wellness (Doctors, Dentists, Therapy, etc.)',
        subcategories: ['Doctors', 'Dentists', 'Chiropractors', 'Therapy', 'Massage', 'Other']
    },
    {
        value: 'Automotive',
        label: 'Automotive (Mechanics, Detailing, Towing, etc.)',
        subcategories: ['Mechanics', 'Car Dealers', 'Detailing', 'Towing', 'Oil Change', 'Other']
    },
    {
        value: 'Real Estate',
        label: 'Real Estate (Realtors, Mortgage, Home Inspection, etc.)',
        subcategories: ['Realtors', 'Property Management', 'Mortgage', 'Home Inspection', 'Other']
    },
    {
        value: 'Entertainment',
        label: 'Entertainment (Event Venues, DJs, Musicians, etc.)',
        subcategories: ['Event Venues', 'DJs', 'Musicians', 'Party Rentals', 'Other']
    },
    {
        value: 'Beauty / Salon',
        label: 'Beauty / Salon (Hair Salons, Barbers, Spas, etc.)',
        subcategories: ['Hair Salons', 'Barbers', 'Nail Salons', 'Spas', 'Makeup Artists', 'Other']
    },
    {
        value: 'Fitness',
        label: 'Fitness (Gyms, Personal Trainers, Yoga, etc.)',
        subcategories: ['Gyms', 'Personal Trainers', 'Yoga Studios', 'Sports Coaching', 'Other']
    },
    {
        value: 'Legal',
        label: 'Legal (Lawyers, Notary, Mediation, etc.)',
        subcategories: ['Lawyers', 'Notary', 'Mediation', 'Other']
    },
    {
        value: 'Financial',
        label: 'Financial (Banks, Insurance, Financial Advisors, etc.)',
        subcategories: ['Banks', 'Insurance', 'Financial Advisors', 'Tax Prep', 'Other']
    },
    {
        value: 'Technology',
        label: 'Technology (Software, Web Design, Computer Repair, etc.)',
        subcategories: ['Software', 'Web Design', 'Computer Repair', 'App Development', 'Other']
    },
    {
        value: 'Education',
        label: 'Education (Tutoring, Schools, Music Lessons, etc.)',
        subcategories: ['Tutoring', 'Schools', 'Training Centers', 'Music Lessons', 'Other']
    },
    {
        value: 'Pet Services',
        label: 'Pet Services (Veterinarians, Groomers, Pet Sitting, etc.)',
        subcategories: ['Veterinarians', 'Groomers', 'Pet Sitting', 'Dog Training', 'Other']
    },
    {
        value: 'Platform Promo',
        label: 'Platform Promo (AdVANTAGEOUS promotional cards)',
        subcategories: []
    },
    {
        value: 'Other',
        label: 'Other (Not listed above - enter your own)',
        subcategories: []
    },
    {
        value: 'Prefer Not to List',
        label: 'Prefer Not to List',
        subcategories: []
    }
]

export default function PromoCardsPage() {
    const { currentTheme } = useTheme()
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState(null)

    // Template card form
    const [showTemplateForm, setShowTemplateForm] = useState(false)
    const [editingCardId, setEditingCardId] = useState(null) // Track if we're editing
    const [templateForm, setTemplateForm] = useState({
        title: '',
        message: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF',
        city: '',
        state: '',
        business_category: '',
        business_subcategory: [],
        custom_category: '',
        custom_subcategory: ''
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

    const handleCategoryChange = (e) => {
        const newCategory = e.target.value
        setTemplateForm({
            ...templateForm,
            business_category: newCategory,
            business_subcategory: [],
            custom_category: '',
            custom_subcategory: ''
        })
    }

    const handleSubcategoryChange = (subcategory) => {
        const current = templateForm.business_subcategory || []

        if (current.includes(subcategory)) {
            setTemplateForm({
                ...templateForm,
                business_subcategory: current.filter(s => s !== subcategory),
                custom_subcategory: subcategory === 'Other' ? '' : templateForm.custom_subcategory
            })
        } else {
            if (current.length >= 3) {
                setMessage({ type: 'error', text: 'You can select up to 3 subcategories maximum.' })
                setTimeout(() => setMessage(null), 3000)
                return
            }
            setTemplateForm({
                ...templateForm,
                business_subcategory: [...current, subcategory]
            })
        }
    }

    const getSelectedCategoryData = () => {
        return CATEGORIES.find(c => c.value === templateForm.business_category)
    }

    const resetTemplateForm = () => {
        setTemplateForm({
            title: '',
            message: '',
            card_color: '#4F46E5',
            text_color: '#FFFFFF',
            city: '',
            state: '',
            business_category: '',
            business_subcategory: [],
            custom_category: '',
            custom_subcategory: ''
        })
        setEditingCardId(null)
        setShowTemplateForm(false)
    }

    const openEditForm = (card) => {
        // Check if category is a known value or custom
        const knownCategory = CATEGORIES.find(c => c.value === card.business_category)

        setTemplateForm({
            title: card.title || '',
            message: card.message || '',
            card_color: card.card_color || '#4F46E5',
            text_color: card.text_color || '#FFFFFF',
            city: card.city || '',
            state: card.state || '',
            business_category: knownCategory ? card.business_category : (card.business_category ? 'Other' : ''),
            business_subcategory: card.business_subcategory || [],
            custom_category: knownCategory ? '' : (card.business_category || ''),
            custom_subcategory: ''
        })
        setEditingCardId(card.id)
        setShowTemplateForm(true)
    }

    const createOrUpdateCard = async () => {
        if (!templateForm.title.trim()) {
            setMessage({ type: 'error', text: 'Title is required' })
            return
        }

        if (!templateForm.business_category) {
            setMessage({ type: 'error', text: 'Business Category is required' })
            return
        }

        try {
            // Determine final category and subcategory values
            const finalCategory = templateForm.business_category === 'Other'
                ? templateForm.custom_category
                : templateForm.business_category

            let finalSubcategory = [...(templateForm.business_subcategory || [])]
            if (finalSubcategory.includes('Other') && templateForm.custom_subcategory) {
                finalSubcategory = finalSubcategory.map(s =>
                    s === 'Other' ? templateForm.custom_subcategory : s
                )
            }

            const cardData = {
                title: templateForm.title,
                message: templateForm.message,
                card_color: templateForm.card_color,
                text_color: templateForm.text_color,
                city: templateForm.city || '',
                state: templateForm.state || '',
                business_category: finalCategory || '',
                business_subcategory: finalSubcategory.length > 0 ? finalSubcategory : null,
                updated_at: new Date().toISOString()
            }

            if (editingCardId) {
                // Update existing card
                const { error } = await supabase
                    .from('business_cards')
                    .update(cardData)
                    .eq('id', editingCardId)

                if (error) throw error
                setMessage({ type: 'success', text: 'Card updated!' })
            } else {
                // Create new card
                const { error } = await supabase
                    .from('business_cards')
                    .insert([{
                        ...cardData,
                        card_type: 'template',
                        is_house_card: true
                    }])

                if (error) throw error
                setMessage({ type: 'success', text: 'Promo card created!' })
            }

            resetTemplateForm()
            loadCards()
        } catch (error) {
            console.error('Error saving card:', error)
            setMessage({ type: 'error', text: 'Failed to save card' })
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
                    <Tooltip text="These settings apply to ALL promo cards globally, not just individual cards. They control how often promo cards appear across all games (Slots, Solitaire, Memory).">
                        <span className={`text-sm font-bold text-${currentTheme.text}`}>⚙️ Global Display Settings</span>
                    </Tooltip>

                    <div className="flex items-center gap-1.5">
                        <Tooltip text="Controls the ratio of promo cards mixed with advertiser cards. Example: '10' means 1 promo card is added for every 10 advertiser cards in the game pool. Lower number = more promo exposure.">
                            <span className={`text-xs text-${currentTheme.textMuted}`}>1 promo per</span>
                        </Tooltip>
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
                        <Tooltip text="When ON: If no paying advertisers exist, games will show promo cards instead. When OFF: Games show nothing if no advertisers. Keep ON for launch when you don't have advertisers yet.">
                            <span className={`text-xs text-${currentTheme.textMuted}`}>
                                {fallbackEnabled ? 'Fallback ON' : 'Fallback OFF'}
                            </span>
                        </Tooltip>
                    </div>

                    <button
                        onClick={saveSettings}
                        disabled={savingSettings}
                        className={`px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-500 disabled:opacity-50`}
                    >
                        {savingSettings ? '...' : '💾 Save Settings'}
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
                        onClick={() => {
                            if (showTemplateForm) {
                                resetTemplateForm()
                            } else {
                                setShowTemplateForm(true)
                            }
                        }}
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

                        {/* Editing indicator */}
                        {editingCardId && (
                            <div className="mb-3 p-2 bg-amber-500/20 border border-amber-500 rounded-lg">
                                <p className="text-amber-500 text-xs font-bold">✏️ Editing existing card</p>
                            </div>
                        )}

                        {/* Basic Info */}
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
                        </div>

                        {/* Business Type Section */}
                        <div className={`mt-4 pt-3 border-t border-${currentTheme.border}`}>
                            <p className={`text-${currentTheme.accent} font-semibold text-xs mb-2`}>📁 Business Type</p>

                            <div className={`bg-${currentTheme.card}/50 p-2 rounded-lg border border-${currentTheme.border}`}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Business Category *</label>
                                        <select
                                            value={templateForm.business_category}
                                            onChange={handleCategoryChange}
                                            className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        >
                                            <option value="">Select Category *</option>
                                            {CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {templateForm.business_category === 'Other' && (
                                        <div>
                                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Enter Your Category *</label>
                                            <input
                                                type="text"
                                                value={templateForm.custom_category}
                                                onChange={(e) => setTemplateForm(prev => ({ ...prev, custom_category: e.target.value }))}
                                                className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                                placeholder="e.g. Mobile Car Wash"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Subcategory Checkboxes */}
                                {templateForm.business_category &&
                                    templateForm.business_category !== 'Other' &&
                                    templateForm.business_category !== 'Prefer Not to List' &&
                                    templateForm.business_category !== 'Platform Promo' &&
                                    getSelectedCategoryData()?.subcategories?.length > 0 && (
                                        <div className="mt-3">
                                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                                                Services / Subcategories <span className="text-slate-500">(select up to 3)</span>
                                            </label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                                                {getSelectedCategoryData().subcategories.map(sub => (
                                                    <label
                                                        key={sub}
                                                        className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer transition-all text-xs ${templateForm.business_subcategory?.includes(sub)
                                                            ? `bg-${currentTheme.accent}/20 border border-${currentTheme.accent}`
                                                            : `bg-${currentTheme.card} border border-${currentTheme.border} hover:border-slate-500`
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={templateForm.business_subcategory?.includes(sub) || false}
                                                            onChange={() => handleSubcategoryChange(sub)}
                                                            className="w-3 h-3 accent-amber-500"
                                                        />
                                                        <span className={`text-${currentTheme.text}`}>{sub}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className={`text-xs text-${currentTheme.textMuted} mt-1`}>
                                                {templateForm.business_subcategory?.length || 0}/3 selected
                                            </p>
                                        </div>
                                    )}

                                {/* Custom Subcategory Input */}
                                {templateForm.business_subcategory?.includes('Other') && (
                                    <div className="mt-2">
                                        <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Enter Your Service</label>
                                        <input
                                            type="text"
                                            value={templateForm.custom_subcategory}
                                            onChange={(e) => setTemplateForm(prev => ({ ...prev, custom_subcategory: e.target.value }))}
                                            className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                            placeholder="e.g. Window Cleaning"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className={`mt-4 pt-3 border-t border-${currentTheme.border}`}>
                            <p className={`text-${currentTheme.accent} font-semibold text-xs mb-2`}>📍 Location</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>City <span className="text-slate-500">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={templateForm.city}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, city: e.target.value }))}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        placeholder="e.g. Dallas"
                                    />
                                </div>

                                <div>
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>State <span className="text-slate-500">(optional)</span></label>
                                    <select
                                        value={templateForm.state}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, state: e.target.value }))}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                    >
                                        <option value="">Select State</option>
                                        {US_STATES.map(state => (
                                            <option key={state} value={state}>{state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Appearance Section */}
                        <div className={`mt-4 pt-3 border-t border-${currentTheme.border}`}>
                            <p className={`text-${currentTheme.accent} font-semibold text-xs mb-2`}>🎨 Appearance</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        </div>

                        {/* Preview & Actions */}
                        <div className="mt-4 flex items-center gap-3">
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
                                    onClick={createOrUpdateCard}
                                    className={`px-4 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-500`}
                                >
                                    {editingCardId ? '✅ Save Card Changes' : '➕ Create Card'}
                                </button>
                                <button
                                    onClick={resetTemplateForm}
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
                                        onClick={() => openEditForm(card)}
                                        className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-400 text-xs"
                                        title="Edit Card"
                                    >
                                        ✏️
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
                                ✅ Save Popup
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
                            {(previewCard.city || previewCard.state || previewCard.business_category) && (
                                <p className="text-gray-500 text-xs mt-1">
                                    {previewCard.business_category && <span>{previewCard.business_category}</span>}
                                    {previewCard.city && <span> • {previewCard.city}</span>}
                                    {previewCard.state && <span>, {previewCard.state}</span>}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
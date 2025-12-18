'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function CardsPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [cardType, setCardType] = useState('template')
    const [formData, setFormData] = useState({
        business_name: '',
        tagline: '',
        description: '',
        phone: '',
        email: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF'
    })
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [hasActiveCampaign, setHasActiveCampaign] = useState(false)
    const [userData, setUserData] = useState(null)
    const [cardsInUse, setCardsInUse] = useState([])

    const colorOptions = [
        { name: 'Indigo', value: '#4F46E5' },
        { name: 'Blue', value: '#2563EB' },
        { name: 'Green', value: '#16A34A' },
        { name: 'Red', value: '#DC2626' },
        { name: 'Purple', value: '#9333EA' },
        { name: 'Orange', value: '#EA580C' },
        { name: 'Teal', value: '#0D9488' },
        { name: 'Pink', value: '#DB2777' },
        { name: 'Slate', value: '#475569' },
        { name: 'Black', value: '#1F2937' },
    ]

    const textColorOptions = [
        { name: 'White', value: '#FFFFFF' },
        { name: 'Black', value: '#1F2937' },
        { name: 'Yellow', value: '#FDE047' },
        { name: 'Light Gray', value: '#E5E7EB' },
    ]

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/auth/login')
                return
            }

            setUser(authUser)

            const { data: userDataResult } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            setUserData(userDataResult)

            await loadCards(authUser.id)

            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('id, business_card_id')
                .eq('user_id', authUser.id)
                .in('status', ['active', 'queued'])

            setHasActiveCampaign(campaignData && campaignData.length > 0)

            if (campaignData && campaignData.length > 0) {
                const inUseIds = campaignData
                    .filter(c => c.business_card_id)
                    .map(c => c.business_card_id)
                setCardsInUse(inUseIds)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadCards = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCards(data || [])
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const formatPhone = (value) => {
        const digits = value.replace(/\D/g, '')

        if (digits.length <= 3) {
            return digits.length ? `(${digits}` : ''
        } else if (digits.length <= 6) {
            return `(${digits.slice(0, 3)})-${digits.slice(3)}`
        } else {
            return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
        }
    }

    const handlePhoneChange = (e) => {
        const formatted = formatPhone(e.target.value)
        setFormData({
            ...formData,
            phone: formatted
        })
    }

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            const maxSize = 2 * 1024 * 1024
            if (file.size > maxSize) {
                alert('Image is too large. Maximum size is 2MB.')
                e.target.value = ''
                return
            }

            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result)
            }
            reader.readAsDataURL(file)
        }
    }

    const uploadImage = async () => {
        if (!imageFile) return null

        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('business-card-images')
            .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('business-card-images')
            .getPublicUrl(filePath)

        return data.publicUrl
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setUploading(true)

        try {
            let imageUrl = ''

            if (cardType === 'uploaded') {
                if (!imageFile) {
                    alert('Please select an image to upload')
                    setUploading(false)
                    return
                }
                imageUrl = await uploadImage()
            }

            const { data, error } = await supabase
                .from('business_cards')
                .insert([{
                    user_id: user.id,
                    card_type: cardType,
                    title: formData.business_name || 'Business Card',
                    business_name: formData.business_name || 'Business Card',
                    tagline: formData.tagline || '',
                    message: formData.description || formData.tagline || '',
                    phone: formData.phone || '',
                    email: formData.email || '',
                    card_color: formData.card_color,
                    text_color: formData.text_color,
                    image_url: imageUrl || ''
                }])
                .select()

            if (error) throw error

            if (!hasActiveCampaign) {
                if (confirm('Business card created! Ready to start advertising?')) {
                    router.push('/advertise')
                    return
                }
            } else {
                alert('Business card created successfully!')
            }
            setShowForm(false)
            setCardType('template')
            setFormData({
                business_name: '',
                tagline: '',
                description: '',
                phone: '',
                email: '',
                card_color: '#4F46E5',
                text_color: '#FFFFFF'
            })
            setImageFile(null)
            setImagePreview(null)
            await loadCards(user.id)
        } catch (error) {
            alert('Error creating card: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const isCardInUse = (cardId) => {
        return cardsInUse.includes(cardId)
    }

    const handleDelete = async (cardId) => {
        if (isCardInUse(cardId)) {
            alert('This card is being used by an active or queued campaign. You can delete it after the campaign completes.')
            return
        }

        if (!confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('business_cards')
                .delete()
                .eq('id', cardId)

            if (error) throw error

            alert('Card deleted successfully!')
            await loadCards(user.id)
        } catch (error) {
            alert('Error deleting card: ' + error.message)
        }
    }

    const maxCards = userData?.role === 'admin' ? 10 : 5

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-12 h-12 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted} font-medium`}>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className={`text-3xl font-bold text-${currentTheme.text}`}>My Business Cards</h1>
                        <p className={`text-${currentTheme.textMuted} text-sm mt-1`}>{cards.length}/{maxCards} cards created</p>
                    </div>
                    {!showForm && cards.length < maxCards && (
                        <button
                            onClick={() => setShowForm(true)}
                            className={`px-4 py-2 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:bg-${currentTheme.accentHover} transition-all`}
                        >
                            + New Card
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 mb-8`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={`text-xl font-bold text-${currentTheme.text}`}>Create New Card</h2>
                            <button
                                onClick={() => {
                                    setShowForm(false)
                                    setImagePreview(null)
                                    setImageFile(null)
                                }}
                                className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        <div className="flex gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => setCardType('template')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${cardType === 'template'
                                    ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                    : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                    }`}
                            >
                                Create Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setCardType('uploaded')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${cardType === 'uploaded'
                                    ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                    : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                    }`}
                            >
                                Upload Image
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {cardType === 'uploaded' ? (
                                <>
                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                            Upload Business Card Image *
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-md text-${currentTheme.text}`}
                                            required
                                        />
                                        <p className={`text-xs text-${currentTheme.textMuted} mt-1`}>
                                            Upload a photo or scan of your business card (max 2MB)
                                        </p>
                                    </div>

                                    {imagePreview && (
                                        <div className="mt-4">
                                            <p className={`text-sm font-medium text-${currentTheme.textMuted} mb-2`}>Preview:</p>
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className={`max-w-md rounded-lg border-2 border-${currentTheme.border}`}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                            Business Name * <span className={`text-xs text-${currentTheme.textMuted}`}>(20 chars max)</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="business_name"
                                            required
                                            maxLength={20}
                                            className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-md text-${currentTheme.text}`}
                                            placeholder="Your Business Name"
                                            value={formData.business_name || ''}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                            Tagline / Message <span className={`text-xs text-${currentTheme.textMuted}`}>(40 chars max)</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="tagline"
                                            maxLength={40}
                                            className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-md text-${currentTheme.text}`}
                                            placeholder="Your catchy tagline"
                                            value={formData.tagline || ''}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                                Phone
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-md text-${currentTheme.text}`}
                                                placeholder="(555)-555-5555"
                                                value={formData.phone || ''}
                                                onChange={handlePhoneChange}
                                                maxLength={14}
                                            />
                                        </div>

                                        <div>
                                            <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-md text-${currentTheme.text}`}
                                                placeholder="your@email.com"
                                                value={formData.email || ''}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-2`}>
                                            Card Background Color
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {colorOptions.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, card_color: color.value })}
                                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.card_color === color.value
                                                        ? `border-${currentTheme.accent} scale-110`
                                                        : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                                        }`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-2`}>
                                            Text Color
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {textColorOptions.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, text_color: color.value })}
                                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.text_color === color.value
                                                        ? `border-${currentTheme.accent} scale-110`
                                                        : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                                        }`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-2`}>
                                            Preview
                                        </label>
                                        <p className={`text-xs text-${currentTheme.textMuted} mb-3`}>
                                            📱 Your card appears small in the game. Phone & email show when players tap the 👁 icon.
                                        </p>
                                        <div className="flex gap-6 items-start flex-wrap">
                                            <div>
                                                <p className={`text-xs text-${currentTheme.textMuted} mb-1`}>Full Preview:</p>
                                                <div
                                                    className={`w-full max-w-xs aspect-[4/3] rounded-lg p-4 flex flex-col justify-between border-2 border-${currentTheme.border}`}
                                                    style={{ backgroundColor: formData.card_color }}
                                                >
                                                    <div className="text-center">
                                                        <h3 className="font-bold text-sm sm:text-base" style={{ color: formData.text_color }}>
                                                            {formData.business_name || 'Business Name'}
                                                        </h3>
                                                    </div>
                                                    <div className="text-center flex-1 flex items-center justify-center">
                                                        <p className="text-xs sm:text-sm" style={{ color: formData.text_color, opacity: 0.8 }}>
                                                            {formData.tagline || 'Your tagline here'}
                                                        </p>
                                                    </div>
                                                    <div className="text-center text-sm" style={{ color: formData.text_color }}>
                                                        {formData.phone && <p>{formData.phone}</p>}
                                                        {formData.email && <p>{formData.email}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <p className={`text-xs text-${currentTheme.textMuted} mb-1`}>In-Game Size:</p>
                                                <div
                                                    className={`w-24 aspect-[4/3] rounded-md p-1 flex flex-col justify-between border border-${currentTheme.border}`}
                                                    style={{ backgroundColor: formData.card_color }}
                                                >
                                                    <div className="text-center overflow-hidden">
                                                        <h3 className="font-bold text-xs truncate" style={{ color: formData.text_color }}>
                                                            {formData.business_name || 'Business Name'}
                                                        </h3>
                                                    </div>
                                                    <div className="text-center flex-1 flex items-center justify-center overflow-hidden">
                                                        <p className="text-xs line-clamp-2" style={{ color: formData.text_color, opacity: 0.8 }}>
                                                            {formData.tagline || 'Tagline'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={uploading}
                                className={`w-full py-3 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} rounded-lg hover:bg-${currentTheme.accentHover} disabled:bg-${currentTheme.border} disabled:text-${currentTheme.textMuted} font-bold transition-all`}
                            >
                                {uploading ? 'Creating...' : 'Create Business Card'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cards.length === 0 && !showForm && (
                        <div className="col-span-full text-center py-12">
                            <p className={`text-${currentTheme.textMuted} text-lg mb-4`}>You haven't created any business cards yet.</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className={`px-6 py-3 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:bg-${currentTheme.accentHover} transition-all`}
                            >
                                Create Your First Card
                            </button>
                        </div>
                    )}

                    {cards.length >= maxCards && !showForm && (
                        <div className="col-span-full text-center py-4">
                            <p className={`text-${currentTheme.textMuted} text-sm`}>You've reached the maximum of {maxCards} business cards.</p>
                        </div>
                    )}

                    {cards.map((card) => (
                        <div key={card.id} className="relative group">
                            {isCardInUse(card.id) && (
                                <div className="absolute -top-2 -left-2 z-10 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                    In Use
                                </div>
                            )}

                            <button
                                onClick={() => handleDelete(card.id)}
                                className={`absolute -top-2 -right-2 z-10 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 ${isCardInUse(card.id)
                                    ? `bg-${currentTheme.textMuted} text-${currentTheme.card} cursor-not-allowed`
                                    : 'bg-red-500 text-white hover:bg-red-600'
                                    }`}
                                title={isCardInUse(card.id) ? 'Cannot delete - card is in use' : 'Delete card'}
                            >
                                {isCardInUse(card.id) ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>

                            {card.card_type === 'uploaded' && card.image_url ? (
                                <div className={`bg-${currentTheme.card} border rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center ${isCardInUse(card.id) ? 'border-green-500' : `border-${currentTheme.border}`
                                    }`}>
                                    <img
                                        src={card.image_url}
                                        alt="Business Card"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div
                                    className={`rounded-xl p-3 aspect-[4/3] flex flex-col justify-between border ${isCardInUse(card.id) ? 'border-green-500' : `border-${currentTheme.border}`
                                        }`}
                                    style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                >
                                    <div>
                                        <h3 className="font-bold text-lg" style={{ color: card.text_color || '#FFFFFF' }}>
                                            {card.title || card.business_name}
                                        </h3>
                                        {(card.message || card.tagline) && (
                                            <p className="text-sm mt-1" style={{ color: card.text_color || '#FFFFFF', opacity: 0.8 }}>
                                                {card.message || card.tagline}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-sm" style={{ color: card.text_color || '#FFFFFF' }}>
                                        <p>{card.phone}</p>
                                        <p>{card.email}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
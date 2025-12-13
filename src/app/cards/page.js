'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CardsPage() {
    const router = useRouter()
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

    // Preset color options
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
            await loadCards(authUser.id)
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

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (file) {
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
                    message: formData.description || formData.tagline || '',
                    phone: formData.phone || '',
                    email: formData.email || '',
                    card_color: formData.card_color,
                    text_color: formData.text_color,
                    image_url: imageUrl || ''
                }])
                .select()

            if (error) throw error

            alert('Business card created successfully!')
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

    const handleDelete = async (cardId) => {
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">My Business Cards</h1>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all"
                        >
                            + New Card
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Create New Card</h2>
                            <button
                                onClick={() => {
                                    setShowForm(false)
                                    setImagePreview(null)
                                    setImageFile(null)
                                }}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        {/* Card Type Toggle */}
                        <div className="flex gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => setCardType('template')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${cardType === 'template'
                                        ? 'bg-amber-500 text-slate-900'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Create Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setCardType('uploaded')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${cardType === 'uploaded'
                                        ? 'bg-amber-500 text-slate-900'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Upload Image
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {cardType === 'uploaded' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Upload Business Card Image *
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            required
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Upload a photo or scan of your business card
                                        </p>
                                    </div>

                                    {imagePreview && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-slate-300 mb-2">Preview:</p>
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="max-w-md rounded-lg border-2 border-slate-600"
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Business Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="business_name"
                                            required
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            placeholder="Your Business Name"
                                            value={formData.business_name}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Tagline / Message
                                        </label>
                                        <input
                                            type="text"
                                            name="tagline"
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            placeholder="Your catchy tagline"
                                            value={formData.tagline}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                                Phone *
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                required
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                                placeholder="(555) 123-4567"
                                                value={formData.phone}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                                Email *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                                placeholder="your@email.com"
                                                value={formData.email}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    {/* Card Color Picker */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Card Background Color
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {colorOptions.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, card_color: color.value })}
                                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.card_color === color.value
                                                            ? 'border-amber-400 scale-110'
                                                            : 'border-slate-600 hover:border-slate-400'
                                                        }`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Text Color Picker */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Text Color
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {textColorOptions.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, text_color: color.value })}
                                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.text_color === color.value
                                                            ? 'border-amber-400 scale-110'
                                                            : 'border-slate-600 hover:border-slate-400'
                                                        }`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Card Preview */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Preview
                                        </label>
                                        <div
                                            className="w-full max-w-xs h-40 rounded-lg p-4 flex flex-col justify-between border-2 border-slate-600"
                                            style={{ backgroundColor: formData.card_color }}
                                        >
                                            <div>
                                                <h3 className="font-bold text-lg" style={{ color: formData.text_color }}>
                                                    {formData.business_name || 'Business Name'}
                                                </h3>
                                                <p className="text-sm mt-1" style={{ color: formData.text_color, opacity: 0.8 }}>
                                                    {formData.tagline || 'Your tagline here'}
                                                </p>
                                            </div>
                                            <div className="text-sm" style={{ color: formData.text_color }}>
                                                <p>{formData.phone || '(555) 123-4567'}</p>
                                                <p>{formData.email || 'email@example.com'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-3 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-400 font-bold transition-all"
                            >
                                {uploading ? 'Creating...' : 'Create Business Card'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.length === 0 && !showForm && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-slate-400 text-lg mb-4">You haven't created any business cards yet.</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-all"
                            >
                                Create Your First Card
                            </button>
                        </div>
                    )}

                    {cards.map((card) => (
                        <div key={card.id} className="relative group">
                            <button
                                onClick={() => handleDelete(card.id)}
                                className="absolute -top-2 -right-2 z-10 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete card"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>

                            {card.card_type === 'uploaded' && card.image_url ? (
                                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                                    <img
                                        src={card.image_url}
                                        alt="Business Card"
                                        className="w-full h-auto"
                                    />
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">
                                            {new Date(card.created_at).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                                            Image
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="rounded-xl p-4 h-44 flex flex-col justify-between border border-slate-700"
                                    style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                >
                                    <div>
                                        <h3 className="font-bold text-lg" style={{ color: card.text_color || '#FFFFFF' }}>
                                            {card.title}
                                        </h3>
                                        {card.message && (
                                            <p className="text-sm mt-1" style={{ color: card.text_color || '#FFFFFF', opacity: 0.8 }}>
                                                {card.message}
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
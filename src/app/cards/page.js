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
        email: ''
    })
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [uploading, setUploading] = useState(false)

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
                    card_color: '#4F46E5',
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
                email: ''
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-gray-600">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">My Business Cards</h1>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {!showForm && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                        >
                            + Create New Business Card
                        </button>
                    </div>
                )}

                {showForm && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">Create Business Card</h2>
                            <button
                                onClick={() => {
                                    setShowForm(false)
                                    setCardType('template')
                                    setImageFile(null)
                                    setImagePreview(null)
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Card Type
                            </label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setCardType('template')}
                                    className={`px-4 py-2 rounded-md ${cardType === 'template'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    Text Template
                                </button>
                                <button
                                    onClick={() => setCardType('uploaded')}
                                    className={`px-4 py-2 rounded-md ${cardType === 'uploaded'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    Upload Image
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {cardType === 'uploaded' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Upload Business Card Image *
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Upload a photo or scan of your business card
                                        </p>
                                    </div>

                                    {imagePreview && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="max-w-md rounded-lg border-2 border-gray-300"
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Business Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="business_name"
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                            placeholder="Your Business Name"
                                            value={formData.business_name}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tagline
                                        </label>
                                        <input
                                            type="text"
                                            name="tagline"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                            placeholder="Your catchy tagline"
                                            value={formData.tagline}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description / Message
                                        </label>
                                        <textarea
                                            name="description"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                            placeholder="Brief description of your business"
                                            value={formData.description}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Phone *
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                                placeholder="(555) 123-4567"
                                                value={formData.phone}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Email *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                                placeholder="your@email.com"
                                                value={formData.email}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 font-medium"
                            >
                                {uploading ? 'Creating...' : 'Create Business Card'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.length === 0 && !showForm && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-gray-500 text-lg mb-4">You haven't created any business cards yet.</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                                Create Your First Card
                            </button>
                        </div>
                    )}

                    {cards.map((card) => (
                        <div key={card.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow relative">
                            <button
                                onClick={() => handleDelete(card.id)}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                title="Delete card"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>

                            {card.card_type === 'uploaded' && card.image_url ? (
                                <div className="mb-4">
                                    <img
                                        src={card.image_url}
                                        alt="Business Card"
                                        className="w-full h-auto rounded-lg"
                                    />
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 pr-8">{card.title}</h3>
                                    {card.message && <p className="text-gray-600 text-sm mb-4">{card.message}</p>}
                                    <div className="border-t pt-4 space-y-2 text-sm">
                                        <p className="text-gray-700"><strong>Phone:</strong> {card.phone}</p>
                                        <p className="text-gray-700"><strong>Email:</strong> {card.email}</p>
                                    </div>
                                </>
                            )}

                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {new Date(card.created_at).toLocaleDateString()}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${card.card_type === 'uploaded' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                    {card.card_type === 'uploaded' ? 'Image' : 'Template'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
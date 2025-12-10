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
    const [formData, setFormData] = useState({
        business_name: '',
        tagline: '',
        description: '',
        phone: '',
        email: ''
    })
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

    const handleSubmit = async (e) => {
        e.preventDefault()
        setUploading(true)

        try {
            const { data, error } = await supabase
                .from('business_cards')
                .insert([{
                    user_id: user.id,
                    card_type: 'template',
                    title: formData.business_name,
                    message: formData.description || formData.tagline,
                    phone: formData.phone,
                    email: formData.email,
                    card_color: '#4F46E5',
                    image_url: ''
                }])
                .select()

            if (error) throw error

            alert('Business card created successfully!')
            setShowForm(false)
            setFormData({
                business_name: '',
                tagline: '',
                description: '',
                phone: '',
                email: ''
            })
            await loadCards(user.id)
        } catch (error) {
            alert('Error creating card: ' + error.message)
        } finally {
            setUploading(false)
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
                                onClick={() => setShowForm(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div key={card.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
                            {card.message && <p className="text-gray-600 text-sm mb-4">{card.message}</p>}

                            <div className="border-t pt-4 space-y-2 text-sm">
                                <p className="text-gray-700"><strong>Phone:</strong> {card.phone}</p>
                                <p className="text-gray-700"><strong>Email:</strong> {card.email}</p>
                            </div>

                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {new Date(card.created_at).toLocaleDateString()}
                                </span>
                                <div
                                    className="w-8 h-8 rounded-full"
                                    style={{ backgroundColor: card.card_color }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminHouseCardsPage() {
    const [houseCards, setHouseCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [showTemplateForm, setShowTemplateForm] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

    // Template form state
    const [templateData, setTemplateData] = useState({
        business_name: '',
        tagline: '',
        card_color: '#4F46E5',
        text_color: '#FFFFFF'
    })

    // Expanded color options
    const backgroundColors = [
        // Blues
        { name: 'Indigo', value: '#4F46E5' },
        { name: 'Blue', value: '#2563EB' },
        { name: 'Sky', value: '#0EA5E9' },
        { name: 'Cyan', value: '#06B6D4' },
        { name: 'Navy', value: '#1E3A8A' },
        // Greens
        { name: 'Green', value: '#16A34A' },
        { name: 'Emerald', value: '#10B981' },
        { name: 'Teal', value: '#0D9488' },
        { name: 'Lime', value: '#84CC16' },
        { name: 'Forest', value: '#166534' },
        // Reds/Pinks
        { name: 'Red', value: '#DC2626' },
        { name: 'Rose', value: '#E11D48' },
        { name: 'Pink', value: '#DB2777' },
        { name: 'Crimson', value: '#BE123C' },
        { name: 'Coral', value: '#F97316' },
        // Purples
        { name: 'Purple', value: '#9333EA' },
        { name: 'Violet', value: '#7C3AED' },
        { name: 'Fuchsia', value: '#C026D3' },
        { name: 'Plum', value: '#6B21A8' },
        // Neutrals
        { name: 'Slate', value: '#475569' },
        { name: 'Gray', value: '#6B7280' },
        { name: 'Charcoal', value: '#374151' },
        { name: 'Black', value: '#1F2937' },
        { name: 'Midnight', value: '#0F172A' },
        // Warm
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
    }, [])

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

                // Check file size (2MB limit)
                if (file.size > 2 * 1024 * 1024) {
                    alert(`Skipping ${file.name} - exceeds 2MB limit`)
                    continue
                }

                // Upload to storage
                const fileExt = file.name.split('.').pop()
                const fileName = `house-${Date.now()}-${i}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('business-card-images')
                    .upload(fileName, file)

                if (uploadError) {
                    console.error(`Error uploading ${file.name}:`, uploadError)
                    continue
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('business-card-images')
                    .getPublicUrl(fileName)

                // Create house card record - use original filename without extension as title
                const originalName = file.name.split('.').slice(0, -1).join('.')

                const { error: insertError } = await supabase
                    .from('business_cards')
                    .insert([{
                        card_type: 'uploaded',
                        title: originalName,
                        business_name: originalName,
                        image_url: urlData.publicUrl,
                        is_house_card: true
                    }])

                if (insertError) {
                    console.error(`Error creating card for ${file.name}:`, insertError)
                }
            }

            await loadHouseCards()
            e.target.value = '' // Clear input
        } catch (error) {
            console.error('Batch upload error:', error)
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

            setTemplateData({
                business_name: '',
                tagline: '',
                card_color: '#4F46E5',
                text_color: '#FFFFFF'
            })
            setShowTemplateForm(false)
            await loadHouseCards()
        } catch (error) {
            console.error('Error creating template card:', error)
            alert('Error: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (cardId, imageUrl) => {
        if (!confirm('Delete this house card?')) return

        try {
            // Delete from database
            const { error } = await supabase
                .from('business_cards')
                .delete()
                .eq('id', cardId)

            if (error) throw error

            // Try to delete from storage if it's an uploaded image
            if (imageUrl && imageUrl.includes('business-card-images')) {
                const fileName = imageUrl.split('/').pop()
                await supabase.storage
                    .from('business-card-images')
                    .remove([fileName])
            }

            await loadHouseCards()
        } catch (error) {
            console.error('Error deleting card:', error)
            alert('Error: ' + error.message)
        }
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-64"></div>
                    <div className="h-96 bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">House Cards</h1>
                <p className="text-slate-400 mt-1">Default filler cards when not enough advertisers</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total House Cards</p>
                    <p className="text-2xl font-bold text-amber-400">{houseCards.length}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Uploaded Images</p>
                    <p className="text-2xl font-bold text-blue-400">
                        {houseCards.filter(c => c.card_type === 'uploaded').length}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Template Cards</p>
                    <p className="text-2xl font-bold text-green-400">
                        {houseCards.filter(c => c.card_type === 'template').length}
                    </p>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-4">Add House Cards</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Batch Upload */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-white mb-3">📤 Batch Upload Images</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Select multiple images at once. Max 2MB each.
                        </p>
                        <label className="block">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleBatchUpload}
                                disabled={uploading}
                                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-900 file:font-bold hover:file:bg-amber-400 cursor-pointer disabled:opacity-50"
                            />
                        </label>
                        {uploadProgress.total > 0 && (
                            <div className="mt-3">
                                <div className="flex justify-between text-sm text-slate-400 mb-1">
                                    <span>Uploading...</span>
                                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                                </div>
                                <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all"
                                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Template Creator */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-white mb-3">🎨 Create Template Card</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Design a text-based card with colors.
                        </p>
                        <button
                            onClick={() => setShowTemplateForm(!showTemplateForm)}
                            className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400"
                        >
                            {showTemplateForm ? 'Hide Form' : 'Create Template'}
                        </button>
                    </div>
                </div>

                {/* Template Form */}
                {showTemplateForm && (
                    <form onSubmit={handleTemplateSubmit} className="mt-6 p-4 bg-slate-700/30 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Title / Business Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={20}
                                        value={templateData.business_name}
                                        onChange={(e) => setTemplateData({ ...templateData, business_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                        placeholder="Your Ad Here!"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Tagline / Message
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={40}
                                        value={templateData.tagline}
                                        onChange={(e) => setTemplateData({ ...templateData, tagline: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                        placeholder="Click to advertise!"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Background Color
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {backgroundColors.map((color) => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                onClick={() => setTemplateData({ ...templateData, card_color: color.value })}
                                                className={`w-8 h-8 rounded-lg border-2 transition-all ${templateData.card_color === color.value
                                                        ? 'border-white scale-110'
                                                        : 'border-transparent hover:border-slate-400'
                                                    }`}
                                                style={{ backgroundColor: color.value }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Text Color
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {textColors.map((color) => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                onClick={() => setTemplateData({ ...templateData, text_color: color.value })}
                                                className={`w-8 h-8 rounded-lg border-2 transition-all ${templateData.text_color === color.value
                                                        ? 'border-white scale-110'
                                                        : 'border-transparent hover:border-slate-400'
                                                    }`}
                                                style={{ backgroundColor: color.value }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Preview
                                </label>
                                <div
                                    className="w-full aspect-[4/3] rounded-lg p-4 flex flex-col justify-between border-2 border-slate-600"
                                    style={{ backgroundColor: templateData.card_color }}
                                >
                                    <div className="text-center">
                                        <h3 className="font-bold text-lg" style={{ color: templateData.text_color }}>
                                            {templateData.business_name || 'Title'}
                                        </h3>
                                    </div>
                                    <div className="text-center flex-1 flex items-center justify-center">
                                        <p className="text-sm" style={{ color: templateData.text_color, opacity: 0.9 }}>
                                            {templateData.tagline || 'Tagline here'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={uploading || !templateData.business_name}
                                    className="w-full mt-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? 'Creating...' : 'Create House Card'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            {/* House Cards Grid */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">
                    Existing House Cards ({houseCards.length})
                </h2>

                {houseCards.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-400 text-lg">No house cards yet.</p>
                        <p className="text-slate-500 text-sm mt-2">Upload some images or create template cards above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {houseCards.map((card) => (
                            <div key={card.id} className="relative group">
                                <button
                                    onClick={() => handleDelete(card.id, card.image_url)}
                                    className="absolute -top-2 -right-2 z-10 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {card.card_type === 'uploaded' && card.image_url ? (
                                    <div className="bg-slate-700 border border-slate-600 rounded-xl overflow-hidden aspect-[4/3]">
                                        <img
                                            src={card.image_url}
                                            alt={card.title || 'House Card'}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="rounded-xl p-3 aspect-[4/3] flex flex-col justify-between border border-slate-600"
                                        style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                    >
                                        <div className="text-center">
                                            <h3 className="font-bold text-sm" style={{ color: card.text_color || '#FFFFFF' }}>
                                                {card.title || card.business_name}
                                            </h3>
                                        </div>
                                        <div className="text-center flex-1 flex items-center justify-center">
                                            <p className="text-xs" style={{ color: card.text_color || '#FFFFFF', opacity: 0.9 }}>
                                                {card.tagline || card.message || ''}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-1 text-center">
                                    <span className="text-xs text-slate-400 truncate block">
                                        {card.title || card.business_name || 'Untitled'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
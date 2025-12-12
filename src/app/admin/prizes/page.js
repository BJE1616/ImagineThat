'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPrizesPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [currentPrize, setCurrentPrize] = useState(null)
    const [prizeType, setPrizeType] = useState('cash')
    const [numberOfWinners, setNumberOfWinners] = useState(1)
    const [prizeAmounts, setPrizeAmounts] = useState([''])
    const [prizeDescriptions, setPrizeDescriptions] = useState([''])
    const [isSurprise, setIsSurprise] = useState(false)
    const [announcementText, setAnnouncementText] = useState('')
    const [cardBackImageUrl, setCardBackImageUrl] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        loadCurrentPrize()
    }, [])

    const getWeekStart = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart.toISOString().split('T')[0]
    }

    const getWeekEnd = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const daysUntilSunday = 7 - dayOfWeek
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + daysUntilSunday)
        weekEnd.setHours(23, 59, 59, 999)
        return weekEnd
    }

    const formatWeekRange = () => {
        const weekStart = new Date(getWeekStart() + 'T00:00:00')
        const weekEnd = getWeekEnd()
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    const loadCurrentPrize = async () => {
        try {
            const weekStart = getWeekStart()

            const { data, error } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart)
                .single()

            if (data) {
                setCurrentPrize(data)
                setPrizeType(data.prize_type || 'cash')
                setNumberOfWinners(data.number_of_winners || 1)
                setPrizeAmounts(data.prize_amounts || [''])
                setPrizeDescriptions(data.prize_descriptions || [''])
                setIsSurprise(data.is_surprise || false)
                setAnnouncementText(data.announcement_text || '')
                setCardBackImageUrl(data.card_back_image_url || '')
            }
        } catch (error) {
            console.log('No prize set for this week yet')
        } finally {
            setLoading(false)
        }
    }

    const handleNumberOfWinnersChange = (num) => {
        setNumberOfWinners(num)
        const newAmounts = [...prizeAmounts]
        const newDescriptions = [...prizeDescriptions]
        while (newAmounts.length < num) {
            newAmounts.push('')
            newDescriptions.push('')
        }
        while (newAmounts.length > num) {
            newAmounts.pop()
            newDescriptions.pop()
        }
        setPrizeAmounts(newAmounts)
        setPrizeDescriptions(newDescriptions)
    }

    const handleAmountChange = (index, value) => {
        const newAmounts = [...prizeAmounts]
        newAmounts[index] = value
        setPrizeAmounts(newAmounts)
    }

    const handleDescriptionChange = (index, value) => {
        const newDescriptions = [...prizeDescriptions]
        newDescriptions[index] = value
        setPrizeDescriptions(newDescriptions)
    }

    const calculateTotal = () => {
        if (prizeType !== 'cash') return 0
        return prizeAmounts.reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `card-back-${Date.now()}.${fileExt}`
            const filePath = `card-backs/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('game-assets')
                .upload(filePath, file)

            if (uploadError) {
                // Try creating the bucket if it doesn't exist
                if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                    setMessage('Please create a storage bucket named "game-assets" in Supabase first.')
                    return
                }
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage
                .from('game-assets')
                .getPublicUrl(filePath)

            setCardBackImageUrl(publicUrl)
            setMessage('Image uploaded successfully!')
        } catch (error) {
            console.error('Error uploading image:', error)
            setMessage('Error uploading image. Make sure you have a "game-assets" storage bucket.')
        } finally {
            setUploading(false)
        }
    }

    const savePrize = async () => {
        setSaving(true)
        setMessage('')

        try {
            const weekStart = getWeekStart()
            const weekEnd = getWeekEnd()

            const prizeData = {
                week_start: weekStart,
                prize_type: prizeType,
                number_of_winners: numberOfWinners,
                prize_amounts: prizeAmounts.map(a => parseFloat(a) || 0),
                prize_descriptions: prizeDescriptions,
                total_prize_pool: calculateTotal(),
                is_surprise: isSurprise,
                week_end_time: weekEnd.toISOString(),
                announcement_text: announcementText,
                card_back_image_url: cardBackImageUrl,
                is_active: true,
                updated_at: new Date().toISOString()
            }

            if (currentPrize) {
                const { error } = await supabase
                    .from('weekly_prizes')
                    .update(prizeData)
                    .eq('id', currentPrize.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('weekly_prizes')
                    .insert([prizeData])

                if (error) throw error
            }

            setMessage('Prize settings saved successfully!')
            loadCurrentPrize()
        } catch (error) {
            console.error('Error saving prize:', error)
            setMessage('Error saving prize settings')
        } finally {
            setSaving(false)
        }
    }

    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
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
                <h1 className="text-3xl font-bold text-white">Prize Settings</h1>
                <p className="text-slate-400 mt-1">Configure prizes for the current week</p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Current Week</h2>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                        {formatWeekRange()}
                    </span>
                </div>
                <p className="text-slate-400">
                    Week ends Sunday at midnight CST. Winners will be finalized after that time.
                </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-6">Prize Configuration</h2>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Prize Type
                    </label>
                    <div className="flex gap-4 flex-wrap">
                        <button
                            onClick={() => setPrizeType('cash')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${prizeType === 'cash'
                                    ? 'bg-amber-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            💵 Cash Prize
                        </button>
                        <button
                            onClick={() => setPrizeType('merchandise')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${prizeType === 'merchandise'
                                    ? 'bg-amber-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            🎽 Merchandise
                        </button>
                        <button
                            onClick={() => setPrizeType('custom')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${prizeType === 'custom'
                                    ? 'bg-amber-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            ✏️ Custom Prize
                        </button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isSurprise}
                            onChange={(e) => setIsSurprise(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-slate-300 font-medium">🎁 Keep prize a surprise (don't show details to players)</span>
                    </label>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Number of Winners
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberOfWinnersChange(num)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${numberOfWinners === num
                                        ? 'bg-green-500 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {num === 1 ? 'Single Winner' : `Top ${num}`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        {prizeType === 'cash' ? 'Prize Amounts' : 'Prize Details'}
                    </label>
                    <div className="space-y-3">
                        {prizeAmounts.map((amount, index) => (
                            <div key={index} className="flex items-center gap-4 flex-wrap">
                                <span className={`w-20 text-sm font-medium ${index === 0 ? 'text-amber-400' :
                                        index === 1 ? 'text-slate-300' :
                                            index === 2 ? 'text-amber-600' :
                                                'text-slate-400'
                                    }`}>
                                    {getOrdinal(index + 1)} Place
                                </span>

                                {prizeType === 'cash' && (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                            placeholder="0"
                                            className="w-32 pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                )}

                                {(prizeType === 'merchandise' || prizeType === 'custom') && (
                                    <input
                                        type="text"
                                        value={prizeDescriptions[index] || ''}
                                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                        placeholder={prizeType === 'merchandise' ? 'e.g., T-Shirt, Hat, Mug' : 'Describe the prize...'}
                                        className="flex-1 min-w-64 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {prizeType === 'cash' && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center gap-4">
                                <span className="w-20 text-sm font-bold text-white">Total</span>
                                <span className="text-2xl font-bold text-green-400">${calculateTotal()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Announcement Text (shown on game page)
                    </label>
                    <textarea
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="e.g., This week's grand prize: $100 for the top player!"
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                {message && (
                    <div className={`mb-6 px-4 py-3 rounded-lg ${message.includes('Error')
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-green-500/10 border border-green-500/30 text-green-400'
                        }`}>
                        {message}
                    </div>
                )}

                <button
                    onClick={savePrize}
                    disabled={saving}
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving...' : currentPrize ? 'Update Prize Settings' : 'Save Prize Settings'}
                </button>
            </div>

            {/* Card Back Image Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">🃏 Card Back Image</h2>
                <p className="text-slate-400 mb-4">
                    Upload a logo or image to display on the back of game cards. This could be your logo or a sponsor's logo.
                </p>

                <div className="flex items-start gap-6">
                    <div className="flex-1">
                        <label className="block mb-3">
                            <span className="text-sm font-medium text-slate-300 mb-2 block">Upload Image</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-900 file:font-medium hover:file:bg-amber-400 file:cursor-pointer cursor-pointer"
                            />
                        </label>
                        {uploading && <p className="text-amber-400 text-sm mt-2">Uploading...</p>}

                        <div className="mt-4">
                            <span className="text-sm font-medium text-slate-300 mb-2 block">Or paste image URL</span>
                            <input
                                type="text"
                                value={cardBackImageUrl}
                                onChange={(e) => setCardBackImageUrl(e.target.value)}
                                placeholder="https://example.com/image.png"
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        {cardBackImageUrl && (
                            <button
                                onClick={() => setCardBackImageUrl('')}
                                className="mt-3 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all"
                            >
                                Remove Image
                            </button>
                        )}
                    </div>

                    <div className="w-40">
                        <p className="text-sm font-medium text-slate-300 mb-2">Preview</p>
                        <div className="w-32 h-40 rounded-lg shadow-lg overflow-hidden border-2 border-slate-600">
                            {cardBackImageUrl ? (
                                <img
                                    src={cardBackImageUrl}
                                    alt="Card back preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
                                    <span className="text-4xl text-white">?</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Preview (What Players Will See)</h2>
                <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded-xl p-6">
                    <div className="text-center">
                        <p className="text-white font-bold mb-2">🏆 This Week's Prize 🏆</p>

                        {isSurprise ? (
                            <>
                                <p className="text-3xl font-bold text-white mb-2">🎁 Surprise Prize! 🎁</p>
                                <p className="text-white/90">Play to find out what you could win!</p>
                            </>
                        ) : (
                            <>
                                {prizeType === 'cash' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">${calculateTotal()}</p>
                                        {numberOfWinners === 1 ? (
                                            <p className="text-white/90">Winner takes all!</p>
                                        ) : (
                                            <p className="text-white/90">Split among top {numberOfWinners} players</p>
                                        )}
                                    </>
                                )}

                                {prizeType === 'merchandise' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">🎽 Merchandise</p>
                                        <div className="text-white/90">
                                            {prizeDescriptions.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {prizeType === 'custom' && (
                                    <>
                                        <p className="text-3xl font-bold text-white mb-2">🎁 Special Prize</p>
                                        <div className="text-white/90">
                                            {prizeDescriptions.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)} Place: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {announcementText && (
                            <p className="text-white mt-4 italic">"{announcementText}"</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
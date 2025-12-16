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
                <h1 className="text-lg font-bold text-white">Prize Settings</h1>
                <p className="text-slate-400 text-xs">Configure prizes for the current week</p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-white">Current Week</h2>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                        {formatWeekRange()}
                    </span>
                </div>
                <p className="text-slate-400 text-xs">
                    Week ends Sunday at midnight CST. Winners will be finalized after that time.
                </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-3">
                <h2 className="text-sm font-bold text-white mb-3">Prize Configuration</h2>

                <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-300 mb-2">Prize Type</label>
                    <div className="flex gap-1 flex-wrap">
                        <button
                            onClick={() => setPrizeType('cash')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'cash'
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            💵 Cash
                        </button>
                        <button
                            onClick={() => setPrizeType('merchandise')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'merchandise'
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            🎽 Merch
                        </button>
                        <button
                            onClick={() => setPrizeType('custom')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'custom'
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            ✏️ Custom
                        </button>
                    </div>
                </div>

                <div className="mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isSurprise}
                            onChange={(e) => setIsSurprise(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-slate-300 text-xs">🎁 Keep prize a surprise</span>
                    </label>
                </div>

                <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-300 mb-2">Number of Winners</label>
                    <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberOfWinnersChange(num)}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${numberOfWinners === num
                                    ? 'bg-green-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {num === 1 ? '1st' : `Top ${num}`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                        {prizeType === 'cash' ? 'Prize Amounts' : 'Prize Details'}
                    </label>
                    <div className="space-y-1.5">
                        {prizeAmounts.map((amount, index) => (
                            <div key={index} className="flex items-center gap-2 flex-wrap">
                                <span className={`w-14 text-xs font-medium ${index === 0 ? 'text-amber-400' :
                                    index === 1 ? 'text-slate-300' :
                                        index === 2 ? 'text-amber-600' :
                                            'text-slate-400'
                                    }`}>
                                    {getOrdinal(index + 1)}
                                </span>

                                {prizeType === 'cash' && (
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                            placeholder="0"
                                            className="w-24 pl-5 pr-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                    </div>
                                )}

                                {(prizeType === 'merchandise' || prizeType === 'custom') && (
                                    <input
                                        type="text"
                                        value={prizeDescriptions[index] || ''}
                                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                        placeholder={prizeType === 'merchandise' ? 'e.g., T-Shirt, Hat' : 'Describe prize...'}
                                        className="flex-1 min-w-48 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {prizeType === 'cash' && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="w-14 text-xs font-bold text-white">Total</span>
                                <span className="text-lg font-bold text-green-400">${calculateTotal()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                        Announcement Text
                    </label>
                    <textarea
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="e.g., This week's grand prize: $100 for the top player!"
                        rows={2}
                        className="w-full px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                </div>

                {message && (
                    <div className={`mb-3 px-3 py-2 rounded text-xs ${message.includes('Error')
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border border-green-500/30 text-green-400'
                        }`}>
                        {message}
                    </div>
                )}

                <button
                    onClick={savePrize}
                    disabled={saving}
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold rounded hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving...' : currentPrize ? 'Update Prize' : 'Save Prize'}
                </button>
            </div>

            {/* Card Back Image Section */}
            <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-3">
                <h2 className="text-sm font-bold text-white mb-2">🃏 Card Back Image</h2>
                <p className="text-slate-400 text-xs mb-3">
                    Upload a logo or image to display on the back of game cards.
                </p>

                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <label className="block mb-2">
                            <span className="text-xs font-medium text-slate-300 mb-1 block">Upload Image</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-amber-500 file:text-slate-900 file:text-xs file:font-medium hover:file:bg-amber-400 file:cursor-pointer cursor-pointer"
                            />
                        </label>
                        {uploading && <p className="text-amber-400 text-xs mt-1">Uploading...</p>}

                        <div className="mt-2">
                            <span className="text-xs font-medium text-slate-300 mb-1 block">Or paste image URL</span>
                            <input
                                type="text"
                                value={cardBackImageUrl}
                                onChange={(e) => setCardBackImageUrl(e.target.value)}
                                placeholder="https://example.com/image.png"
                                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                        </div>

                        {cardBackImageUrl && (
                            <button
                                onClick={() => setCardBackImageUrl('')}
                                className="mt-2 px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-all"
                            >
                                Remove Image
                            </button>
                        )}
                    </div>

                    <div className="w-24">
                        <p className="text-xs font-medium text-slate-300 mb-1">Preview</p>
                        <div className="w-20 h-28 rounded shadow-lg overflow-hidden border border-slate-600">
                            {cardBackImageUrl ? (
                                <img
                                    src={cardBackImageUrl}
                                    alt="Card back preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
                                    <span className="text-2xl text-white">?</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded p-3">
                <h2 className="text-sm font-bold text-white mb-2">Preview (What Players See)</h2>
                <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded p-3">
                    <div className="text-center">
                        <p className="text-white text-xs font-bold mb-1">🏆 This Week's Prize 🏆</p>

                        {isSurprise ? (
                            <>
                                <p className="text-xl font-bold text-white mb-1">🎁 Surprise! 🎁</p>
                                <p className="text-white/90 text-xs">Play to find out what you could win!</p>
                            </>
                        ) : (
                            <>
                                {prizeType === 'cash' && (
                                    <>
                                        <p className="text-xl font-bold text-white mb-1">${calculateTotal()}</p>
                                        {numberOfWinners === 1 ? (
                                            <p className="text-white/90 text-xs">Winner takes all!</p>
                                        ) : (
                                            <p className="text-white/90 text-xs">Split among top {numberOfWinners}</p>
                                        )}
                                    </>
                                )}

                                {prizeType === 'merchandise' && (
                                    <>
                                        <p className="text-xl font-bold text-white mb-1">🎽 Merchandise</p>
                                        <div className="text-white/90 text-xs">
                                            {prizeDescriptions.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)}: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {prizeType === 'custom' && (
                                    <>
                                        <p className="text-xl font-bold text-white mb-1">🎁 Special Prize</p>
                                        <div className="text-white/90 text-xs">
                                            {prizeDescriptions.filter(d => d).map((desc, i) => (
                                                <p key={i}>{getOrdinal(i + 1)}: {desc}</p>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {announcementText && (
                            <p className="text-white mt-2 text-xs italic">"{announcementText}"</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
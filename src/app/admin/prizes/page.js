'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminPrizesPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [currentPrize, setCurrentPrize] = useState(null)
    const [selectedGame, setSelectedGame] = useState('slots')
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
    }, [selectedGame])

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
        setLoading(true)
        try {
            const weekStart = getWeekStart()

            const { data, error } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart)
                .eq('game_type', selectedGame)
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
            } else {
                // Reset form for new prize
                setCurrentPrize(null)
                setPrizeType('cash')
                setNumberOfWinners(1)
                setPrizeAmounts([''])
                setPrizeDescriptions([''])
                setIsSurprise(false)
                setAnnouncementText('')
                setCardBackImageUrl('')
            }
        } catch (error) {
            // No prize set for this week/game yet - reset form
            setCurrentPrize(null)
            setPrizeType('cash')
            setNumberOfWinners(1)
            setPrizeAmounts([''])
            setPrizeDescriptions([''])
            setIsSurprise(false)
            setAnnouncementText('')
            setCardBackImageUrl('')
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
                game_type: selectedGame,
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

    const getGameLabel = (key) => {
        const games = {
            slots: '🎰 Slots',
            match: '🎮 Match Game',
            gallery: '🖼️ Card Gallery'
        }
        return games[key] || key
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Prize Settings</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Configure prizes for each game</p>
            </div>

            {/* Game Selector */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Select Game</label>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { key: 'slots', label: '🎰 Slots', color: 'purple' },
                        { key: 'match', label: '🎮 Match Game', color: 'green' },
                        { key: 'gallery', label: '🖼️ Card Gallery', color: 'blue' }
                    ].map(game => (
                        <button
                            key={game.key}
                            onClick={() => setSelectedGame(game.key)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${selectedGame === game.key
                                ? `bg-${game.color}-500 text-white`
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                }`}
                        >
                            {game.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className={`text-sm font-bold text-${currentTheme.text}`}>Current Week - {getGameLabel(selectedGame)}</h2>
                    <span className={`px-2 py-0.5 bg-${currentTheme.accent}/20 text-${currentTheme.accent} rounded-full text-xs font-medium`}>
                        {formatWeekRange()}
                    </span>
                </div>
                <p className={`text-${currentTheme.textMuted} text-xs`}>
                    Week ends Sunday at midnight CST. Winners will be finalized after that time.
                </p>
                {!currentPrize && (
                    <p className="text-yellow-400 text-xs mt-2 font-medium">
                        ⚠️ No prize set for {getGameLabel(selectedGame)} this week
                    </p>
                )}
            </div>

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <h2 className={`text-sm font-bold text-${currentTheme.text} mb-3`}>Prize Configuration</h2>

                <div className="mb-3">
                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Prize Type</label>
                    <div className="flex gap-1 flex-wrap">
                        <button
                            onClick={() => setPrizeType('cash')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'cash'
                                ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                }`}
                        >
                            💵 Cash
                        </button>
                        <button
                            onClick={() => setPrizeType('merchandise')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'merchandise'
                                ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                }`}
                        >
                            🎽 Merch
                        </button>
                        <button
                            onClick={() => setPrizeType('custom')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${prizeType === 'custom'
                                ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
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
                            className={`w-4 h-4 rounded border-${currentTheme.border} bg-${currentTheme.border} text-${currentTheme.accent} focus:ring-${currentTheme.accent}`}
                        />
                        <span className={`text-${currentTheme.textMuted} text-xs`}>🎁 Keep prize a surprise</span>
                    </label>
                </div>

                <div className="mb-3">
                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Number of Winners</label>
                    <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberOfWinnersChange(num)}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${numberOfWinners === num
                                    ? 'bg-green-500 text-white'
                                    : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                    }`}
                            >
                                {num === 1 ? '1st' : `Top ${num}`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-3">
                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-2`}>
                        {prizeType === 'cash' ? 'Prize Amounts' : 'Prize Details'}
                    </label>
                    <div className="space-y-1.5">
                        {prizeAmounts.map((amount, index) => (
                            <div key={index} className="flex items-center gap-2 flex-wrap">
                                <span className={`w-14 text-xs font-medium ${index === 0 ? `text-${currentTheme.accent}` :
                                    index === 1 ? `text-${currentTheme.textMuted}` :
                                        index === 2 ? 'text-amber-600' :
                                            `text-${currentTheme.textMuted}`
                                    }`}>
                                    {getOrdinal(index + 1)}
                                </span>

                                {prizeType === 'cash' && (
                                    <div className="relative">
                                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-${currentTheme.textMuted} text-xs`}>$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                            placeholder="0"
                                            className={`w-24 pl-5 pr-2 py-1 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        />
                                    </div>
                                )}

                                {(prizeType === 'merchandise' || prizeType === 'custom') && (
                                    <input
                                        type="text"
                                        value={prizeDescriptions[index] || ''}
                                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                        placeholder={prizeType === 'merchandise' ? 'e.g., T-Shirt, Hat' : 'Describe prize...'}
                                        className={`flex-1 min-w-48 px-2 py-1 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {prizeType === 'cash' && (
                        <div className={`mt-2 pt-2 border-t border-${currentTheme.border}`}>
                            <div className="flex items-center gap-2">
                                <span className={`w-14 text-xs font-bold text-${currentTheme.text}`}>Total</span>
                                <span className="text-lg font-bold text-green-400">${calculateTotal()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-3">
                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>
                        Announcement Text
                    </label>
                    <textarea
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="e.g., This week's grand prize: $100 for the top player!"
                        rows={2}
                        className={`w-full px-2 py-1.5 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
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
                    className={`px-4 py-1.5 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-sm font-bold rounded hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                >
                    {saving ? 'Saving...' : currentPrize ? 'Update Prize' : 'Save Prize'}
                </button>
            </div>

            {/* Card Back Image Section */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>🃏 Card Back Image</h2>
                <p className={`text-${currentTheme.textMuted} text-xs mb-3`}>
                    Upload a logo or image to display on the back of game cards.
                </p>

                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <label className="block mb-2">
                            <span className={`text-xs font-medium text-${currentTheme.textMuted} mb-1 block`}>Upload Image</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className={`block w-full text-xs text-${currentTheme.textMuted} file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-${currentTheme.accent} file:text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} file:text-xs file:font-medium hover:file:bg-${currentTheme.accentHover} file:cursor-pointer cursor-pointer`}
                            />
                        </label>
                        {uploading && <p className={`text-${currentTheme.accent} text-xs mt-1`}>Uploading...</p>}

                        <div className="mt-2">
                            <span className={`text-xs font-medium text-${currentTheme.textMuted} mb-1 block`}>Or paste image URL</span>
                            <input
                                type="text"
                                value={cardBackImageUrl}
                                onChange={(e) => setCardBackImageUrl(e.target.value)}
                                placeholder="https://example.com/image.png"
                                className={`w-full px-2 py-1 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
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
                        <p className={`text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Preview</p>
                        <div className={`w-20 h-28 rounded shadow-lg overflow-hidden border border-${currentTheme.border}`}>
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

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>Preview (What Players See)</h2>
                <div className="bg-gradient-to-r from-red-800 to-red-900 border border-red-700 rounded p-3">
                    <div className="text-center">
                        <p className="text-white text-xs font-bold mb-1">🏆 This Week's Prize - {getGameLabel(selectedGame)} 🏆</p>

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
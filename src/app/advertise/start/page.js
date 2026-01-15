'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function AdvertisePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200'
    })
    const [message, setMessage] = useState('')

    const [businessCards, setBusinessCards] = useState([])
    const [selectedCardId, setSelectedCardId] = useState(null)

    const [step, setStep] = useState(1)
    const [previewCard, setPreviewCard] = useState(null)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [termsContent, setTermsContent] = useState(null)
    const [termsDocId, setTermsDocId] = useState(null)
    const [termsVersion, setTermsVersion] = useState(null)

    useEffect(() => {
        checkUser()
    }, [])

    const selectedCard = businessCards.find(c => c.id === selectedCardId)

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

            // Fetch advertiser terms
            const { data: termsData } = await supabase
                .from('legal_documents')
                .select('id, content, version')
                .eq('document_key', 'advertiser_terms')
                .eq('is_active', true)
                .single()

            if (termsData) {
                setTermsContent(termsData.content)
                setTermsDocId(termsData.id)
                setTermsVersion(termsData.version)
            }

            const { data: cardData } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })

            setBusinessCards(cardData || [])

            if (cardData && cardData.length > 0) {
                setSelectedCardId(cardData[0].id)
            }

            const { data: settingsData } = await supabase
                .from('admin_settings')
                .select('*')

            if (settingsData) {
                const settingsObj = {}
                settingsData.forEach(item => {
                    settingsObj[item.setting_key] = item.setting_value
                })
                setSettings(prev => ({ ...prev, ...settingsObj }))
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePurchase = async () => {
        setProcessing(true)
        setMessage('')

        try {
            // Log terms acceptance
            if (termsDocId && termsVersion) {
                try {
                    await supabase
                        .from('terms_acceptances')
                        .insert([{
                            user_id: user.id,
                            document_id: termsDocId,
                            document_key: 'advertiser_terms',
                            version_accepted: termsVersion,
                            ip_address: null
                        }])
                } catch (termsError) {
                    console.error('Terms acceptance log error:', termsError)
                }
            }

            // Stripe Payment - redirect to checkout
            const response = await fetch('/api/stripe/advertiser-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    cardId: selectedCardId,
                    amount: settings.ad_price,
                    guaranteedViews: settings.guaranteed_views
                })
            })

            const data = await response.json()

            if (data.error) {
                throw new Error(data.error)
            }

            // Redirect to Stripe checkout
            window.location.href = data.url

        } catch (error) {
            setMessage('Error: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    // Calculate dynamic font size based on text length
    const getDynamicFontSize = (text, maxSize, minSize, maxLength) => {
        if (!text) return maxSize
        const length = text.length
        if (length <= maxLength * 0.5) return maxSize
        if (length >= maxLength) return minSize
        const ratio = (length - maxLength * 0.5) / (maxLength * 0.5)
        return maxSize - (ratio * (maxSize - minSize))
    }

    // Render card preview (works for both image and text-based cards)
    const renderCardPreview = (card, size = 'large') => {
        if (card.image_url) {
            return (
                <img
                    src={card.image_url}
                    alt={card.business_name}
                    className={`${size === 'large' ? 'w-full h-full' : 'w-full h-full'} object-cover rounded-lg`}
                    style={{ transform: `rotate(${card.image_rotation || 0}deg)` }}
                />
            )
        }

        // Text-based card
        const displayName = card.display_name || card.business_name || card.title || 'Card'
        return (
            <div
                className={`${size === 'large' ? 'w-full h-full p-4' : 'w-full h-full p-1'} rounded-lg flex flex-col justify-center items-center`}
                style={{
                    backgroundColor: card.card_color || '#1e293b',
                    color: card.text_color || '#ffffff'
                }}
            >
                {size === 'large' ? (
                    <>
                        {card.full_business_name || card.business_name ? (
                            <h4 className="font-bold text-lg mb-1 text-center">{card.full_business_name || card.business_name}</h4>
                        ) : null}
                        {card.tagline || card.message ? (
                            <p className="text-sm opacity-80 mb-2 text-center">{card.tagline || card.message}</p>
                        ) : null}
                        <div className="mt-3 text-xs opacity-70 space-y-1 text-center">
                            {card.phone && <p>📞 {card.phone}</p>}
                            {card.email && <p>✉️ {card.email}</p>}
                            {card.website_url && <p>🌐 {card.website_url}</p>}
                        </div>
                    </>
                ) : (
                    <>
                        <span
                            className="font-bold text-center leading-tight"
                            style={{ fontSize: `${getDynamicFontSize(displayName, 11, 7, 20)}px` }}
                        >
                            {displayName}
                        </span>
                        {card.short_tagline && (
                            <span
                                className="text-center leading-tight mt-0.5 opacity-85"
                                style={{ fontSize: `${getDynamicFontSize(card.short_tagline, 8, 6, 20)}px` }}
                            >
                                {card.short_tagline}
                            </span>
                        )}
                    </>
                )}
            </div>
        )
    }

    // Step indicator component - 2 steps: Card, Review & Pay
    const StepIndicator = () => {
        const steps = [
            { num: 1, label: 'Select Card' },
            { num: 2, label: 'Review & Pay' }
        ]

        return (
            <div className="flex items-center justify-center gap-1 mb-6">
                {steps.map((s, idx) => (
                    <div key={s.num} className="flex items-center">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${step === s.num
                            ? `bg-${currentTheme.accent} text-white`
                            : step > s.num
                                ? 'bg-green-500 text-white'
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                            }`}>
                            {step > s.num ? '✓' : s.num}
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 ${step > s.num ? 'bg-green-500' : `bg-${currentTheme.border}`}`} />
                        )}
                    </div>
                ))}
            </div>
        )
    }

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className={`w-10 h-10 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
            </div>
        )
    }

    // No cards - prompt to create one
    if (businessCards.length === 0) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto text-center">
                    <span className="text-5xl mb-4 block">🃏</span>
                    <h2 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>Create Your Business Card First</h2>
                    <p className={`text-${currentTheme.textMuted} mb-6`}>
                        Before you can start advertising, you need to create your business card.
                    </p>
                    <button
                        onClick={() => router.push('/cards?returnTo=campaign')}
                        className={`px-6 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg`}
                    >
                        Create Business Card
                    </button>
                </div>
            </div>
        )
    }

    // ==================== STEP 1: SELECT CARD ====================
    if (step === 1) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 1: Select Your Card</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            Choose which business card to advertise. This card will be shown to users in our games.
                        </p>

                        {/* Selected Card Preview */}
                        <div className="mb-4">
                            <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Selected Card:</p>
                            <div
                                className={`aspect-[3/2] max-w-xs mx-auto rounded-lg overflow-hidden border-2 border-${currentTheme.accent} cursor-pointer hover:opacity-90 transition-opacity`}
                                onClick={() => selectedCard && setPreviewCard(selectedCard)}
                            >
                                {selectedCard ? renderCardPreview(selectedCard, 'large') : (
                                    <div className={`w-full h-full bg-${currentTheme.border} flex items-center justify-center`}>
                                        <span className="text-4xl">🃏</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Card Selector (if multiple) */}
                        {businessCards.length > 1 && (
                            <div className="mb-4">
                                <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Your Cards:</p>
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {businessCards.map((card) => (
                                        <button
                                            key={card.id}
                                            onClick={() => setSelectedCardId(card.id)}
                                            className={`w-16 h-12 rounded-lg border-2 overflow-hidden transition-all ${selectedCardId === card.id
                                                ? `border-${currentTheme.accent} ring-2 ring-${currentTheme.accent}/50`
                                                : `border-${currentTheme.border} opacity-60 hover:opacity-100`
                                                }`}
                                        >
                                            {renderCardPreview(card, 'small')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info text */}
                        <div className={`bg-${currentTheme.bg} rounded-lg p-3 mb-4`}>
                            <p className={`text-xs text-${currentTheme.textMuted} text-center`}>                                * You can have up to <strong>5 card designs</strong>. You can also delete non active cards if you wish to create new ones.
                            </p>
                        </div>

                        {/* Edit selected card option */}
                        {selectedCard && (
                            <button
                                onClick={() => router.push(`/cards?returnTo=campaign&editCard=${selectedCard.id}`)}
                                className={`w-full py-2 mb-2 border border-${currentTheme.accent} rounded-lg text-${currentTheme.accent} text-sm hover:bg-${currentTheme.accent}/10 transition-all`}
                            >
                                ✏️ Edit Selected Card
                            </button>
                        )}

                        {/* Create new card option */}
                        <button
                            onClick={() => router.push('/cards?returnTo=campaign')}
                            className={`w-full py-2 mb-4 border border-dashed border-${currentTheme.border} rounded-lg text-${currentTheme.textMuted} text-sm hover:border-${currentTheme.accent} hover:text-${currentTheme.text} transition-all`}
                        >
                            + CREATE A NEW CARD
                        </button>

                        {/* Continue button */}
                        <button
                            onClick={() => setStep(2)}
                            disabled={!selectedCardId}
                            className={`w-full py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                        >
                            Continue with this card →
                        </button>
                    </div>
                </div>

                {/* Card Preview Modal */}
                {
                    previewCard && (
                        <div
                            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                            onClick={() => setPreviewCard(null)}
                        >
                            <div
                                className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-sm w-full`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className={`font-bold text-${currentTheme.text}`}>Full Card Preview</h3>
                                    <button
                                        onClick={() => setPreviewCard(null)}
                                        className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-xl`}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="aspect-[3/2] rounded-lg overflow-hidden">
                                    {renderCardPreview(previewCard, 'large')}
                                </div>
                                <button
                                    onClick={() => { setSelectedCardId(previewCard.id); setPreviewCard(null); }}
                                    className={`w-full mt-4 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg text-sm`}
                                >
                                    Use This Card
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >
        )
    }

    // ==================== STEP 2: REVIEW & PAY ====================
    if (step === 2) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 2: Review & Pay</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            Confirm your campaign details and pay to go live.
                        </p>

                        {/* Card Preview */}
                        <div className="mb-4">
                            <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Your Card (as shown in games):</p>
                            <div
                                className={`w-24 h-16 mx-auto rounded-lg overflow-hidden border border-${currentTheme.border} cursor-pointer hover:opacity-80`}
                                onClick={() => selectedCard && setPreviewCard(selectedCard)}
                            >
                                {selectedCard && renderCardPreview(selectedCard, 'small')}
                            </div>
                            <p className={`text-center text-${currentTheme.accent} text-xs mt-1 cursor-pointer hover:underline`} onClick={() => router.push('/cards')}>
                                ✏️ Edit this card
                            </p>
                        </div>

                        {/* Summary */}
                        <div className={`bg-${currentTheme.bg} rounded-lg p-4 mb-4 space-y-3`}>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Package</span>
                                <span className={`text-${currentTheme.text} font-medium`}>Standard Campaign</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Guaranteed Views</span>
                                <span className={`text-${currentTheme.text} font-medium`}>{parseInt(settings.guaranteed_views).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Payment</span>
                                <span className={`text-${currentTheme.text} font-medium`}>
                                    💳 Credit or Debit Card
                                </span>
                            </div>
                            <div className={`border-t border-${currentTheme.border} pt-3 flex justify-between`}>
                                <span className={`text-${currentTheme.text} font-bold`}>Total</span>
                                <span className={`text-${currentTheme.accent} font-bold text-xl`}>${settings.ad_price}</span>
                            </div>
                        </div>

                        {/* Terms of Service */}
                        {termsContent && (
                            <div className="mb-4">
                                <p className={`text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Terms of Service</p>
                                <div
                                    className={`bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg p-3 max-h-32 overflow-y-auto text-xs text-${currentTheme.textMuted} [&>p]:mb-3 [&>h1]:text-base [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-bold [&>h2]:mb-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4`}
                                    dangerouslySetInnerHTML={{ __html: termsContent }}
                                />
                                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreedToTerms}
                                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                                        className={`w-4 h-4 mt-0.5 rounded border-${currentTheme.border} bg-${currentTheme.border} text-${currentTheme.accent} focus:ring-${currentTheme.accent}`}
                                    />
                                    <span className={`text-xs text-${currentTheme.text}`}>
                                        I have read and agree to the Terms of Service
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Error message */}
                        {message && (
                            <div className={`mb-4 px-4 py-2 rounded-lg text-center text-sm ${message.includes('Error')
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : 'bg-green-500/10 border border-green-500/30 text-green-400'
                                }`}>
                                {message}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg`}
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handlePurchase}
                                disabled={processing || (termsContent && !agreedToTerms)}
                                className={`flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                            >
                                {processing ? 'Processing...' : `Pay $${settings.ad_price}`}
                            </button>
                        </div>

                        {termsContent && !agreedToTerms && (
                            <p className={`text-${currentTheme.accent} text-xs text-center mt-2`}>
                                Please agree to the Terms of Service to continue
                            </p>
                        )}
                    </div>
                </div>

                {/* Card Preview Modal */}
                {previewCard && (
                    <div
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => setPreviewCard(null)}
                    >
                        <div
                            className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-sm w-full`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className={`font-bold text-${currentTheme.text}`}>Full Card Preview</h3>
                                <button
                                    onClick={() => setPreviewCard(null)}
                                    className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-xl`}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="aspect-[3/2] rounded-lg overflow-hidden">
                                {renderCardPreview(previewCard, 'large')}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Fallback (shouldn't reach here)
    return null
}
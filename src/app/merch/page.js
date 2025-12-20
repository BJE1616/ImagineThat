'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function MerchStorePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()

    // ===== STATE =====
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState([])
    const [tokenBalance, setTokenBalance] = useState(0)
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedItem, setSelectedItem] = useState(null)
    const [showPurchaseModal, setShowPurchaseModal] = useState(false)
    const [purchaseMethod, setPurchaseMethod] = useState('tokens')
    const [processing, setProcessing] = useState(false)
    const [message, setMessage] = useState(null)
    const [settings, setSettings] = useState({
        merch_store_enabled: true,
        merch_global_markup: 3.0,
        bb_dollar_value: 1.0
    })

    // Shipping address for physical items
    const [shippingAddress, setShippingAddress] = useState({
        line1: '',
        line2: '',
        city: '',
        state: '',
        zip: '',
        country: 'US'
    })

    useEffect(() => {
        loadData()
    }, [])

    // ===== LOAD DATA =====
    const loadData = async () => {
        setLoading(true)
        await Promise.all([
            checkUser(),
            loadItems(),
            loadSettings()
        ])
        setLoading(false)
    }

    // ===== CHECK USER =====
    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/auth/login')
                return
            }
            setUser(authUser)

            // Load token balance
            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('balance')
                .eq('user_id', authUser.id)
                .single()
            setTokenBalance(balanceData?.balance || 0)

            // Load saved shipping address if exists
            const { data: userData } = await supabase
                .from('users')
                .select('address_line1, address_line2, city, state, zip, country')
                .eq('id', authUser.id)
                .single()

            if (userData) {
                setShippingAddress({
                    line1: userData.address_line1 || '',
                    line2: userData.address_line2 || '',
                    city: userData.city || '',
                    state: userData.state || '',
                    zip: userData.zip || '',
                    country: userData.country || 'US'
                })
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    // ===== LOAD ITEMS =====
    const loadItems = async () => {
        try {
            const { data } = await supabase
                .from('merch_items')
                .select('*')
                .eq('is_enabled', true)
                .order('is_featured', { ascending: false })
                .order('display_order')
                .order('name')

            setItems(data || [])
        } catch (error) {
            console.error('Error loading items:', error)
        }
    }

    // ===== LOAD SETTINGS =====
    const loadSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['merch_store_enabled', 'merch_global_markup', 'bb_dollar_value'])

            if (data) {
                const settingsObj = {}
                data.forEach(s => {
                    if (s.setting_key === 'merch_store_enabled') {
                        settingsObj[s.setting_key] = s.setting_value === 'true'
                    } else {
                        settingsObj[s.setting_key] = parseFloat(s.setting_value) || 0
                    }
                })
                setSettings(prev => ({ ...prev, ...settingsObj }))
            }
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    // ===== CALCULATE PRICES =====
    const getTokenPrice = (item) => {
        return item.bb_price || Math.ceil(item.cost * (item.markup_multiplier || settings.merch_global_markup))
    }

    const getCashPrice = (item) => {
        if (item.display_price) return item.display_price
        return (item.cost * (item.markup_multiplier || settings.merch_global_markup)).toFixed(2)
    }

    // ===== GET CATEGORIES =====
    const categories = [
        { key: 'all', label: 'All Items', icon: '🛍️' },
        { key: 'digital_gift_card', label: 'Gift Cards', icon: '🎁' },
        { key: 'amazon_dropship', label: 'Ships from Amazon', icon: '📦' },
        { key: 'in_stock', label: 'In Stock', icon: '🏪' }
    ]

    const filteredItems = selectedCategory === 'all'
        ? items
        : items.filter(item => item.item_type === selectedCategory)

    // ===== OPEN PURCHASE MODAL =====
    const openPurchaseModal = (item) => {
        setSelectedItem(item)
        setPurchaseMethod('tokens')
        setShowPurchaseModal(true)
    }

    // ===== CLOSE MODAL =====
    const closeModal = () => {
        setSelectedItem(null)
        setShowPurchaseModal(false)
        setMessage(null)
    }

    // ===== PURCHASE WITH TOKENS =====
    const purchaseWithTokens = async () => {
        if (!selectedItem || !user) return

        const tokenPrice = getTokenPrice(selectedItem)

        if (tokenBalance < tokenPrice) {
            setMessage({ type: 'error', text: 'Not enough tokens!' })
            return
        }

        // Check if physical item needs address
        if (selectedItem.item_type !== 'digital_gift_card') {
            if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
                setMessage({ type: 'error', text: 'Please fill in your shipping address' })
                return
            }
        }

        setProcessing(true)

        try {
            // Deduct tokens
            const { error: balanceError } = await supabase
                .from('bb_balances')
                .update({
                    balance: tokenBalance - tokenPrice,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)

            if (balanceError) throw balanceError

            // Create order
            const orderData = {
                user_id: user.id,
                item_id: selectedItem.id,
                item_name: selectedItem.name,
                item_type: selectedItem.item_type,
                bb_cost: tokenPrice,
                actual_cost: selectedItem.cost,
                status: 'pending',
                ordered_at: new Date().toISOString()
            }

            // Add shipping address for physical items
            if (selectedItem.item_type !== 'digital_gift_card') {
                orderData.shipping_address_line1 = shippingAddress.line1
                orderData.shipping_address_line2 = shippingAddress.line2
                orderData.shipping_city = shippingAddress.city
                orderData.shipping_state = shippingAddress.state
                orderData.shipping_zip = shippingAddress.zip
                orderData.shipping_country = shippingAddress.country
            }

            const { error: orderError } = await supabase
                .from('merch_orders')
                .insert([orderData])

            if (orderError) throw orderError

            // Log transaction
            await supabase
                .from('bb_transactions')
                .insert([{
                    user_id: user.id,
                    type: 'spend',
                    amount: tokenPrice,
                    source: 'merch_store',
                    description: `Purchased: ${selectedItem.name}`
                }])

            // Update local balance
            setTokenBalance(prev => prev - tokenPrice)

            // Update stock if in_stock item
            if (selectedItem.item_type === 'in_stock' && selectedItem.stock_quantity !== null) {
                await supabase
                    .from('merch_items')
                    .update({
                        stock_quantity: selectedItem.stock_quantity - 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedItem.id)
            }

            setMessage({ type: 'success', text: '🎉 Purchase successful! Check your email for details.' })

            // Reload items to update stock
            loadItems()

            // Close modal after delay
            setTimeout(() => {
                closeModal()
            }, 2000)

        } catch (error) {
            console.error('Purchase error:', error)
            setMessage({ type: 'error', text: 'Purchase failed. Please try again.' })
        }

        setProcessing(false)
    }

    // ===== PURCHASE WITH CARD (STRIPE - PLACEHOLDER) =====
    const purchaseWithCard = async () => {
        // TODO: Integrate Stripe
        setMessage({ type: 'error', text: 'Card payments coming soon! Use tokens for now.' })
    }

    // ===== ITEM TYPE BADGE =====
    const getItemTypeBadge = (type) => {
        switch (type) {
            case 'digital_gift_card':
                return { label: 'Digital', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
            case 'amazon_dropship':
                return { label: 'Ships from Amazon', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
            case 'in_stock':
                return { label: 'In Stock', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
            default:
                return { label: type, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
        }
    }

    // ===== LOADING =====
    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // ===== STORE DISABLED =====
    if (!settings.merch_store_enabled) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} flex items-center justify-center p-4`}>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-8 text-center max-w-md`}>
                    <div className="text-4xl mb-4">🛍️</div>
                    <h1 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>Store Coming Soon!</h1>
                    <p className={`text-${currentTheme.textMuted}`}>The merch store is currently being set up. Check back soon!</p>
                    <Link href="/game" className={`inline-block mt-4 px-4 py-2 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} rounded font-medium`}>
                        Back to Games
                    </Link>
                </div>
            </div>
        )
    }

    // ===== MAIN RENDER =====
    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-4 px-4`}>
            <div className="max-w-4xl mx-auto">

                {/* ===== HEADER ===== */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className={`text-2xl font-bold text-${currentTheme.text}`}>🛍️ Merch Store</h1>
                        <p className={`text-${currentTheme.textMuted} text-sm`}>Spend your tokens on awesome rewards!</p>
                    </div>
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg px-4 py-2`}>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Your Balance</p>
                        <p className="text-yellow-400 font-bold text-lg">🪙 {tokenBalance}</p>
                    </div>
                </div>

                {/* ===== CATEGORY TABS ===== */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat.key
                                ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                : `bg-${currentTheme.card} text-${currentTheme.textMuted} hover:bg-${currentTheme.border}`
                                }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* ===== ITEMS GRID ===== */}
                {filteredItems.length === 0 ? (
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-8 text-center`}>
                        <div className="text-4xl mb-2">📦</div>
                        <p className={`text-${currentTheme.textMuted}`}>No items in this category yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map(item => {
                            const badge = getItemTypeBadge(item.item_type)
                            const tokenPrice = getTokenPrice(item)
                            const cashPrice = getCashPrice(item)
                            const canAfford = tokenBalance >= tokenPrice
                            const outOfStock = item.item_type === 'in_stock' && item.stock_quantity <= 0

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden transition-all hover:border-${currentTheme.accent}/50 ${item.is_featured ? 'ring-2 ring-yellow-500/30' : ''}`}
                                >
                                    {/* Image */}
                                    <div className="relative aspect-video bg-slate-700">
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.style.display = 'none' }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl">
                                                {item.item_type === 'digital_gift_card' ? '🎁' : item.item_type === 'amazon_dropship' ? '📦' : '🛍️'}
                                            </div>
                                        )}
                                        {item.is_featured && (
                                            <div className="absolute top-2 left-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded">
                                                ⭐ Featured
                                            </div>
                                        )}
                                        <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded border ${badge.color}`}>
                                            {badge.label}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-3">
                                        <h3 className={`font-bold text-${currentTheme.text} mb-1`}>{item.name}</h3>
                                        {item.description && (
                                            <p className={`text-${currentTheme.textMuted} text-xs mb-2 line-clamp-2`}>{item.description}</p>
                                        )}

                                        {/* Prices */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-yellow-400 font-bold">🪙 {tokenPrice}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>or ${cashPrice}</p>
                                            </div>
                                            {item.item_type === 'in_stock' && (
                                                <p className={`text-xs ${item.stock_quantity <= (item.low_stock_alert || 5) ? 'text-red-400' : `text-${currentTheme.textMuted}`}`}>
                                                    {item.stock_quantity} left
                                                </p>
                                            )}
                                        </div>

                                        {/* Buy Button */}
                                        <button
                                            onClick={() => openPurchaseModal(item)}
                                            disabled={outOfStock}
                                            className={`w-full py-2 rounded-lg font-medium text-sm transition-all ${outOfStock
                                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                : canAfford
                                                    ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} hover:opacity-90`
                                                    : `bg-${currentTheme.border} text-${currentTheme.text} hover:bg-${currentTheme.accent} hover:text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                                }`}
                                        >
                                            {outOfStock ? 'Out of Stock' : canAfford ? '🪙 Buy with Tokens' : `$${cashPrice} - Buy Now`}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ===== NEED TOKENS? ===== */}
                <div className={`mt-6 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 text-center`}>
                    <p className={`text-${currentTheme.text} font-medium mb-2`}>💡 Need more tokens?</p>
                    <div className="flex justify-center gap-3">
                        <Link href="/slots" className={`text-${currentTheme.accent} text-sm hover:underline`}>🎰 Play Slots</Link>
                        <Link href="/game" className={`text-${currentTheme.accent} text-sm hover:underline`}>🎮 Match Game</Link>
                        <Link href="/card-gallery" className={`text-${currentTheme.accent} text-sm hover:underline`}>🖼️ Card Gallery</Link>
                    </div>
                </div>
            </div>

            {/* ===== PURCHASE MODAL ===== */}
            {showPurchaseModal && selectedItem && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <h2 className={`text-lg font-bold text-${currentTheme.text}`}>Complete Purchase</h2>
                                <button onClick={closeModal} className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}>✕</button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4">
                            {/* Item Summary */}
                            <div className={`bg-${currentTheme.border}/30 rounded-lg p-3 mb-4`}>
                                <div className="flex gap-3">
                                    {selectedItem.image_url ? (
                                        <img src={selectedItem.image_url} alt={selectedItem.name} className="w-16 h-16 object-cover rounded" />
                                    ) : (
                                        <div className="w-16 h-16 bg-slate-700 rounded flex items-center justify-center text-2xl">🎁</div>
                                    )}
                                    <div>
                                        <h3 className={`font-bold text-${currentTheme.text}`}>{selectedItem.name}</h3>
                                        <p className="text-yellow-400 font-bold">🪙 {getTokenPrice(selectedItem)}</p>
                                        <p className={`text-${currentTheme.textMuted} text-sm`}>or ${getCashPrice(selectedItem)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Message */}
                            {message && (
                                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {message.text}
                                </div>
                            )}

                            {/* Payment Method Selection */}
                            <div className="mb-4">
                                <p className={`text-${currentTheme.textMuted} text-sm mb-2`}>Payment Method</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setPurchaseMethod('tokens')}
                                        className={`p-3 rounded-lg border-2 transition-all ${purchaseMethod === 'tokens'
                                            ? 'border-yellow-500 bg-yellow-500/10'
                                            : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        <p className="text-yellow-400 font-bold">🪙 {getTokenPrice(selectedItem)}</p>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Pay with Tokens</p>
                                        {tokenBalance < getTokenPrice(selectedItem) && (
                                            <p className="text-red-400 text-xs mt-1">Not enough tokens</p>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setPurchaseMethod('card')}
                                        className={`p-3 rounded-lg border-2 transition-all ${purchaseMethod === 'card'
                                            ? 'border-green-500 bg-green-500/10'
                                            : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        <p className="text-green-400 font-bold">${getCashPrice(selectedItem)}</p>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Pay with Card</p>
                                    </button>
                                </div>
                            </div>

                            {/* Shipping Address (for physical items) */}
                            {selectedItem.item_type !== 'digital_gift_card' && (
                                <div className="mb-4">
                                    <p className={`text-${currentTheme.textMuted} text-sm mb-2`}>Shipping Address</p>
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Street Address"
                                            value={shippingAddress.line1}
                                            onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                                            className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Apt, Suite, etc. (optional)"
                                            value={shippingAddress.line2}
                                            onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                                            className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="City"
                                                value={shippingAddress.city}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                            />
                                            <input
                                                type="text"
                                                placeholder="State"
                                                value={shippingAddress.state}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="ZIP Code"
                                                value={shippingAddress.zip}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Country"
                                                value={shippingAddress.country}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Purchase Button */}
                            <button
                                onClick={purchaseMethod === 'tokens' ? purchaseWithTokens : purchaseWithCard}
                                disabled={processing || (purchaseMethod === 'tokens' && tokenBalance < getTokenPrice(selectedItem))}
                                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${processing
                                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                    : purchaseMethod === 'tokens'
                                        ? tokenBalance >= getTokenPrice(selectedItem)
                                            ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400'
                                            : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                        : 'bg-green-500 text-white hover:bg-green-400'
                                    }`}
                            >
                                {processing
                                    ? '⏳ Processing...'
                                    : purchaseMethod === 'tokens'
                                        ? `🪙 Pay ${getTokenPrice(selectedItem)} Tokens`
                                        : `💳 Pay $${getCashPrice(selectedItem)}`
                                }
                            </button>

                            {/* Balance Info */}
                            {purchaseMethod === 'tokens' && (
                                <p className={`text-center text-${currentTheme.textMuted} text-xs mt-2`}>
                                    Your balance: 🪙 {tokenBalance} → 🪙 {tokenBalance - getTokenPrice(selectedItem)} after purchase
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
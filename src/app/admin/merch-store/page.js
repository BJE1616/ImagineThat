'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== MERCH STORE ADMIN PAGE =====
// Manage merchandise items and process orders

export default function MerchStoreAdminPage() {
    // ===== STATE =====
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState([])
    const [orders, setOrders] = useState([])
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('items')
    const [showItemForm, setShowItemForm] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [processingOrder, setProcessingOrder] = useState(null)
    const [settings, setSettings] = useState({
        merch_store_enabled: true,
        merch_global_markup: 3.0,
        token_dollar_value: 1.0
    })
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        item_type: 'digital_gift_card',
        cost: '',
        markup_multiplier: '',
        token_price: '',
        amazon_url: '',
        image_url: '',
        stock_quantity: '',
        low_stock_alert: '5',
        is_enabled: true,
        is_featured: false
    })
    const [orderForm, setOrderForm] = useState({
        tracking_number: '',
        gift_card_code: '',
        notes: ''
    })
    const [stats, setStats] = useState({
        total_items: 0,
        enabled_items: 0,
        pending_orders: 0,
        total_orders: 0
    })

    useEffect(() => {
        loadAllData()
    }, [])

    // ===== LOAD ALL DATA =====
    const loadAllData = async () => {
        setLoading(true)
        await Promise.all([
            loadItems(),
            loadOrders(),
            loadSettings(),
            loadStats()
        ])
        setLoading(false)
    }

    // ===== LOAD ITEMS =====
    const loadItems = async () => {
        const { data } = await supabase
            .from('merch_items')
            .select('*')
            .order('display_order')
            .order('name')
        setItems(data || [])
    }

    // ===== LOAD ORDERS =====
    const loadOrders = async () => {
        const { data } = await supabase
            .from('merch_orders')
            .select(`
                *,
                users (id, username, email, first_name, last_name)
            `)
            .order('ordered_at', { ascending: false })
            .limit(50)
        setOrders(data || [])
    }

    // ===== LOAD SETTINGS =====
    const loadSettings = async () => {
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
    }

    // ===== LOAD STATS =====
    const loadStats = async () => {
        const { data: itemsData } = await supabase.from('merch_items').select('is_enabled')
        const { data: ordersData } = await supabase.from('merch_orders').select('status')

        setStats({
            total_items: itemsData?.length || 0,
            enabled_items: itemsData?.filter(i => i.is_enabled).length || 0,
            pending_orders: ordersData?.filter(o => o.status === 'pending' || o.status === 'processing').length || 0,
            total_orders: ordersData?.length || 0
        })
    }

    // ===== CALCULATE TOKEN PRICE =====
    const calculateTokenPrice = (cost, markup) => {
        const actualMarkup = markup || settings.merch_global_markup
        return Math.ceil(cost * actualMarkup)
    }

    // ===== SAVE ITEM =====
    const saveItem = async () => {
        if (!newItem.name || !newItem.cost) {
            setMessage({ type: 'error', text: 'Name and cost required' })
            return
        }

        try {
            const itemData = {
                name: newItem.name,
                description: newItem.description || null,
                item_type: newItem.item_type,
                cost: parseFloat(newItem.cost),
                markup_multiplier: newItem.markup_multiplier ? parseFloat(newItem.markup_multiplier) : settings.merch_global_markup,
                bb_price: newItem.token_price ? parseInt(newItem.token_price) : calculateTokenPrice(parseFloat(newItem.cost), parseFloat(newItem.markup_multiplier) || settings.merch_global_markup),
                amazon_url: newItem.amazon_url || null,
                image_url: newItem.image_url || null,
                stock_quantity: newItem.item_type === 'in_stock' ? (parseInt(newItem.stock_quantity) || 0) : null,
                low_stock_alert: parseInt(newItem.low_stock_alert) || 5,
                is_enabled: newItem.is_enabled,
                is_featured: newItem.is_featured
            }

            if (editingItem) {
                const { error } = await supabase
                    .from('merch_items')
                    .update({ ...itemData, updated_at: new Date().toISOString() })
                    .eq('id', editingItem.id)
                if (error) throw error
                setMessage({ type: 'success', text: 'Item updated!' })
            } else {
                const { error } = await supabase
                    .from('merch_items')
                    .insert([itemData])
                if (error) throw error
                setMessage({ type: 'success', text: 'Item added!' })
            }

            resetItemForm()
            loadAllData()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error saving item:', error)
            setMessage({ type: 'error', text: 'Failed to save item' })
        }
    }

    // ===== EDIT ITEM =====
    const editItem = (item) => {
        setEditingItem(item)
        setNewItem({
            name: item.name,
            description: item.description || '',
            item_type: item.item_type,
            cost: item.cost.toString(),
            markup_multiplier: item.markup_multiplier?.toString() || '',
            token_price: item.bb_price?.toString() || '',
            amazon_url: item.amazon_url || '',
            image_url: item.image_url || '',
            stock_quantity: item.stock_quantity?.toString() || '',
            low_stock_alert: item.low_stock_alert?.toString() || '5',
            is_enabled: item.is_enabled,
            is_featured: item.is_featured
        })
        setShowItemForm(true)
    }

    // ===== DELETE ITEM =====
    const deleteItem = async (id) => {
        if (!confirm('Delete this item?')) return
        try {
            const { error } = await supabase.from('merch_items').delete().eq('id', id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Item deleted!' })
            loadAllData()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    // ===== TOGGLE ITEM ENABLED =====
    const toggleItemEnabled = async (item) => {
        try {
            const { error } = await supabase
                .from('merch_items')
                .update({ is_enabled: !item.is_enabled, updated_at: new Date().toISOString() })
                .eq('id', item.id)
            if (error) throw error
            loadItems()
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    // ===== RESET ITEM FORM =====
    const resetItemForm = () => {
        setShowItemForm(false)
        setEditingItem(null)
        setNewItem({
            name: '',
            description: '',
            item_type: 'digital_gift_card',
            cost: '',
            markup_multiplier: '',
            token_price: '',
            amazon_url: '',
            image_url: '',
            stock_quantity: '',
            low_stock_alert: '5',
            is_enabled: true,
            is_featured: false
        })
    }

    // ===== UPDATE ORDER STATUS =====
    const updateOrderStatus = async (order, newStatus) => {
        try {
            const updateData = {
                status: newStatus,
                ...(newStatus === 'shipped' && { shipped_at: new Date().toISOString() }),
                ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() })
            }

            if (processingOrder === order.id) {
                if (orderForm.tracking_number) updateData.tracking_number = orderForm.tracking_number
                if (orderForm.gift_card_code) updateData.gift_card_code = orderForm.gift_card_code
                if (orderForm.notes) updateData.notes = orderForm.notes
            }

            const { error } = await supabase
                .from('merch_orders')
                .update(updateData)
                .eq('id', order.id)

            if (error) throw error

            // Send shipped notification email
            if (newStatus === 'shipped' && order.users?.email) {
                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'merch_shipped',
                            to: order.users.email,
                            data: {
                                first_name: order.users.first_name || order.users.username,
                                item_name: order.item_name,
                                tracking_number: orderForm.tracking_number || 'See order details'
                            }
                        })
                    })
                } catch (emailError) {
                    console.error('Shipped notification email error:', emailError)
                }
            }

            // Send gift card delivered email
            if (newStatus === 'delivered' && order.item_type === 'digital_gift_card' && order.users?.email) {
                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'gift_card_sent',
                            to: order.users.email,
                            data: {
                                first_name: order.users.first_name || order.users.username,
                                item_name: order.item_name,
                                gift_card_code: orderForm.gift_card_code || 'Check your order details'
                            }
                        })
                    })
                } catch (emailError) {
                    console.error('Gift card email error:', emailError)
                }
            }

            setMessage({ type: 'success', text: `Order marked as ${newStatus}!` })
            setProcessingOrder(null)
            setOrderForm({ tracking_number: '', gift_card_code: '', notes: '' })
            loadOrders()
            loadStats()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error updating order:', error)
            setMessage({ type: 'error', text: 'Failed to update order' })
        }
    }

    // ===== HELPER FUNCTIONS =====
    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    const getItemTypeLabel = (type) => {
        switch (type) {
            case 'digital_gift_card': return 'Gift Card'
            case 'amazon_dropship': return 'Amazon'
            case 'in_stock': return 'In Stock'
            default: return type
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400'
            case 'processing': return 'bg-blue-500/20 text-blue-400'
            case 'shipped': return 'bg-purple-500/20 text-purple-400'
            case 'delivered': return 'bg-green-500/20 text-green-400'
            case 'cancelled': return 'bg-red-500/20 text-red-400'
            default: return 'bg-slate-500/20 text-slate-400'
        }
    }

    // ===== LOADING STATE =====
    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    // ===== MAIN RENDER =====
    return (
        <div className="p-4">

            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-white">🛍️ Merch Store Admin</h1>
                    <p className="text-slate-400 text-sm">Manage items and orders</p>
                </div>
                {message && (
                    <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* ===== STATS ROW ===== */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Items</p>
                    <p className="text-xl font-bold text-white">{stats.total_items}</p>
                    <p className="text-slate-500 text-xs">{stats.enabled_items} enabled</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Pending Orders</p>
                    <p className="text-xl font-bold text-orange-400">{stats.pending_orders}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Orders</p>
                    <p className="text-xl font-bold text-white">{stats.total_orders}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Global Markup</p>
                    <p className="text-xl font-bold text-yellow-400">{settings.merch_global_markup}x</p>
                    <p className="text-slate-500 text-xs">$10 cost = {settings.merch_global_markup * 10} Tokens</p>
                </div>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-1 mb-3">
                {['items', 'orders'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-yellow-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab === 'items' ? `Items (${stats.total_items})` : `Orders (${stats.pending_orders} pending)`}
                    </button>
                ))}
            </div>

            {/* ===== ITEMS TAB ===== */}
            {activeTab === 'items' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => setShowItemForm(!showItemForm)}
                            className="px-4 py-2 bg-yellow-500 text-slate-900 rounded text-sm font-medium hover:bg-yellow-400"
                        >
                            {showItemForm ? 'Cancel' : '+ Add Item'}
                        </button>
                    </div>

                    {/* ----- Item Form ----- */}
                    {showItemForm && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <h3 className="text-white font-semibold text-sm mb-3">
                                {editingItem ? 'Edit Item' : 'Add New Item'}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Type *</label>
                                    <select
                                        value={newItem.item_type}
                                        onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    >
                                        <option value="digital_gift_card">Digital Gift Card</option>
                                        <option value="amazon_dropship">Amazon Drop-ship</option>
                                        <option value="in_stock">In Stock Item</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Your Cost *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newItem.cost}
                                        onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })}
                                        placeholder="$"
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Markup (default: {settings.merch_global_markup}x)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newItem.markup_multiplier}
                                        onChange={(e) => setNewItem({ ...newItem, markup_multiplier: e.target.value })}
                                        placeholder={settings.merch_global_markup.toString()}
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">
                                        Token Price (auto: {newItem.cost ? calculateTokenPrice(parseFloat(newItem.cost), parseFloat(newItem.markup_multiplier) || settings.merch_global_markup) : '0'})
                                    </label>
                                    <input
                                        type="number"
                                        value={newItem.token_price}
                                        onChange={(e) => setNewItem({ ...newItem, token_price: e.target.value })}
                                        placeholder="Override"
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                                {newItem.item_type === 'amazon_dropship' && (
                                    <div>
                                        <label className="text-slate-400 text-xs block mb-1">Amazon URL</label>
                                        <input
                                            type="text"
                                            value={newItem.amazon_url}
                                            onChange={(e) => setNewItem({ ...newItem, amazon_url: e.target.value })}
                                            className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        />
                                    </div>
                                )}
                                {newItem.item_type === 'in_stock' && (
                                    <div>
                                        <label className="text-slate-400 text-xs block mb-1">Stock Qty</label>
                                        <input
                                            type="number"
                                            value={newItem.stock_quantity}
                                            onChange={(e) => setNewItem({ ...newItem, stock_quantity: e.target.value })}
                                            className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Image URL</label>
                                    <input
                                        type="text"
                                        value={newItem.image_url}
                                        onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                                <div className="flex items-end gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newItem.is_enabled}
                                            onChange={(e) => setNewItem({ ...newItem, is_enabled: e.target.checked })}
                                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500"
                                        />
                                        <span className="text-slate-300 text-sm">Enabled</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newItem.is_featured}
                                            onChange={(e) => setNewItem({ ...newItem, is_featured: e.target.checked })}
                                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500"
                                        />
                                        <span className="text-slate-300 text-sm">Featured</span>
                                    </label>
                                </div>
                            </div>
                            {/* Digital Item Markup Warning */}
                            {newItem.item_type === 'digital_gift_card' && (
                                parseFloat(newItem.markup_multiplier || settings.merch_global_markup) > 1
                            ) && (
                                    <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <span className="text-yellow-400 text-lg">⚠️</span>
                                            <div>
                                                <p className="text-yellow-400 font-medium text-sm">Digital Item Markup Warning</p>
                                                <p className="text-yellow-200/80 text-xs mt-1">
                                                    This is a digital gift card with a <strong>{parseFloat(newItem.markup_multiplier || settings.merch_global_markup)}x markup</strong>.
                                                    {newItem.cost && (
                                                        <> A ${parseFloat(newItem.cost).toFixed(2)} card will cost customers <strong>🪙 {calculateTokenPrice(parseFloat(newItem.cost), parseFloat(newItem.markup_multiplier) || settings.merch_global_markup)}</strong> tokens.</>
                                                    )}
                                                </p>
                                                <p className="text-yellow-200/80 text-xs mt-1">
                                                    <strong>Problem:</strong> Customers can see the face value on the card. A $25 card priced at 75 tokens may feel unfair.
                                                </p>
                                                <p className="text-yellow-200/80 text-xs mt-1">
                                                    <strong>Suggestion:</strong> Use 1x markup for digital items, or set a custom token price equal to the face value.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            <div className="mb-3">
                                <label className="text-slate-400 text-xs block mb-1">Description</label>
                                <textarea
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={saveItem}
                                    className="px-4 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-400"
                                >
                                    {editingItem ? 'Update Item' : 'Save Item'}
                                </button>
                                <button
                                    onClick={resetItemForm}
                                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ----- Items Table ----- */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        {items.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <p>No items yet. Add your first item above!</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                        <th className="text-left py-2 px-3">Item</th>
                                        <th className="text-left py-2 px-3">Type</th>
                                        <th className="text-right py-2 px-3">Cost</th>
                                        <th className="text-right py-2 px-3">Token Price</th>
                                        <th className="text-center py-2 px-3">Stock</th>
                                        <th className="text-center py-2 px-3">Enabled</th>
                                        <th className="text-right py-2 px-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} className={`border-t border-slate-700 ${!item.is_enabled ? 'opacity-50' : ''}`}>
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    {item.image_url ? (
                                                        <img
                                                            src={item.image_url}
                                                            alt={item.name}
                                                            className="w-10 h-10 object-cover rounded border border-slate-600"
                                                            onError={(e) => { e.target.style.display = 'none' }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-700 rounded border border-slate-600 flex items-center justify-center text-slate-500 text-xs">
                                                            No img
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-white font-medium">{item.name}</p>
                                                        {item.is_featured && <span className="text-yellow-400 text-xs">⭐ Featured</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                                                    {getItemTypeLabel(item.item_type)}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-300">${item.cost}</td>
                                            <td className="py-2 px-3 text-right text-yellow-400 font-semibold">🪙 {item.bb_price || item.display_price}</td>
                                            <td className="py-2 px-3 text-center text-slate-400">
                                                {item.item_type === 'in_stock' ? (
                                                    <span className={item.stock_quantity <= item.low_stock_alert ? 'text-red-400' : ''}>
                                                        {item.stock_quantity}
                                                    </span>
                                                ) : '∞'}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <button
                                                    onClick={() => toggleItemEnabled(item)}
                                                    className={`px-2 py-0.5 rounded text-xs ${item.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}
                                                >
                                                    {item.is_enabled ? 'Yes' : 'No'}
                                                </button>
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <button
                                                    onClick={() => editItem(item)}
                                                    className="text-yellow-400 hover:text-yellow-300 text-xs mr-2"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteItem(item.id)}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                    Del
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ORDERS TAB ===== */}
            {activeTab === 'orders' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    {orders.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p>No orders yet.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                    <th className="text-left py-2 px-3">Date</th>
                                    <th className="text-left py-2 px-3">User</th>
                                    <th className="text-left py-2 px-3">Item</th>
                                    <th className="text-right py-2 px-3">Token Cost</th>
                                    <th className="text-center py-2 px-3">Status</th>
                                    <th className="text-left py-2 px-3">Tracking/Code</th>
                                    <th className="text-right py-2 px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-t border-slate-700">
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {formatDate(order.ordered_at)}
                                        </td>
                                        <td className="py-2 px-3">
                                            <p className="text-white">{order.users?.username || 'Unknown'}</p>
                                            <p className="text-slate-500 text-xs">{order.users?.email}</p>
                                        </td>
                                        <td className="py-2 px-3">
                                            <p className="text-white">{order.item_name}</p>
                                            <p className="text-slate-500 text-xs">{getItemTypeLabel(order.item_type)}</p>
                                        </td>
                                        <td className="py-2 px-3 text-right text-yellow-400">🪙 {order.bb_cost}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {order.tracking_number || order.gift_card_code || '-'}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            {processingOrder === order.id ? (
                                                <div className="flex flex-col gap-1 items-end">
                                                    <div className="flex gap-1">
                                                        {order.item_type === 'digital_gift_card' ? (
                                                            <input
                                                                type="text"
                                                                placeholder="Gift card code"
                                                                value={orderForm.gift_card_code}
                                                                onChange={(e) => setOrderForm({ ...orderForm, gift_card_code: e.target.value })}
                                                                className="w-28 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                placeholder="Tracking #"
                                                                value={orderForm.tracking_number}
                                                                onChange={(e) => setOrderForm({ ...orderForm, tracking_number: e.target.value })}
                                                                className="w-28 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => updateOrderStatus(order, order.item_type === 'digital_gift_card' ? 'delivered' : 'shipped')}
                                                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400"
                                                        >
                                                            {order.item_type === 'digital_gift_card' ? 'Send' : 'Ship'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setProcessingOrder(null)
                                                                setOrderForm({ tracking_number: '', gift_card_code: '', notes: '' })
                                                            }}
                                                            className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1 justify-end">
                                                    {order.status === 'pending' && (
                                                        <button
                                                            onClick={() => setProcessingOrder(order.id)}
                                                            className="px-2 py-1 bg-yellow-500 text-slate-900 rounded text-xs font-medium hover:bg-yellow-400"
                                                        >
                                                            Process
                                                        </button>
                                                    )}
                                                    {order.status === 'shipped' && (
                                                        <button
                                                            onClick={() => updateOrderStatus(order, 'delivered')}
                                                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400"
                                                        >
                                                            Delivered
                                                        </button>
                                                    )}
                                                    {(order.status === 'pending' || order.status === 'processing') && (
                                                        <button
                                                            onClick={() => updateOrderStatus(order, 'cancelled')}
                                                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ===== HELP TIP ===== */}
            <div className="mt-3 p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                <p>💡 <strong>Item Types:</strong> Gift Cards (instant email), Amazon (you order & ship), In Stock (your inventory)</p>
            </div>
        </div>
    )
}
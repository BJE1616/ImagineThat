'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminWinnersBoardPage() {
    const { currentTheme } = useTheme()
    const [winners, setWinners] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)

    // Filters
    const [filterGameType, setFilterGameType] = useState('all')
    const [filterVisibility, setFilterVisibility] = useState('all')
    const [filterFeatured, setFilterFeatured] = useState('all')

    // Edit modal
    const [editingWinner, setEditingWinner] = useState(null)
    const [editDisplayName, setEditDisplayName] = useState('')
    const [editDisplayText, setEditDisplayText] = useState('')
    const [editAdminNotes, setEditAdminNotes] = useState('')

    // Add manual winner modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [newWinner, setNewWinner] = useState({
        display_name: '',
        display_text: '',
        prize_type: 'cash',
        prize_value: '',
        game_type: 'manual',
        week_start: new Date().toISOString().split('T')[0],
        admin_notes: ''
    })

    useEffect(() => {
        loadWinners()
    }, [])

    const loadWinners = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('public_winners')
                .select('*')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })

            if (error) throw error
            setWinners(data || [])
        } catch (err) {
            console.error('Error loading winners:', err)
            setMessage({ type: 'error', text: 'Failed to load winners' })
        } finally {
            setLoading(false)
        }
    }

    const toggleVisibility = async (winner) => {
        setSaving(winner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({ is_visible: !winner.is_visible, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            if (error) throw error

            setWinners(prev => prev.map(w =>
                w.id === winner.id ? { ...w, is_visible: !w.is_visible } : w
            ))
            setMessage({ type: 'success', text: `Winner ${!winner.is_visible ? 'shown' : 'hidden'}` })
        } catch (err) {
            console.error('Error toggling visibility:', err)
            setMessage({ type: 'error', text: 'Failed to update visibility' })
        } finally {
            setSaving(null)
        }
    }

    const toggleFeatured = async (winner) => {
        setSaving(winner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({ is_featured: !winner.is_featured, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            if (error) throw error

            setWinners(prev => prev.map(w =>
                w.id === winner.id ? { ...w, is_featured: !w.is_featured } : w
            ))
            setMessage({ type: 'success', text: `Winner ${!winner.is_featured ? 'featured' : 'unfeatured'}` })
        } catch (err) {
            console.error('Error toggling featured:', err)
            setMessage({ type: 'error', text: 'Failed to update featured status' })
        } finally {
            setSaving(null)
        }
    }

    const moveWinner = async (winner, direction) => {
        const currentIndex = winners.findIndex(w => w.id === winner.id)
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

        if (newIndex < 0 || newIndex >= winners.length) return

        setSaving(winner.id)
        try {
            const otherWinner = winners[newIndex]
            const currentOrder = winner.display_order || currentIndex
            const otherOrder = otherWinner.display_order || newIndex

            // Swap display_order values
            await supabase
                .from('public_winners')
                .update({ display_order: otherOrder, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            await supabase
                .from('public_winners')
                .update({ display_order: currentOrder, updated_at: new Date().toISOString() })
                .eq('id', otherWinner.id)

            // Reload to get correct order
            await loadWinners()
            setMessage({ type: 'success', text: 'Order updated' })
        } catch (err) {
            console.error('Error moving winner:', err)
            setMessage({ type: 'error', text: 'Failed to reorder' })
        } finally {
            setSaving(null)
        }
    }

    const openEditModal = (winner) => {
        setEditingWinner(winner)
        setEditDisplayName(winner.display_name || '')
        setEditDisplayText(winner.display_text || '')
        setEditAdminNotes(winner.admin_notes || '')
    }

    const saveEdit = async () => {
        if (!editingWinner) return
        setSaving(editingWinner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({
                    display_name: editDisplayName,
                    display_text: editDisplayText,
                    admin_notes: editAdminNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingWinner.id)

            if (error) throw error

            setWinners(prev => prev.map(w =>
                w.id === editingWinner.id
                    ? { ...w, display_name: editDisplayName, display_text: editDisplayText, admin_notes: editAdminNotes }
                    : w
            ))
            setEditingWinner(null)
            setMessage({ type: 'success', text: 'Winner updated' })
        } catch (err) {
            console.error('Error saving edit:', err)
            setMessage({ type: 'error', text: 'Failed to save changes' })
        } finally {
            setSaving(null)
        }
    }

    const addManualWinner = async () => {
        if (!newWinner.display_name || !newWinner.display_text) {
            setMessage({ type: 'error', text: 'Display name and text are required' })
            return
        }

        setSaving('new')
        try {
            const maxOrder = Math.max(...winners.map(w => w.display_order || 0), 0)

            const { data, error } = await supabase
                .from('public_winners')
                .insert([{
                    display_name: newWinner.display_name,
                    display_text: newWinner.display_text,
                    prize_type: newWinner.prize_type,
                    prize_value: newWinner.prize_value ? parseFloat(newWinner.prize_value) : null,
                    game_type: newWinner.game_type,
                    week_start: newWinner.week_start,
                    admin_notes: newWinner.admin_notes,
                    is_visible: true,
                    is_featured: false,
                    display_order: maxOrder + 1,
                    verified_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) throw error

            setWinners(prev => [...prev, data])
            setShowAddModal(false)
            setNewWinner({
                display_name: '',
                display_text: '',
                prize_type: 'cash',
                prize_value: '',
                game_type: 'manual',
                week_start: new Date().toISOString().split('T')[0],
                admin_notes: ''
            })
            setMessage({ type: 'success', text: 'Manual winner added' })
        } catch (err) {
            console.error('Error adding manual winner:', err)
            setMessage({ type: 'error', text: 'Failed to add winner' })
        } finally {
            setSaving(null)
        }
    }

    const deleteWinner = async (winner) => {
        if (!confirm(`Delete "${winner.display_name}" from the winners board? This cannot be undone.`)) return

        setSaving(winner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .delete()
                .eq('id', winner.id)

            if (error) throw error

            setWinners(prev => prev.filter(w => w.id !== winner.id))
            setMessage({ type: 'success', text: 'Winner deleted' })
        } catch (err) {
            console.error('Error deleting winner:', err)
            setMessage({ type: 'error', text: 'Failed to delete winner' })
        } finally {
            setSaving(null)
        }
    }

    // Apply filters
    const filteredWinners = winners.filter(w => {
        if (filterGameType !== 'all' && w.game_type !== filterGameType) return false
        if (filterVisibility === 'visible' && !w.is_visible) return false
        if (filterVisibility === 'hidden' && w.is_visible) return false
        if (filterFeatured === 'featured' && !w.is_featured) return false
        if (filterFeatured === 'normal' && w.is_featured) return false
        return true
    })

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: currentTheme.text }}>
                        🏆 Winners Board Management
                    </h1>
                    <p style={{ color: currentTheme.textMuted }}>
                        Manage what appears on the public winners page
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    + Add Manual Winner
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
                <div>
                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>Game Type</label>
                    <select
                        value={filterGameType}
                        onChange={(e) => setFilterGameType(e.target.value)}
                        className="px-3 py-2 rounded-lg border"
                        style={{ backgroundColor: currentTheme.card, color: currentTheme.text, borderColor: currentTheme.border }}
                    >
                        <option value="all">All Types</option>
                        <option value="slots">Slots</option>
                        <option value="match">Match Game</option>
                        <option value="manual">Manual Entry</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>Visibility</label>
                    <select
                        value={filterVisibility}
                        onChange={(e) => setFilterVisibility(e.target.value)}
                        className="px-3 py-2 rounded-lg border"
                        style={{ backgroundColor: currentTheme.card, color: currentTheme.text, borderColor: currentTheme.border }}
                    >
                        <option value="all">All</option>
                        <option value="visible">Visible Only</option>
                        <option value="hidden">Hidden Only</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>Featured</label>
                    <select
                        value={filterFeatured}
                        onChange={(e) => setFilterFeatured(e.target.value)}
                        className="px-3 py-2 rounded-lg border"
                        style={{ backgroundColor: currentTheme.card, color: currentTheme.text, borderColor: currentTheme.border }}
                    >
                        <option value="all">All</option>
                        <option value="featured">Featured Only</option>
                        <option value="normal">Not Featured</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <button
                        onClick={loadWinners}
                        className="px-4 py-2 rounded-lg border hover:opacity-80"
                        style={{ borderColor: currentTheme.border, color: currentTheme.text }}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                    <div className="text-2xl font-bold" style={{ color: currentTheme.text }}>{winners.length}</div>
                    <div style={{ color: currentTheme.textMuted }}>Total Winners</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                    <div className="text-2xl font-bold text-green-400">{winners.filter(w => w.is_visible).length}</div>
                    <div style={{ color: currentTheme.textMuted }}>Visible</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                    <div className="text-2xl font-bold text-yellow-400">{winners.filter(w => w.is_featured).length}</div>
                    <div style={{ color: currentTheme.textMuted }}>Featured</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                    <div className="text-2xl font-bold text-gray-400">{winners.filter(w => !w.is_visible).length}</div>
                    <div style={{ color: currentTheme.textMuted }}>Hidden</div>
                </div>
            </div>

            {/* Winners Table */}
            {loading ? (
                <div className="text-center py-12" style={{ color: currentTheme.textMuted }}>
                    Loading winners...
                </div>
            ) : filteredWinners.length === 0 ? (
                <div className="text-center py-12 rounded-lg" style={{ backgroundColor: currentTheme.card, color: currentTheme.textMuted }}>
                    No winners found matching filters
                </div>
            ) : (
                <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: currentTheme.card, borderColor: currentTheme.border }}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: currentTheme.hover }}>
                                <th className="text-left p-3" style={{ color: currentTheme.textMuted }}>Order</th>
                                <th className="text-left p-3" style={{ color: currentTheme.textMuted }}>Display Name</th>
                                <th className="text-left p-3" style={{ color: currentTheme.textMuted }}>Prize</th>
                                <th className="text-left p-3" style={{ color: currentTheme.textMuted }}>Type</th>
                                <th className="text-left p-3" style={{ color: currentTheme.textMuted }}>Week</th>
                                <th className="text-center p-3" style={{ color: currentTheme.textMuted }}>Visible</th>
                                <th className="text-center p-3" style={{ color: currentTheme.textMuted }}>Featured</th>
                                <th className="text-right p-3" style={{ color: currentTheme.textMuted }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWinners.map((winner, index) => (
                                <tr
                                    key={winner.id}
                                    className="border-t hover:opacity-90"
                                    style={{ borderColor: currentTheme.border, backgroundColor: winner.is_featured ? 'rgba(234, 179, 8, 0.1)' : 'transparent' }}
                                >
                                    <td className="p-3">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => moveWinner(winner, 'up')}
                                                disabled={index === 0 || saving === winner.id}
                                                className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
                                                style={{ color: currentTheme.text }}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveWinner(winner, 'down')}
                                                disabled={index === filteredWinners.length - 1 || saving === winner.id}
                                                className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
                                                style={{ color: currentTheme.text }}
                                            >
                                                ▼
                                            </button>
                                            <span className="ml-2 text-sm" style={{ color: currentTheme.textMuted }}>
                                                #{winner.display_order || index + 1}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div style={{ color: currentTheme.text }}>{winner.display_name}</div>
                                        {winner.admin_notes && (
                                            <div className="text-xs mt-1" style={{ color: currentTheme.textMuted }}>
                                                📝 {winner.admin_notes.substring(0, 30)}...
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3" style={{ color: currentTheme.text }}>
                                        {winner.display_text}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${winner.game_type === 'slots' ? 'bg-purple-500/20 text-purple-400' :
                                                winner.game_type === 'match' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {winner.game_type || 'unknown'}
                                        </span>
                                    </td>
                                    <td className="p-3" style={{ color: currentTheme.textMuted }}>
                                        {formatDate(winner.week_start)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => toggleVisibility(winner)}
                                            disabled={saving === winner.id}
                                            className={`px-3 py-1 rounded text-sm ${winner.is_visible
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                        >
                                            {saving === winner.id ? '...' : winner.is_visible ? '👁 Show' : '🚫 Hide'}
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => toggleFeatured(winner)}
                                            disabled={saving === winner.id}
                                            className={`px-3 py-1 rounded text-sm ${winner.is_featured
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                        >
                                            {saving === winner.id ? '...' : winner.is_featured ? '⭐ Featured' : '☆ Normal'}
                                        </button>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => openEditModal(winner)}
                                            className="px-2 py-1 text-blue-400 hover:text-blue-300 mr-2"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => deleteWinner(winner)}
                                            disabled={saving === winner.id}
                                            className="px-2 py-1 text-red-400 hover:text-red-300"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editingWinner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                        <h2 className="text-xl font-bold mb-4" style={{ color: currentTheme.text }}>
                            Edit Winner
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={(e) => setEditDisplayName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Display Text (Prize Description)
                                </label>
                                <input
                                    type="text"
                                    value={editDisplayText}
                                    onChange={(e) => setEditDisplayText(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Admin Notes (not shown publicly)
                                </label>
                                <textarea
                                    value={editAdminNotes}
                                    onChange={(e) => setEditAdminNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditingWinner(null)}
                                className="px-4 py-2 rounded-lg border"
                                style={{ borderColor: currentTheme.border, color: currentTheme.text }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={saving === editingWinner.id}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving === editingWinner.id ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Manual Winner Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: currentTheme.card }}>
                        <h2 className="text-xl font-bold mb-4" style={{ color: currentTheme.text }}>
                            Add Manual Winner
                        </h2>
                        <p className="text-sm mb-4" style={{ color: currentTheme.textMuted }}>
                            Use this for legacy winners or special contests not tracked in the system.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Display Name *
                                </label>
                                <input
                                    type="text"
                                    value={newWinner.display_name}
                                    onChange={(e) => setNewWinner({ ...newWinner, display_name: e.target.value })}
                                    placeholder="e.g., John D."
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Display Text (Prize Description) *
                                </label>
                                <input
                                    type="text"
                                    value={newWinner.display_text}
                                    onChange={(e) => setNewWinner({ ...newWinner, display_text: e.target.value })}
                                    placeholder="e.g., $50 Cash Prize"
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                        Prize Type
                                    </label>
                                    <select
                                        value={newWinner.prize_type}
                                        onChange={(e) => setNewWinner({ ...newWinner, prize_type: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="gift_card">Gift Card</option>
                                        <option value="physical">Physical Prize</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                        Prize Value ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={newWinner.prize_value}
                                        onChange={(e) => setNewWinner({ ...newWinner, prize_value: e.target.value })}
                                        placeholder="50"
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                        Game Type
                                    </label>
                                    <select
                                        value={newWinner.game_type}
                                        onChange={(e) => setNewWinner({ ...newWinner, game_type: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                    >
                                        <option value="manual">Manual Entry</option>
                                        <option value="slots">Slots</option>
                                        <option value="match">Match Game</option>
                                        <option value="contest">Contest</option>
                                        <option value="referral">Referral Bonus</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                        Week/Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newWinner.week_start}
                                        onChange={(e) => setNewWinner({ ...newWinner, week_start: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border"
                                        style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1" style={{ color: currentTheme.textMuted }}>
                                    Admin Notes
                                </label>
                                <textarea
                                    value={newWinner.admin_notes}
                                    onChange={(e) => setNewWinner({ ...newWinner, admin_notes: e.target.value })}
                                    rows={2}
                                    placeholder="Internal notes (not shown publicly)"
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{ backgroundColor: currentTheme.background, color: currentTheme.text, borderColor: currentTheme.border }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 rounded-lg border"
                                style={{ borderColor: currentTheme.border, color: currentTheme.text }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addManualWinner}
                                disabled={saving === 'new'}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {saving === 'new' ? 'Adding...' : 'Add Winner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
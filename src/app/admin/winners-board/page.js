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
    const [showWinnersPage, setShowWinnersPage] = useState(true)
    const [savingVisibility, setSavingVisibility] = useState(false)

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
        loadVisibilitySetting()
    }, [])

    const loadVisibilitySetting = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'show_winners_page')
                .single()

            if (data) {
                setShowWinnersPage(data.setting_value === 'true')
            }
        } catch (err) {
            console.error('Error loading visibility setting:', err)
        }
    }

    const toggleWinnersPageVisibility = async () => {
        setSavingVisibility(true)
        try {
            const newValue = !showWinnersPage
            const { error } = await supabase
                .from('admin_settings')
                .update({ setting_value: newValue.toString() })
                .eq('setting_key', 'show_winners_page')

            if (error) throw error

            setShowWinnersPage(newValue)
            setMessage({
                type: 'success',
                text: newValue
                    ? 'Winners page is now VISIBLE in the Games menu'
                    : 'Winners page is now HIDDEN from the Games menu'
            })
        } catch (err) {
            console.error('Error updating visibility:', err)
            setMessage({ type: 'error', text: 'Failed to update visibility setting' })
        } finally {
            setSavingVisibility(false)
        }
    }

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

            await supabase
                .from('public_winners')
                .update({ display_order: otherOrder, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            await supabase
                .from('public_winners')
                .update({ display_order: currentOrder, updated_at: new Date().toISOString() })
                .eq('id', otherWinner.id)

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
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-16 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className={`text-lg font-bold text-${currentTheme.text}`}>🏆 Winners Board</h1>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Manage what appears on the public winners page</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                    + Add Manual
                </button>
            </div>

            {/* Page Visibility Toggle */}
            <div className={`mb-4 p-3 rounded-lg border ${showWinnersPage ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className={`font-medium ${showWinnersPage ? 'text-green-400' : 'text-red-400'}`}>
                            {showWinnersPage ? '✅ Winners Page is LIVE' : '🚫 Winners Page is HIDDEN'}
                        </div>
                        <div className={`text-xs text-${currentTheme.textMuted}`}>
                            {showWinnersPage
                                ? 'The "Winners" link appears in the Games dropdown menu for all users'
                                : 'The "Winners" link is NOT showing in the Games menu — users cannot see this page'}
                        </div>
                    </div>
                    <button
                        onClick={toggleWinnersPageVisibility}
                        disabled={savingVisibility}
                        className={`px-4 py-2 rounded text-sm font-medium ${showWinnersPage
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            } disabled:opacity-50`}
                    >
                        {savingVisibility ? '...' : showWinnersPage ? 'Hide Page' : 'Show Page'}
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-3 p-2 rounded text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap items-end">
                <div>
                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Type</label>
                    <select
                        value={filterGameType}
                        onChange={(e) => setFilterGameType(e.target.value)}
                        className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}
                    >
                        <option value="all">All</option>
                        <option value="slots">Slots</option>
                        <option value="match">Match</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
                <div>
                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Visibility</label>
                    <select
                        value={filterVisibility}
                        onChange={(e) => setFilterVisibility(e.target.value)}
                        className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}
                    >
                        <option value="all">All</option>
                        <option value="visible">Visible</option>
                        <option value="hidden">Hidden</option>
                    </select>
                </div>
                <div>
                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Featured</label>
                    <select
                        value={filterFeatured}
                        onChange={(e) => setFilterFeatured(e.target.value)}
                        className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}
                    >
                        <option value="all">All</option>
                        <option value="featured">Featured</option>
                        <option value="normal">Normal</option>
                    </select>
                </div>
                <button
                    onClick={loadWinners}
                    className={`px-2 py-1 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text} hover:opacity-80`}
                >
                    🔄
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                <div className={`p-3 rounded bg-${currentTheme.card} border border-${currentTheme.border}`}>
                    <div className={`text-xl font-bold text-${currentTheme.text}`}>{winners.length}</div>
                    <div className={`text-${currentTheme.textMuted} text-xs`}>Total</div>
                </div>
                <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                    <div className="text-xl font-bold text-green-400">{winners.filter(w => w.is_visible).length}</div>
                    <div className={`text-${currentTheme.textMuted} text-xs`}>Visible</div>
                </div>
                <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-xl font-bold text-yellow-400">{winners.filter(w => w.is_featured).length}</div>
                    <div className={`text-${currentTheme.textMuted} text-xs`}>Featured</div>
                </div>
                <div className="p-3 rounded bg-gray-500/10 border border-gray-500/20">
                    <div className="text-xl font-bold text-gray-400">{winners.filter(w => !w.is_visible).length}</div>
                    <div className={`text-${currentTheme.textMuted} text-xs`}>Hidden</div>
                </div>
            </div>

            {/* Winners Table */}
            {filteredWinners.length === 0 ? (
                <div className={`text-center py-8 rounded bg-${currentTheme.card} text-${currentTheme.textMuted} text-sm`}>
                    No winners found
                </div>
            ) : (
                <div className={`rounded overflow-hidden border bg-${currentTheme.card} border-${currentTheme.border}`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`bg-${currentTheme.hover}`}>
                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>#</th>
                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Name</th>
                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Prize</th>
                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Type</th>
                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Week</th>
                                <th className={`text-center p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Visible</th>
                                <th className={`text-center p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Featured</th>
                                <th className={`text-right p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWinners.map((winner, index) => (
                                <tr
                                    key={winner.id}
                                    className={`border-t border-${currentTheme.border} ${winner.is_featured ? 'bg-yellow-500/5' : ''}`}
                                >
                                    <td className="p-2">
                                        <div className="flex items-center gap-0.5">
                                            <button
                                                onClick={() => moveWinner(winner, 'up')}
                                                disabled={index === 0 || saving === winner.id}
                                                className={`p-0.5 text-xs text-${currentTheme.textMuted} hover:text-${currentTheme.text} disabled:opacity-30`}
                                            >▲</button>
                                            <button
                                                onClick={() => moveWinner(winner, 'down')}
                                                disabled={index === filteredWinners.length - 1 || saving === winner.id}
                                                className={`p-0.5 text-xs text-${currentTheme.textMuted} hover:text-${currentTheme.text} disabled:opacity-30`}
                                            >▼</button>
                                            <span className={`ml-1 text-xs text-${currentTheme.textMuted}`}>
                                                {winner.display_order || index + 1}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={`p-2 text-${currentTheme.text}`}>
                                        {winner.display_name}
                                        {winner.admin_notes && <span className={`ml-1 text-${currentTheme.textMuted}`}>📝</span>}
                                    </td>
                                    <td className={`p-2 text-${currentTheme.text}`}>{winner.display_text}</td>
                                    <td className="p-2">
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${winner.game_type === 'slots' ? 'bg-purple-500/20 text-purple-400' :
                                            winner.game_type === 'match' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {winner.game_type || '?'}
                                        </span>
                                    </td>
                                    <td className={`p-2 text-${currentTheme.textMuted} text-xs`}>{formatDate(winner.week_start)}</td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => toggleVisibility(winner)}
                                            disabled={saving === winner.id}
                                            className={`px-2 py-0.5 rounded text-xs ${winner.is_visible ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}
                                        >
                                            {saving === winner.id ? '...' : winner.is_visible ? '👁' : '🚫'}
                                        </button>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => toggleFeatured(winner)}
                                            disabled={saving === winner.id}
                                            className={`px-2 py-0.5 rounded text-xs ${winner.is_featured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}
                                        >
                                            {saving === winner.id ? '...' : winner.is_featured ? '⭐' : '☆'}
                                        </button>
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={() => openEditModal(winner)} className="text-blue-400 hover:text-blue-300 text-xs mr-2">✏️</button>
                                        <button onClick={() => deleteWinner(winner)} disabled={saving === winner.id} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
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
                    <div className={`w-full max-w-md p-4 rounded-lg bg-${currentTheme.card}`}>
                        <h2 className={`text-lg font-bold mb-3 text-${currentTheme.text}`}>Edit Winner</h2>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Name</label>
                                <input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={(e) => setEditDisplayName(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Text</label>
                                <input
                                    type="text"
                                    value={editDisplayText}
                                    onChange={(e) => setEditDisplayText(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Admin Notes</label>
                                <textarea
                                    value={editAdminNotes}
                                    onChange={(e) => setEditAdminNotes(e.target.value)}
                                    rows={2}
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingWinner(null)} className={`px-3 py-1.5 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text}`}>Cancel</button>
                            <button onClick={saveEdit} disabled={saving === editingWinner.id} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                {saving === editingWinner.id ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Manual Winner Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`w-full max-w-md p-4 rounded-lg bg-${currentTheme.card}`}>
                        <h2 className={`text-lg font-bold mb-1 text-${currentTheme.text}`}>Add Manual Winner</h2>
                        <p className={`text-xs mb-3 text-${currentTheme.textMuted}`}>For legacy winners or special contests</p>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Name *</label>
                                <input
                                    type="text"
                                    value={newWinner.display_name}
                                    onChange={(e) => setNewWinner({ ...newWinner, display_name: e.target.value })}
                                    placeholder="e.g., John D."
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Text *</label>
                                <input
                                    type="text"
                                    value={newWinner.display_text}
                                    onChange={(e) => setNewWinner({ ...newWinner, display_text: e.target.value })}
                                    placeholder="e.g., $50 Cash Prize"
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Prize Type</label>
                                    <select
                                        value={newWinner.prize_type}
                                        onChange={(e) => setNewWinner({ ...newWinner, prize_type: e.target.value })}
                                        className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="gift_card">Gift Card</option>
                                        <option value="physical">Physical</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Value ($)</label>
                                    <input
                                        type="number"
                                        value={newWinner.prize_value}
                                        onChange={(e) => setNewWinner({ ...newWinner, prize_value: e.target.value })}
                                        placeholder="50"
                                        className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Game Type</label>
                                    <select
                                        value={newWinner.game_type}
                                        onChange={(e) => setNewWinner({ ...newWinner, game_type: e.target.value })}
                                        className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="slots">Slots</option>
                                        <option value="match">Match</option>
                                        <option value="contest">Contest</option>
                                        <option value="referral">Referral</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Week/Date</label>
                                    <input
                                        type="date"
                                        value={newWinner.week_start}
                                        onChange={(e) => setNewWinner({ ...newWinner, week_start: e.target.value })}
                                        className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Admin Notes</label>
                                <textarea
                                    value={newWinner.admin_notes}
                                    onChange={(e) => setNewWinner({ ...newWinner, admin_notes: e.target.value })}
                                    rows={2}
                                    placeholder="Internal notes"
                                    className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.background} text-${currentTheme.text} border-${currentTheme.border}`}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowAddModal(false)} className={`px-3 py-1.5 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text}`}>Cancel</button>
                            <button onClick={addManualWinner} disabled={saving === 'new'} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                                {saving === 'new' ? 'Adding...' : 'Add Winner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
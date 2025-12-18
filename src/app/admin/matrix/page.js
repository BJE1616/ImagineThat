'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminMatrixPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [matrices, setMatrices] = useState([])
    const [stats, setStats] = useState({
        totalMatrices: 0,
        activeMatrices: 0,
        completedMatrices: 0,
        pendingPayouts: 0
    })
    const [filter, setFilter] = useState('all')
    const [selectedMatrix, setSelectedMatrix] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('recent')

    useEffect(() => {
        loadMatrices()
    }, [filter])

    const loadMatrices = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('matrix_entries')
                .select(`
                    *,
                    users!matrix_entries_user_id_fkey (id, username, email),
                    spot1:users!matrix_entries_spot_1_fkey (id, username),
                    spot2:users!matrix_entries_spot_2_fkey (id, username),
                    spot3:users!matrix_entries_spot_3_fkey (id, username),
                    spot4:users!matrix_entries_spot_4_fkey (id, username),
                    spot5:users!matrix_entries_spot_5_fkey (id, username),
                    spot6:users!matrix_entries_spot_6_fkey (id, username),
                    spot7:users!matrix_entries_spot_7_fkey (id, username)
                `)
                .order('created_at', { ascending: false })

            if (filter === 'active') {
                query = query.eq('is_active', true).eq('is_completed', false)
            } else if (filter === 'completed') {
                query = query.eq('is_completed', true)
            } else if (filter === 'pending-payout') {
                query = query.eq('is_completed', true).eq('payout_status', 'pending')
            }

            const { data, error } = await query

            if (error) throw error

            setMatrices(data || [])

            const { data: allData } = await supabase
                .from('matrix_entries')
                .select('is_active, is_completed, payout_status')

            if (allData) {
                setStats({
                    totalMatrices: allData.length,
                    activeMatrices: allData.filter(m => m.is_active && !m.is_completed).length,
                    completedMatrices: allData.filter(m => m.is_completed).length,
                    pendingPayouts: allData.filter(m => m.is_completed && m.payout_status === 'pending').length
                })
            }
        } catch (error) {
            console.error('Error loading matrices:', error)
        } finally {
            setLoading(false)
        }
    }

    const getFilledSpots = (matrix) => {
        let count = 0
        if (matrix.spot_1) count++
        if (matrix.spot_2) count++
        if (matrix.spot_3) count++
        if (matrix.spot_4) count++
        if (matrix.spot_5) count++
        if (matrix.spot_6) count++
        if (matrix.spot_7) count++
        return count
    }

    const markAsPaid = async (matrixId) => {
        try {
            const { error } = await supabase
                .from('matrix_entries')
                .update({
                    payout_status: 'paid',
                    payout_sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', matrixId)

            if (error) throw error

            loadMatrices()
            setSelectedMatrix(null)
        } catch (error) {
            console.error('Error marking as paid:', error)
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const filteredAndSortedMatrices = matrices
        .filter(matrix => {
            if (!searchTerm) return true
            const username = matrix.users?.username?.toLowerCase() || ''
            const email = matrix.users?.email?.toLowerCase() || ''
            const search = searchTerm.toLowerCase()
            return username.includes(search) || email.includes(search)
        })
        .sort((a, b) => {
            if (sortBy === 'alpha-asc') {
                const nameA = a.users?.username?.toLowerCase() || ''
                const nameB = b.users?.username?.toLowerCase() || ''
                return nameA.localeCompare(nameB)
            } else if (sortBy === 'alpha-desc') {
                const nameA = a.users?.username?.toLowerCase() || ''
                const nameB = b.users?.username?.toLowerCase() || ''
                return nameB.localeCompare(nameA)
            }
            return 0
        })

    if (loading && matrices.length === 0) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Matrix Overview</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>View all referral matrices and payouts</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Total Matrices</p>
                    <p className="text-sm font-bold text-blue-400">{stats.totalMatrices}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Active</p>
                    <p className="text-sm font-bold text-green-400">{stats.activeMatrices}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2">
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Completed</p>
                    <p className="text-sm font-bold text-purple-400">{stats.completedMatrices}</p>
                </div>
                <div className={`bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded p-2`}>
                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Pending Payouts</p>
                    <p className={`text-sm font-bold text-${currentTheme.accent}`}>{stats.pendingPayouts}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 mb-3">
                {[
                    { key: 'all', label: 'All' },
                    { key: 'active', label: 'Active' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'pending-payout', label: 'Pending Payout' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${filter === tab.key
                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search and Sort Row */}
            <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full bg-${currentTheme.border} border border-${currentTheme.border} rounded px-3 py-1.5 text-sm text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:border-${currentTheme.accent}`}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-sm`}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`bg-${currentTheme.border} border border-${currentTheme.border} rounded px-3 py-1.5 text-sm text-${currentTheme.text} focus:outline-none focus:border-${currentTheme.accent}`}
                >
                    <option value="recent">Most Recent</option>
                    <option value="alpha-asc">A → Z</option>
                    <option value="alpha-desc">Z → A</option>
                </select>
            </div>

            <div className="flex gap-3">
                {/* Matrices List */}
                <div className={`${selectedMatrix ? 'w-2/3' : 'w-full'} bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`border-b border-${currentTheme.border}`}>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>User</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Progress</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Payout</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedMatrices.length > 0 ? filteredAndSortedMatrices.map(matrix => (
                                    <tr
                                        key={matrix.id}
                                        onClick={() => setSelectedMatrix(matrix)}
                                        className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 cursor-pointer ${selectedMatrix?.id === matrix.id ? `bg-${currentTheme.border}/50` : ''
                                            }`}
                                    >
                                        <td className="py-2 px-3">
                                            <p className={`text-${currentTheme.text} font-medium text-xs`}>
                                                {matrix.users?.username || 'Unknown'}
                                            </p>
                                            <p className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                {matrix.users?.email}
                                            </p>
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-16 h-1.5 bg-${currentTheme.border} rounded-full overflow-hidden`}>
                                                    <div
                                                        className={`h-full rounded-full ${getFilledSpots(matrix) === 7
                                                            ? 'bg-green-500'
                                                            : `bg-${currentTheme.accent}`
                                                            }`}
                                                        style={{ width: `${(getFilledSpots(matrix) / 7) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-${currentTheme.textMuted} text-xs`}>
                                                    {getFilledSpots(matrix)}/7
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${matrix.is_completed
                                                ? 'bg-green-500/20 text-green-400'
                                                : matrix.is_active
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : `bg-${currentTheme.textMuted}/20 text-${currentTheme.textMuted}`
                                                }`}>
                                                {matrix.is_completed ? 'Completed' : matrix.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            {matrix.is_completed && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${matrix.payout_status === 'paid'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : `bg-${currentTheme.accent}/20 text-${currentTheme.accent}`
                                                    }`}>
                                                    ${matrix.payout_amount} - {matrix.payout_status}
                                                </span>
                                            )}
                                        </td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-[10px]`}>
                                            {formatDate(matrix.created_at)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className={`py-8 text-center text-${currentTheme.textMuted} text-sm`}>
                                            {searchTerm ? 'No matching users found' : 'No matrices found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Matrix Detail Panel */}
                {selectedMatrix && (
                    <div className={`w-1/3 bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-bold text-${currentTheme.text}`}>Matrix Details</h3>
                            <button
                                onClick={() => setSelectedMatrix(null)}
                                className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-sm`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-3">
                            <p className={`text-${currentTheme.textMuted} text-[10px] mb-0.5`}>Owner</p>
                            <p className={`text-${currentTheme.text} font-medium text-sm`}>{selectedMatrix.users?.username}</p>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>{selectedMatrix.users?.email}</p>
                        </div>

                        {/* Matrix Visualization */}
                        <div className="mb-3">
                            <p className={`text-${currentTheme.textMuted} text-[10px] mb-2`}>Matrix Structure</p>
                            <div className={`bg-${currentTheme.border}/50 rounded p-3`}>
                                {/* Spot 1 - Owner */}
                                <div className="flex justify-center mb-2">
                                    <div className={`w-16 h-10 bg-${currentTheme.accent}/20 border border-${currentTheme.accent}/50 rounded flex items-center justify-center`}>
                                        <span className={`text-${currentTheme.accent} text-[10px] font-medium`}>
                                            {selectedMatrix.spot1?.username || 'Owner'}
                                        </span>
                                    </div>
                                </div>

                                {/* Spots 2-3 */}
                                <div className="flex justify-center gap-4 mb-2">
                                    {[2, 3].map(spot => {
                                        const spotData = selectedMatrix[`spot${spot}`]
                                        return (
                                            <div
                                                key={spot}
                                                className={`w-16 h-10 rounded flex items-center justify-center ${spotData
                                                    ? 'bg-green-500/20 border border-green-500/50'
                                                    : `bg-${currentTheme.border}/50 border border-${currentTheme.textMuted}/50`
                                                    }`}
                                            >
                                                <span className={`text-[10px] font-medium ${spotData ? 'text-green-400' : `text-${currentTheme.textMuted}`}`}>
                                                    {spotData?.username || `Spot ${spot}`}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Spots 4-7 */}
                                <div className="flex justify-center gap-2">
                                    {[4, 5, 6, 7].map(spot => {
                                        const spotData = selectedMatrix[`spot${spot}`]
                                        return (
                                            <div
                                                key={spot}
                                                className={`w-12 h-8 rounded flex items-center justify-center ${spotData
                                                    ? 'bg-green-500/20 border border-green-500/50'
                                                    : `bg-${currentTheme.border}/50 border border-${currentTheme.textMuted}/50`
                                                    }`}
                                            >
                                                <span className={`text-[10px] font-medium ${spotData ? 'text-green-400' : `text-${currentTheme.textMuted}`}`}>
                                                    {spotData?.username || spot}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Payout Section */}
                        {selectedMatrix.is_completed && (
                            <div className={`border-t border-${currentTheme.border} pt-3`}>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-2`}>Payout Information</p>
                                <div className="space-y-1 mb-3 text-xs">
                                    <div className="flex justify-between">
                                        <span className={`text-${currentTheme.textMuted}`}>Amount</span>
                                        <span className={`text-${currentTheme.text} font-medium`}>${selectedMatrix.payout_amount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={`text-${currentTheme.textMuted}`}>Method</span>
                                        <span className={`text-${currentTheme.text} capitalize`}>{selectedMatrix.payout_method || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={`text-${currentTheme.textMuted}`}>Status</span>
                                        <span className={`font-medium ${selectedMatrix.payout_status === 'paid' ? 'text-green-400' : `text-${currentTheme.accent}`
                                            }`}>
                                            {selectedMatrix.payout_status}
                                        </span>
                                    </div>
                                    {selectedMatrix.payout_sent_at && (
                                        <div className="flex justify-between">
                                            <span className={`text-${currentTheme.textMuted}`}>Paid On</span>
                                            <span className={`text-${currentTheme.text}`}>{formatDate(selectedMatrix.payout_sent_at)}</span>
                                        </div>
                                    )}
                                </div>

                                {selectedMatrix.payout_status === 'pending' && (
                                    <button
                                        onClick={() => markAsPaid(selectedMatrix.id)}
                                        className="w-full py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-500 transition-all"
                                    >
                                        Mark as Paid
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
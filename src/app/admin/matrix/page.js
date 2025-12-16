'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminMatrixPage() {
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

    if (loading && matrices.length === 0) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-slate-700 rounded w-48"></div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-14 bg-slate-800 rounded"></div>
                        ))}
                    </div>
                    <div className="h-64 bg-slate-800 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-lg font-bold text-white">Matrix Overview</h1>
                <p className="text-slate-400 text-xs">View all referral matrices and payouts</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Total Matrices</p>
                    <p className="text-xl font-bold text-blue-400">{stats.totalMatrices}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Active</p>
                    <p className="text-xl font-bold text-green-400">{stats.activeMatrices}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Completed</p>
                    <p className="text-xl font-bold text-purple-400">{stats.completedMatrices}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Pending Payouts</p>
                    <p className="text-xl font-bold text-amber-400">{stats.pendingPayouts}</p>
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
                            ? 'bg-amber-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-3">
                {/* Matrices List */}
                <div className={`${selectedMatrix ? 'w-2/3' : 'w-full'} bg-slate-800 border border-slate-700 rounded overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">User</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Progress</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Payout</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matrices.length > 0 ? matrices.map(matrix => (
                                    <tr
                                        key={matrix.id}
                                        onClick={() => setSelectedMatrix(matrix)}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${selectedMatrix?.id === matrix.id ? 'bg-slate-700/50' : ''
                                            }`}
                                    >
                                        <td className="py-2 px-3">
                                            <p className="text-white font-medium">
                                                {matrix.users?.username || 'Unknown'}
                                            </p>
                                            <p className="text-slate-400 text-xs">
                                                {matrix.users?.email}
                                            </p>
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${getFilledSpots(matrix) === 7
                                                            ? 'bg-green-500'
                                                            : 'bg-amber-500'
                                                            }`}
                                                        style={{ width: `${(getFilledSpots(matrix) / 7) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-slate-400 text-xs">
                                                    {getFilledSpots(matrix)}/7
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matrix.is_completed
                                                ? 'bg-green-500/20 text-green-400'
                                                : matrix.is_active
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {matrix.is_completed ? 'Completed' : matrix.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            {matrix.is_completed && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matrix.payout_status === 'paid'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                    ${matrix.payout_amount} - {matrix.payout_status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {formatDate(matrix.created_at)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="py-8 text-center text-slate-400 text-sm">
                                            No matrices found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Matrix Detail Panel */}
                {selectedMatrix && (
                    <div className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white">Matrix Details</h3>
                            <button
                                onClick={() => setSelectedMatrix(null)}
                                className="text-slate-400 hover:text-white text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-3">
                            <p className="text-slate-400 text-xs mb-0.5">Owner</p>
                            <p className="text-white font-medium text-sm">{selectedMatrix.users?.username}</p>
                            <p className="text-slate-400 text-xs">{selectedMatrix.users?.email}</p>
                        </div>

                        {/* Matrix Visualization */}
                        <div className="mb-3">
                            <p className="text-slate-400 text-xs mb-2">Matrix Structure</p>
                            <div className="bg-slate-700/50 rounded p-3">
                                {/* Spot 1 - Owner */}
                                <div className="flex justify-center mb-2">
                                    <div className="w-16 h-10 bg-amber-500/20 border border-amber-500/50 rounded flex items-center justify-center">
                                        <span className="text-amber-400 text-[10px] font-medium">
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
                                                    : 'bg-slate-600/50 border border-slate-500/50'
                                                    }`}
                                            >
                                                <span className={`text-[10px] font-medium ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
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
                                                    : 'bg-slate-600/50 border border-slate-500/50'
                                                    }`}
                                            >
                                                <span className={`text-[10px] font-medium ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
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
                            <div className="border-t border-slate-700 pt-3">
                                <p className="text-slate-400 text-xs mb-2">Payout Information</p>
                                <div className="space-y-1 mb-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Amount</span>
                                        <span className="text-white font-medium">${selectedMatrix.payout_amount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Method</span>
                                        <span className="text-white capitalize">{selectedMatrix.payout_method || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Status</span>
                                        <span className={`font-medium ${selectedMatrix.payout_status === 'paid' ? 'text-green-400' : 'text-amber-400'
                                            }`}>
                                            {selectedMatrix.payout_status}
                                        </span>
                                    </div>
                                    {selectedMatrix.payout_sent_at && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Paid On</span>
                                            <span className="text-white">{formatDate(selectedMatrix.payout_sent_at)}</span>
                                        </div>
                                    )}
                                </div>

                                {selectedMatrix.payout_status === 'pending' && (
                                    <button
                                        onClick={() => markAsPaid(selectedMatrix.id)}
                                        className="w-full py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-500 transition-all"
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
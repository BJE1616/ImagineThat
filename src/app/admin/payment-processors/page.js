'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PaymentProcessorsPage() {
    const [processors, setProcessors] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        loadProcessors()
    }, [])

    const loadProcessors = async () => {
        try {
            const { data, error } = await supabase
                .from('payment_processors')
                .select('*')
                .order('display_order')

            if (error) throw error
            setProcessors(data || [])
        } catch (error) {
            console.error('Error loading processors:', error)
            setMessage({ type: 'error', text: 'Failed to load payment processors' })
        } finally {
            setLoading(false)
        }
    }

    const updateProcessor = async (id, field, value) => {
        setSaving(id)
        setMessage(null)

        try {
            const { error } = await supabase
                .from('payment_processors')
                .update({
                    [field]: value,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)

            if (error) throw error

            setProcessors(processors.map(p =>
                p.id === id ? { ...p, [field]: value } : p
            ))
            setMessage({ type: 'success', text: 'Updated!' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            console.error('Error updating processor:', error)
            setMessage({ type: 'error', text: 'Failed to update' })
        } finally {
            setSaving(null)
        }
    }

    const handleBlur = (id, field, value) => {
        const newValue = value === '' ? 0 : Number(value)
        updateProcessor(id, field, newValue)
    }

    const calculateFee = (processor, amount = 100) => {
        if (processor.fee_type === 'free') return 0
        if (processor.fee_type === 'flat_only') return processor.fee_flat
        if (processor.fee_type === 'percentage_only') return (amount * processor.fee_percentage / 100)
        if (processor.fee_type === 'percentage_plus_flat') {
            return (amount * processor.fee_percentage / 100) + processor.fee_flat
        }
        return 0
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Payment Processors</h1>
                    <p className="text-slate-400 text-sm">Configure payment methods and fees</p>
                </div>
                {message && (
                    <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-700/50 text-slate-400 text-xs">
                            <th className="text-left py-2 px-3">Processor</th>
                            <th className="text-left py-2 px-3">Fee Type</th>
                            <th className="text-left py-2 px-3">Fee %</th>
                            <th className="text-left py-2 px-3">Flat $</th>
                            <th className="text-center py-2 px-3">Incoming</th>
                            <th className="text-center py-2 px-3">Outgoing</th>
                            <th className="text-right py-2 px-3">On $100</th>
                            <th className="text-center py-2 px-3">Enabled</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processors.map(processor => (
                            <tr key={processor.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                                <td className="py-2 px-3 text-white font-medium">{processor.name}</td>
                                <td className="py-2 px-3">
                                    <select
                                        value={processor.fee_type}
                                        onChange={(e) => updateProcessor(processor.id, 'fee_type', e.target.value)}
                                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-yellow-500"
                                    >
                                        <option value="free">Free</option>
                                        <option value="percentage_only">% Only</option>
                                        <option value="flat_only">Flat Only</option>
                                        <option value="percentage_plus_flat">% + Flat</option>
                                    </select>
                                </td>
                                <td className="py-2 px-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={processor.fee_percentage}
                                        onChange={(e) => setProcessors(processors.map(p => p.id === processor.id ? { ...p, fee_percentage: e.target.value } : p))}
                                        onBlur={(e) => handleBlur(processor.id, 'fee_percentage', e.target.value)}
                                        disabled={processor.fee_type === 'free' || processor.fee_type === 'flat_only'}
                                        className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-yellow-500 disabled:opacity-50"
                                    />
                                </td>
                                <td className="py-2 px-3">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={processor.fee_flat}
                                        onChange={(e) => setProcessors(processors.map(p => p.id === processor.id ? { ...p, fee_flat: e.target.value } : p))}
                                        onBlur={(e) => handleBlur(processor.id, 'fee_flat', e.target.value)}
                                        disabled={processor.fee_type === 'free' || processor.fee_type === 'percentage_only'}
                                        className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-yellow-500 disabled:opacity-50"
                                    />
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={processor.is_for_incoming}
                                        onChange={(e) => updateProcessor(processor.id, 'is_for_incoming', e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                    />
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={processor.is_for_outgoing}
                                        onChange={(e) => updateProcessor(processor.id, 'is_for_outgoing', e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                    />
                                </td>
                                <td className="py-2 px-3 text-right">
                                    <span className={calculateFee(processor, 100) === 0 ? 'text-green-400' : 'text-yellow-400'}>
                                        ${calculateFee(processor, 100).toFixed(2)}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={processor.is_enabled}
                                        onChange={(e) => updateProcessor(processor.id, 'is_enabled', e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-yellow-500"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">💡 <strong>Tip:</strong> Keep Zelle, Venmo, and Cash App funded via bank/debit to avoid fees on payouts!</p>
            </div>
        </div>
    )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { supabase } from '@/lib/supabase'

export default function AlertsPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [alerts, setAlerts] = useState([])
    const [loading, setLoading] = useState(true)
    const [dismissing, setDismissing] = useState(null)
    const [filter, setFilter] = useState('all')
    const [currentUserId, setCurrentUserId] = useState(null)

    useEffect(() => {
        getCurrentUser()
        fetchAlerts()
    }, [])

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setCurrentUserId(user.id)
    }

    const fetchAlerts = async () => {
        try {
            const response = await fetch('/api/admin/alerts')
            if (response.ok) {
                const data = await response.json()
                setAlerts(data.alerts || [])
            }
        } catch (error) {
            console.error('Error fetching alerts:', error)
        } finally {
            setLoading(false)
        }
    }

    const dismissAlert = async (alert) => {
        setDismissing(alert.key)
        try {
            const response = await fetch('/api/admin/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertType: alert.type,
                    alertKey: alert.key,
                    notes: 'Dismissed from alerts page',
                    userId: currentUserId
                })
            })
            if (response.ok) {
                setAlerts(prev => prev.filter(a => a.key !== alert.key))
            }
        } catch (error) {
            console.error('Error dismissing alert:', error)
        } finally {
            setDismissing(null)
        }
    }

    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'critical': return { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-400', badge: 'bg-red-500', label: 'Critical' }
            case 'high': return { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-400', badge: 'bg-orange-500', label: 'High' }
            case 'medium': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500', label: 'Medium' }
            default: return { bg: 'bg-slate-500/10', border: 'border-slate-500', text: 'text-slate-400', badge: 'bg-slate-500', label: 'Low' }
        }
    }

    const getTypeLabel = (type) => {
        const labels = { prize_pick_winner: 'Winner Selection', prize_notify_winner: 'Winner Notification', prize_pay_winner: 'Winner Payment', prize_setup_missing: 'Prize Setup', health_critical: 'System Health', health_warning: 'System Health', payout_pending: 'Payouts' }
        return labels[type] || 'System'
    }

    const formatTimeAgo = (dateStr) => {
        const diffMs = new Date() - new Date(dateStr)
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)
        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'all') return true
        if (filter === 'critical') return alert.severity === 'critical'
        if (filter === 'high') return alert.severity === 'high'
        if (filter === 'medium') return alert.severity === 'medium'
        if (filter === 'winners') return alert.type.startsWith('prize_')
        if (filter === 'health') return alert.type.startsWith('health_')
        if (filter === 'payouts') return alert.type === 'payout_pending'
        return true
    })

    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const highCount = alerts.filter(a => a.severity === 'high').length
    const mediumCount = alerts.filter(a => a.severity === 'medium').length

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${currentTheme.accent} mx-auto mb-2`}></div>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>Loading alerts...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className={`text-2xl font-bold text-${currentTheme.text}`}>🔔 Alert Center</h1>
                <p className={`text-${currentTheme.textMuted} text-sm mt-1`}>Action items requiring admin attention</p>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                <div className={`p-3 rounded-lg bg-${currentTheme.card} border border-${currentTheme.border}`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Alerts</p>
                    <p className={`text-2xl font-bold text-${currentTheme.text}`}>{alerts.length}</p>
                </div>
                <div className={`p-3 rounded-lg ${criticalCount > 0 ? 'bg-red-500/10 border-red-500' : `bg-${currentTheme.card} border-${currentTheme.border}`} border`}>
                    <p className={`text-xs ${criticalCount > 0 ? 'text-red-400' : `text-${currentTheme.textMuted}`}`}>Critical</p>
                    <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-400' : `text-${currentTheme.text}`}`}>{criticalCount}</p>
                </div>
                <div className={`p-3 rounded-lg ${highCount > 0 ? 'bg-orange-500/10 border-orange-500' : `bg-${currentTheme.card} border-${currentTheme.border}`} border`}>
                    <p className={`text-xs ${highCount > 0 ? 'text-orange-400' : `text-${currentTheme.textMuted}`}`}>High</p>
                    <p className={`text-2xl font-bold ${highCount > 0 ? 'text-orange-400' : `text-${currentTheme.text}`}`}>{highCount}</p>
                </div>
                <div className={`p-3 rounded-lg ${mediumCount > 0 ? 'bg-yellow-500/10 border-yellow-500' : `bg-${currentTheme.card} border-${currentTheme.border}`} border`}>
                    <p className={`text-xs ${mediumCount > 0 ? 'text-yellow-400' : `text-${currentTheme.textMuted}`}`}>Medium</p>
                    <p className={`text-2xl font-bold ${mediumCount > 0 ? 'text-yellow-400' : `text-${currentTheme.text}`}`}>{mediumCount}</p>
                </div>
            </div>

            <div className={`flex items-center gap-2 mb-4 pb-4 border-b border-${currentTheme.border} flex-wrap`}>
                <span className={`text-${currentTheme.textMuted} text-sm`}>Filter:</span>
                {[{ key: 'all', label: 'All' }, { key: 'critical', label: '🔴 Critical' }, { key: 'high', label: '🟠 High' }, { key: 'medium', label: '🟡 Medium' }, { key: 'winners', label: '🏆 Winners' }, { key: 'health', label: '🏥 Health' }, { key: 'payouts', label: '💳 Payouts' }].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1 rounded text-xs font-medium transition-all ${filter === f.key ? `bg-${currentTheme.accent} text-slate-900` : `bg-${currentTheme.card} text-${currentTheme.textMuted} hover:text-${currentTheme.text} border border-${currentTheme.border}`}`}>{f.label}</button>
                ))}
                <button onClick={fetchAlerts} className={`ml-auto px-3 py-1 rounded text-xs font-medium bg-${currentTheme.card} text-${currentTheme.textMuted} hover:text-${currentTheme.text} border border-${currentTheme.border}`}>↻ Refresh</button>
            </div>

            {filteredAlerts.length === 0 ? (
                <div className={`text-center py-12 bg-${currentTheme.card} rounded-lg border border-${currentTheme.border}`}>
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className={`text-${currentTheme.text} font-medium mb-1`}>{filter === 'all' ? 'All Clear!' : 'No Matching Alerts'}</h3>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>{filter === 'all' ? 'No action items require your attention right now.' : 'Try a different filter to see other alerts.'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => {
                        const styles = getSeverityStyles(alert.severity)
                        return (
                            <div key={alert.key} className={`${styles.bg} border ${styles.border} rounded-lg p-4`}>
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">{alert.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`${styles.badge} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>{styles.label}</span>
                                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>{getTypeLabel(alert.type)}</span>
                                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>• {formatTimeAgo(alert.createdAt)}</span>
                                        </div>
                                        <h3 className={`text-${currentTheme.text} font-semibold`}>{alert.title}</h3>
                                        <p className={`text-${currentTheme.textMuted} text-sm mt-0.5`}>{alert.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => router.push(alert.actionUrl)} className={`px-3 py-1.5 ${styles.badge} text-white rounded text-sm font-medium hover:opacity-90`}>{alert.actionLabel}</button>
                                        <button onClick={() => dismissAlert(alert)} disabled={dismissing === alert.key} className={`px-3 py-1.5 bg-${currentTheme.card} text-${currentTheme.textMuted} hover:text-${currentTheme.text} border border-${currentTheme.border} rounded text-sm font-medium disabled:opacity-50`}>{dismissing === alert.key ? '...' : 'Dismiss'}</button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className={`mt-6 p-4 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                <h4 className={`text-${currentTheme.text} font-medium text-sm mb-2`}>💡 About Alerts</h4>
                <ul className={`text-${currentTheme.textMuted} text-xs space-y-1`}>
                    <li>• <span className="text-red-400 font-medium">Critical</span> alerts need immediate attention</li>
                    <li>• <span className="text-orange-400 font-medium">High</span> alerts should be addressed soon</li>
                    <li>• <span className="text-yellow-400 font-medium">Medium</span> alerts are reminders for routine tasks</li>
                    <li>• Alerts auto-resolve when the underlying condition is fixed</li>
                </ul>
            </div>
        </div>
    )
}
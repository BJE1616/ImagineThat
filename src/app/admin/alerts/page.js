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
            case 'critical': return { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-400', badge: 'bg-red-500', badgeText: 'text-white' }
            case 'high': return { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-400', badge: 'bg-orange-500', badgeText: 'text-white' }
            case 'medium': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', badge: 'bg-yellow-500', badgeText: 'text-slate-900' }
            default: return { bg: 'bg-slate-500/10', border: 'border-slate-500/50', text: 'text-slate-400', badge: 'bg-slate-500', badgeText: 'text-white' }
        }
    }

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'all') return true
        if (filter === 'critical') return alert.severity === 'critical'
        if (filter === 'high') return alert.severity === 'high'
        if (filter === 'medium') return alert.severity === 'medium'
        return true
    })

    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const highCount = alerts.filter(a => a.severity === 'high').length
    const mediumCount = alerts.filter(a => a.severity === 'medium').length

    if (loading) {
        return (
            <div className="p-4 flex items-center justify-center">
                <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${currentTheme.accent}`}></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>🔔 Alert Center</h1>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${criticalCount > 0 ? 'bg-red-500/20 text-red-400' : `bg-${currentTheme.card} text-${currentTheme.textMuted}`}`}>
                        {criticalCount} Critical
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${highCount > 0 ? 'bg-orange-500/20 text-orange-400' : `bg-${currentTheme.card} text-${currentTheme.textMuted}`}`}>
                        {highCount} High
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${mediumCount > 0 ? 'bg-yellow-500/20 text-yellow-400' : `bg-${currentTheme.card} text-${currentTheme.textMuted}`}`}>
                        {mediumCount} Medium
                    </span>
                    <button onClick={fetchAlerts} className={`text-xs px-2 py-0.5 rounded bg-${currentTheme.card} text-${currentTheme.textMuted} hover:text-${currentTheme.text} border border-${currentTheme.border}`}>↻</button>
                </div>
            </div>

            {/* Filter tabs */}
            <div className={`flex gap-1 mb-3 pb-2 border-b border-${currentTheme.border}`}>
                {['all', 'critical', 'high', 'medium'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2 py-0.5 rounded text-xs ${filter === f ? `bg-${currentTheme.accent} text-slate-900 font-medium` : `text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Alerts list */}
            {filteredAlerts.length === 0 ? (
                <div className={`text-center py-8 bg-${currentTheme.card} rounded border border-${currentTheme.border}`}>
                    <div className="text-2xl mb-1">✅</div>
                    <p className={`text-${currentTheme.text} font-medium text-sm`}>All Clear!</p>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>No action items require your attention right now.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredAlerts.map((alert) => {
                        const styles = getSeverityStyles(alert.severity)
                        return (
                            <div key={alert.key} className={`${styles.bg} border ${styles.border} rounded px-3 py-2 flex items-center gap-3`}>
                                <span className="text-base">{alert.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`${styles.text} font-medium text-sm`}>{alert.title}</span>
                                        <span className={`text-${currentTheme.textMuted} text-xs truncate`}>{alert.description}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => router.push(alert.actionUrl)}
                                        className={`px-2 py-0.5 ${styles.badge} ${styles.badgeText} rounded text-xs font-medium hover:opacity-90`}
                                    >
                                        {alert.actionLabel}
                                    </button>
                                    <button
                                        onClick={() => dismissAlert(alert)}
                                        disabled={dismissing === alert.key}
                                        className={`px-2 py-0.5 bg-${currentTheme.card} text-${currentTheme.textMuted} hover:text-${currentTheme.text} border border-${currentTheme.border} rounded text-xs disabled:opacity-50`}
                                    >
                                        {dismissing === alert.key ? '...' : '✕'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
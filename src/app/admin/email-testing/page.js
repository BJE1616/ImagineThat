'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminEmailTestingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [testMode, setTestMode] = useState(true)
    const [testRecipient, setTestRecipient] = useState('bje1616@gmail.com')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [sendingTest, setSendingTest] = useState(null)
    const [emailLog, setEmailLog] = useState([])
    const [templates, setTemplates] = useState([])

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('is_admin')
                .eq('id', user.id)
                .single()

            if (!userData?.is_admin) { router.push('/dashboard'); return }

            setIsAdmin(true)
            await loadSettings()
            await loadTemplates()
        } catch (error) {
            console.error('Error:', error)
            router.push('/auth/login')
        } finally {
            setLoading(false)
        }
    }

    const loadTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('email_templates')
                .select('*')
                .eq('enabled', true)
                .order('category', { ascending: true })
                .order('template_name', { ascending: true })

            if (error) throw error
            setTemplates(data || [])
        } catch (error) {
            console.error('Error loading templates:', error)
        }
    }

    const loadSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['email_test_mode', 'test_email_recipient'])

            if (data) {
                data.forEach(item => {
                    if (item.setting_key === 'email_test_mode') {
                        setTestMode(item.setting_value === 'true')
                    }
                    if (item.setting_key === 'test_email_recipient') {
                        setTestRecipient(item.setting_value || 'bje1616@gmail.com')
                    }
                })
            }
        } catch (error) {
            console.error('Error loading settings:', error)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        setMessage(null)

        try {
            await supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'email_test_mode',
                    setting_value: testMode ? 'true' : 'false',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'setting_key' })

            await supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'test_email_recipient',
                    setting_value: testRecipient,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'setting_key' })

            setMessage({ type: 'success', text: 'Settings saved!' })
        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSaving(false)
        }
    }

    const getTestData = (template) => {
        // Generate sample data based on template variables
        const sampleData = {
            username: 'TestUser',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            views: '1,000',
            rank: '1',
            prize: '$50 Amazon Gift Card',
            amount: '200.00',
            payment_method: 'PayPal',
            payment_handle: 'test@example.com',
            confirmation_number: 'ABC123',
            date: new Date().toLocaleDateString(),
            order_number: 'ORD-12345',
            item_name: 'ImagineThat T-Shirt',
            bb_cost: '500',
            tracking_number: 'TRK123456',
            gift_card_code: 'GIFT-XXXX-XXXX',
            year: '2024',
            total_income: '1,000.00',
            total_expenses: '500.00',
            matrix_number: '1',
            campaign_tier: 'Standard',
            views_guaranteed: '1,000',
            count: '5',
            total_amount: '1,000.00',
            payout: '200'
        }
        return sampleData
    }

    const sendTestEmail = async (template) => {
        setSendingTest(template.id)
        setMessage(null)

        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: template.template_key,
                    to: testRecipient,
                    data: getTestData(template)
                })
            })

            const result = await response.json()

            if (result.success) {
                setMessage({ type: 'success', text: `✅ ${template.template_name} sent!` })
                setEmailLog(prev => [{
                    type: template.template_name,
                    time: new Date().toLocaleTimeString(),
                    status: 'sent'
                }, ...prev.slice(0, 9)])
            } else {
                setMessage({ type: 'error', text: `Failed: ${result.error}` })
                setEmailLog(prev => [{
                    type: template.template_name,
                    time: new Date().toLocaleTimeString(),
                    status: 'failed'
                }, ...prev.slice(0, 9)])
            }
        } catch (error) {
            console.error('Error sending test email:', error)
            setMessage({ type: 'error', text: 'Failed to send test email' })
        } finally {
            setSendingTest(null)
        }
    }

    const getCategoryColor = (category) => {
        switch (category) {
            case 'user': return 'bg-blue-500'
            case 'financial': return 'bg-green-500'
            case 'admin': return 'bg-purple-500'
            default: return 'bg-slate-500'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <div className="min-h-screen bg-slate-900 py-2 px-2">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-lg font-bold text-white">📧 Email Testing</h1>
                    <Link href="/admin" className="px-3 py-1 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs">← Back</Link>
                </div>

                {message && (
                    <div className={`mb-2 p-2 rounded-lg text-center text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    {/* Settings Panel */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h2 className="text-sm font-bold text-white mb-2">⚙️ Settings</h2>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-white text-xs">Test Mode</span>
                                <button
                                    onClick={() => setTestMode(!testMode)}
                                    className={`w-10 h-5 rounded-full transition-all ${testMode ? 'bg-green-500' : 'bg-red-500'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-all ${testMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                </button>
                            </div>

                            <div className={`p-1.5 rounded text-center text-xs font-bold ${testMode ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {testMode ? '🛡️ SAFE MODE' : '⚠️ LIVE MODE'}
                            </div>

                            <div>
                                <label className="text-slate-400 text-[10px] block mb-1">Test Recipient</label>
                                <input
                                    type="email"
                                    value={testRecipient}
                                    onChange={(e) => setTestRecipient(e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className="w-full py-1.5 bg-teal-600 text-white font-bold rounded text-xs hover:bg-teal-500 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>

                    {/* Log Panel */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h2 className="text-sm font-bold text-white mb-2">📋 Log</h2>

                        {emailLog.length === 0 ? (
                            <p className="text-slate-500 text-xs text-center py-4">No emails sent yet</p>
                        ) : (
                            <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                                {emailLog.map((log, i) => (
                                    <div key={i} className="flex items-center justify-between p-1 bg-slate-900 rounded text-[10px]">
                                        <div className="flex items-center gap-1">
                                            <span className={log.status === 'sent' ? 'text-green-400' : 'text-red-400'}>
                                                {log.status === 'sent' ? '✅' : '❌'}
                                            </span>
                                            <span className="text-white truncate max-w-[120px]">{log.type}</span>
                                        </div>
                                        <span className="text-slate-500">{log.time}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" className="block text-center text-teal-400 hover:underline text-[10px] mt-2">
                            View Resend Dashboard →
                        </a>
                    </div>
                </div>

                {/* Templates List */}
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-white">📨 Send Test Emails</h2>
                        <span className="text-slate-400 text-[10px]">Sending to: {testRecipient}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                        {templates.map((template) => (
                            <div key={template.id} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 ${getCategoryColor(template.category)}`}>
                                        {template.category?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                    <span className="text-white text-xs truncate">{template.template_name}</span>
                                </div>
                                <button
                                    onClick={() => sendTestEmail(template)}
                                    disabled={sendingTest === template.id}
                                    className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-500 disabled:opacity-50 flex-shrink-0 ml-2"
                                >
                                    {sendingTest === template.id ? '...' : 'Send'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-2 text-center">
                    <Link href="/admin/email-templates" className="text-teal-400 hover:underline text-xs">📝 Edit Templates →</Link>
                </div>
            </div>
        </div>
    )
}
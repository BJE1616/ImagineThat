'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminEmailTemplatesPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [templates, setTemplates] = useState([])
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [previewMode, setPreviewMode] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState('all')

    const [formData, setFormData] = useState({
        subject: '',
        html_body: '',
        text_body: '',
        enabled: true
    })

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
                .order('category', { ascending: true })
                .order('template_name', { ascending: true })

            if (error) throw error
            setTemplates(data || [])
        } catch (error) {
            console.error('Error loading templates:', error)
            setMessage({ type: 'error', text: 'Failed to load templates' })
        }
    }

    const selectTemplate = (template) => {
        setSelectedTemplate(template)
        setFormData({
            subject: template.subject,
            html_body: template.html_body,
            text_body: template.text_body || '',
            enabled: template.enabled
        })
        setPreviewMode(false)
        setMessage(null)
    }

    const handleSave = async () => {
        if (!selectedTemplate) return

        setSaving(true)
        setMessage(null)

        try {
            const { error } = await supabase
                .from('email_templates')
                .update({
                    subject: formData.subject,
                    html_body: formData.html_body,
                    text_body: formData.text_body,
                    enabled: formData.enabled,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedTemplate.id)

            if (error) throw error

            setMessage({ type: 'success', text: 'Template saved!' })
            await loadTemplates()

            setSelectedTemplate(prev => ({
                ...prev,
                subject: formData.subject,
                html_body: formData.html_body,
                text_body: formData.text_body,
                enabled: formData.enabled
            }))
        } catch (error) {
            console.error('Error saving template:', error)
            setMessage({ type: 'error', text: 'Failed to save template' })
        } finally {
            setSaving(false)
        }
    }

    const getPreviewHtml = () => {
        let html = formData.html_body
        const sampleData = {
            username: 'JohnDoe',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            views: '1,000',
            rank: '1',
            prize: '$50 Amazon Gift Card',
            amount: '200.00',
            payment_method: 'PayPal',
            payment_handle: 'john@example.com',
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
            total_amount: '1,000.00'
        }

        Object.keys(sampleData).forEach(key => {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), sampleData[key])
        })

        return html
    }

    const getCategoryColor = (category) => {
        switch (category) {
            case 'user': return 'bg-blue-500'
            case 'financial': return 'bg-green-500'
            case 'admin': return 'bg-purple-500'
            default: return 'bg-slate-500'
        }
    }

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.template_key.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory
        return matchesSearch && matchesCategory
    })

    const categories = ['all', ...new Set(templates.map(t => t.category).filter(Boolean))]

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
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-lg font-bold text-white">📝 Email Templates</h1>
                    <Link href="/admin" className="px-3 py-1 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs">← Back</Link>
                </div>

                {message && (
                    <div className={`mb-2 p-2 rounded-lg text-center text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-12 gap-2">
                    {/* Template List */}
                    <div className="col-span-4 bg-slate-800 border border-slate-700 rounded-lg p-2">
                        <input
                            type="text"
                            placeholder="🔍 Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs mb-2 focus:outline-none focus:border-teal-500"
                        />

                        <div className="flex gap-1 mb-2 flex-wrap">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${filterCategory === cat ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                                >
                                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
                            {filteredTemplates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => selectTemplate(template)}
                                    className={`w-full text-left px-2 py-1 rounded border transition-all ${selectedTemplate?.id === template.id
                                        ? 'border-teal-500 bg-teal-500/10'
                                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center ${getCategoryColor(template.category)}`}>
                                            {template.category?.charAt(0).toUpperCase() || '?'}
                                        </span>
                                        <p className="text-white text-xs truncate flex-1">{template.template_name}</p>
                                        {!template.enabled && <span className="text-red-400 text-[10px]">⊘</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="col-span-8 bg-slate-800 border border-slate-700 rounded-lg p-3">
                        {selectedTemplate ? (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h2 className="text-white font-bold text-sm">{selectedTemplate.template_name}</h2>
                                        <p className="text-slate-500 text-[10px]">Key: {selectedTemplate.template_key}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPreviewMode(!previewMode)}
                                            className={`px-2 py-1 rounded text-xs font-medium ${previewMode ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                                        >
                                            {previewMode ? '✏️ Edit' : '👁 Preview'}
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500 disabled:opacity-50"
                                        >
                                            {saving ? 'Saving...' : '💾 Save'}
                                        </button>
                                    </div>
                                </div>

                                {selectedTemplate.variables && (
                                    <div className="mb-2 p-1.5 bg-slate-900 rounded border border-slate-700">
                                        <p className="text-slate-400 text-[10px] mb-1">Variables:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {(Array.isArray(selectedTemplate.variables)
                                                ? selectedTemplate.variables
                                                : JSON.parse(selectedTemplate.variables)
                                            ).map(v => (
                                                <code key={v} className="px-1 py-0.5 bg-slate-700 text-teal-400 rounded text-[9px]">{`{{${v}}}`}</code>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-slate-400 text-xs">Enabled:</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                                        className={`w-8 h-4 rounded-full transition-all ${formData.enabled ? 'bg-green-500' : 'bg-red-500'}`}
                                    >
                                        <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-all ${formData.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                    </button>
                                    <span className={`text-[10px] ${formData.enabled ? 'text-green-400' : 'text-red-400'}`}>
                                        {formData.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                </div>

                                {previewMode ? (
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-slate-400 text-[10px] mb-1">Subject:</p>
                                            <div className="p-2 bg-slate-900 rounded border border-slate-700 text-white text-sm">
                                                {formData.subject.replace(/{{(\w+)}}/g, (_, key) => {
                                                    const samples = { username: 'JohnDoe', first_name: 'John', amount: '200.00', rank: '1', count: '5' }
                                                    return samples[key] || `[${key}]`
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-[10px] mb-1">Preview:</p>
                                            <div className="p-4 bg-white rounded border max-h-[50vh] overflow-y-auto" style={{ color: '#000' }} dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-slate-400 text-[10px] block mb-1">Subject Line</label>
                                            <input
                                                type="text"
                                                value={formData.subject}
                                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-slate-400 text-[10px] block mb-1">HTML Body</label>
                                            <textarea
                                                value={formData.html_body}
                                                onChange={(e) => setFormData({ ...formData, html_body: e.target.value })}
                                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-mono focus:outline-none focus:border-teal-500 min-h-[35vh]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-slate-400 text-[10px] block mb-1">Plain Text (fallback)</label>
                                            <textarea
                                                value={formData.text_body}
                                                onChange={(e) => setFormData({ ...formData, text_body: e.target.value })}
                                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-teal-500 min-h-[8vh]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-slate-500">
                                <p>← Select a template to edit</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 text-center">
                    <Link href="/admin/email-testing" className="text-teal-400 hover:underline text-xs">📧 Go to Email Testing →</Link>
                </div>
            </div>
        </div>
    )
}
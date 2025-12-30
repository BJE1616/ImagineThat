'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminFAQsPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [faqs, setFaqs] = useState([])
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [editingFaq, setEditingFaq] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [formData, setFormData] = useState({
        question: '',
        answer: '',
        category: 'general',
        display_order: 0,
        is_active: true
    })

    const categories = [
        { value: 'general', label: 'General' },
        { value: 'players', label: 'Players' },
        { value: 'advertisers', label: 'Advertisers' }
    ]

    useEffect(() => { checkAdmin() }, [])

    const checkAdmin = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) { router.push('/auth/login'); return }
            setUser(authUser)
            const { data: userData } = await supabase.from('users').select('is_admin').eq('id', authUser.id).single()
            if (!userData?.is_admin) { router.push('/dashboard'); return }
            setIsAdmin(true)
            await loadFAQs()
        } catch (error) {
            router.push('/auth/login')
        } finally {
            setLoading(false)
        }
    }

    const loadFAQs = async () => {
        try {
            const { data, error } = await supabase.from('faqs').select('*').order('category', { ascending: true }).order('display_order', { ascending: true })
            if (error) throw error
            setFaqs(data || [])
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load FAQs' })
        }
    }

    const resetForm = () => {
        setFormData({ question: '', answer: '', category: 'general', display_order: 0, is_active: true })
        setEditingFaq(null)
    }

    const handleEdit = (faq) => {
        setEditingFaq(faq)
        setFormData({ question: faq.question, answer: faq.answer, category: faq.category, display_order: faq.display_order, is_active: faq.is_active })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.question.trim() || !formData.answer.trim()) { setMessage({ type: 'error', text: 'Question and answer required' }); return }
        setSaving(true)
        setMessage(null)
        try {
            if (editingFaq) {
                const { error } = await supabase.from('faqs').update({ question: formData.question.trim(), answer: formData.answer.trim(), category: formData.category, display_order: formData.display_order, is_active: formData.is_active, updated_at: new Date().toISOString() }).eq('id', editingFaq.id)
                if (error) throw error
                setMessage({ type: 'success', text: 'Updated!' })
            } else {
                const { error } = await supabase.from('faqs').insert([{ question: formData.question.trim(), answer: formData.answer.trim(), category: formData.category, display_order: formData.display_order, is_active: formData.is_active }])
                if (error) throw error
                setMessage({ type: 'success', text: 'Added!' })
            }
            resetForm()
            await loadFAQs()
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save' })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (faq) => {
        if (!confirm(`Delete "${faq.question}"?`)) return
        try {
            const { error } = await supabase.from('faqs').delete().eq('id', faq.id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Deleted!' })
            await loadFAQs()
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const toggleActive = async (faq) => {
        try {
            const { error } = await supabase.from('faqs').update({ is_active: !faq.is_active, updated_at: new Date().toISOString() }).eq('id', faq.id)
            if (error) throw error
            await loadFAQs()
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const getCategoryLabel = (value) => categories.find(c => c.value === value)?.label || value
    const getCategoryColor = (category) => {
        switch (category) {
            case 'players': return 'bg-blue-500'
            case 'advertisers': return 'bg-green-500'
            default: return 'bg-purple-500'
        }
    }

    const filteredFaqs = faqs.filter(faq => {
        if (searchTerm === '') return true
        return faq.question.toLowerCase().includes(searchTerm.toLowerCase()) || faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    })

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div></div>
    if (!isAdmin) return null

    return (
        <div className="min-h-screen bg-slate-900 py-3 px-2">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-lg font-bold text-white">📋 Manage FAQs</h1>
                    <Link href="/admin" className="px-3 py-1 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs">← Back</Link>
                </div>

                {message && <div className={`mb-2 p-2 rounded-lg text-center text-xs ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{message.text}</div>}

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                    <h2 className="text-sm font-bold text-white mb-2">{editingFaq ? '✏️ Edit' : '➕ Add'} FAQ</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Question *</label>
                                <input type="text" value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-teal-500" placeholder="e.g., How do I earn tokens?" required />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Answer *</label>
                                <textarea value={formData.answer} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-teal-500 min-h-[60px]" placeholder="Write your answer here..." required />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Category</label>
                                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none">
                                        {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Order (lower = first)</label>
                                    <input type="number" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none" min="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Visibility</label>
                                    <div className="flex items-center gap-2 pt-1">
                                        <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })} className={`w-10 h-5 rounded-full transition-all ${formData.is_active ? 'bg-green-500' : 'bg-gray-600'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-all ${formData.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                        </button>
                                        <span className="text-xs text-slate-400">{formData.is_active ? 'Active' : 'Hidden'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-green-600 text-white font-bold rounded text-sm hover:bg-green-500 disabled:opacity-50">{saving ? '...' : editingFaq ? 'Update' : 'Add'}</button>
                                {editingFaq && <button type="button" onClick={resetForm} className="px-4 py-1.5 bg-slate-700 text-white rounded text-sm">Cancel</button>}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-white">📝 All FAQs ({faqs.length})</h2>
                        <input type="text" placeholder="🔍 Search FAQs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm w-40 focus:outline-none focus:border-teal-500" />
                    </div>
                    {filteredFaqs.length === 0 ? (
                        <p className="text-slate-400 text-center py-4 text-sm">{searchTerm ? 'No matches found.' : 'No FAQs yet.'}</p>
                    ) : (
                        <div className="space-y-1">
                            {filteredFaqs.map((faq) => (
                                <div key={faq.id} className={`p-2 rounded-lg border ${faq.is_active ? 'border-slate-700 bg-slate-900' : 'border-gray-600 bg-gray-800/50 opacity-60'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${getCategoryColor(faq.category)}`}>{getCategoryLabel(faq.category)}</span>
                                                <span className="text-[10px] text-slate-500">#{faq.display_order}</span>
                                                {!faq.is_active && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-600 text-gray-300">Hidden</span>}
                                            </div>
                                            <h3 className="font-medium text-white text-sm truncate">{faq.question}</h3>
                                            <p className="text-xs text-slate-400 truncate">{faq.answer}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(faq)} className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500">Edit</button>
                                            <button onClick={() => toggleActive(faq)} className={`px-2 py-1 text-[10px] rounded ${faq.is_active ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'}`}>{faq.is_active ? 'Hide' : 'Show'}</button>
                                            <button onClick={() => handleDelete(faq)} className="px-2 py-1 bg-red-600 text-white text-[10px] rounded hover:bg-red-500">Del</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-2 text-center">
                    <Link href="/faq" className="text-teal-400 hover:underline text-xs" target="_blank">👁 Preview FAQ Page →</Link>
                </div>
            </div>
        </div>
    )
}
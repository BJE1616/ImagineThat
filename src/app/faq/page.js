'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function FAQPage() {
    const { currentTheme } = useTheme()
    const [faqs, setFaqs] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')
    const [openFaq, setOpenFaq] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    const categories = [
        { value: 'all', label: 'All' },
        { value: 'general', label: 'General' },
        { value: 'players', label: 'Players' },
        { value: 'advertisers', label: 'Advertisers' },
        { value: 'matrix', label: 'Matrix' }
    ]

    useEffect(() => {
        loadFAQs()
    }, [])

    const loadFAQs = async () => {
        try {
            const { data, error } = await supabase
                .from('faqs')
                .select('*')
                .eq('is_active', true)
                .order('category', { ascending: true })
                .order('display_order', { ascending: true })
            if (error) throw error
            setFaqs(data || [])
        } catch (error) {
            console.error('Error loading FAQs:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredFaqs = faqs.filter(faq => {
        const matchesCategory = activeCategory === 'all' || faq.category === activeCategory
        const matchesSearch = searchTerm === '' ||
            faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesCategory && matchesSearch
    })

    const toggleFaq = (id) => {
        setOpenFaq(openFaq === id ? null : id)
    }

    const getCategoryColor = (category) => {
        switch (category) {
            case 'players': return 'bg-blue-500'
            case 'advertisers': return 'bg-green-500'
            case 'matrix': return 'bg-orange-500'
            default: return 'bg-purple-500'
        }
    }

    const getCategoryLabel = (value) => {
        return categories.find(c => c.value === value)?.label || value
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 py-4 px-2">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">FAQ</h1>
                </div>

                <div className="mb-3">
                    <input
                        type="text"
                        placeholder="Search FAQs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                </div>

                <div className="flex flex-wrap justify-center gap-1 mb-3">
                    {categories.map(cat => (
                        <button key={cat.value} onClick={() => setActiveCategory(cat.value)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${activeCategory === cat.value ? 'bg-teal-500 text-white' : 'bg-slate-800 border border-slate-700 text-white hover:bg-slate-700'}`}>
                            {cat.label}
                        </button>
                    ))}
                </div>

                {filteredFaqs.length === 0 ? (
                    <div className="text-center py-6 bg-slate-800 border border-slate-700 rounded-lg">
                        <p className="text-slate-400 text-sm">No FAQs found.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredFaqs.map((faq) => (
                            <div key={faq.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                <button onClick={() => toggleFaq(faq.id)} className="w-full px-2 py-1.5 flex items-center justify-between text-left hover:bg-slate-700/30">
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${getCategoryColor(faq.category)}`}>{getCategoryLabel(faq.category)}</span>
                                        <h3 className="font-medium text-white text-sm">{faq.question}</h3>
                                    </div>
                                    <span className={`text-slate-400 text-sm ml-2 ${openFaq === faq.id ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                {openFaq === faq.id && (
                                    <div className="px-3 pb-2 border-t border-slate-700">
                                        <p className="text-slate-400 whitespace-pre-wrap pt-2 text-sm">{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 text-center bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-sm mb-2">Still have questions?</p>
                    <a href="mailto:support@imaginethat.icu" className="inline-block px-4 py-2 bg-teal-500 text-white font-bold rounded-lg text-sm hover:opacity-90">Contact Support</a>
                </div>
            </div>
        </div>
    )
}
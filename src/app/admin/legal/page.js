'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

// Toolbar Button Component
const ToolbarButton = ({ onClick, isActive, children, title }) => {
    const { currentTheme } = useTheme()
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`px-2 py-1 rounded text-sm font-medium transition-all ${isActive
                    ? `bg-${currentTheme.accent} text-white`
                    : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.border}/70`
                }`}
        >
            {children}
        </button>
    )
}

// Tiptap Editor Component
const TiptapEditor = ({ content, onChange }) => {
    const { currentTheme } = useTheme()

    const editor = useEditor({
        extensions: [StarterKit],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 ${currentTheme.mode === 'dark' ? 'prose-invert' : ''}`
            }
        }
    })

    // Update editor content when prop changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content)
        }
    }, [content, editor])

    if (!editor) {
        return <div className="h-[400px] animate-pulse bg-gray-200 rounded"></div>
    }

    return (
        <div className={`border border-${currentTheme.border} rounded-lg overflow-hidden`}>
            {/* Toolbar */}
            <div className={`flex flex-wrap gap-1 p-2 border-b border-${currentTheme.border} bg-${currentTheme.border}/30`}>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold"
                >
                    <strong>B</strong>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic"
                >
                    <em>I</em>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Strikethrough"
                >
                    <s>S</s>
                </ToolbarButton>

                <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                    title="Heading 1"
                >
                    H1
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Heading 2"
                >
                    H2
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                    title="Heading 3"
                >
                    H3
                </ToolbarButton>

                <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Bullet List"
                >
                    • List
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Numbered List"
                >
                    1. List
                </ToolbarButton>

                <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>

                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    isActive={false}
                    title="Undo"
                >
                    ↩
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    isActive={false}
                    title="Redo"
                >
                    ↪
                </ToolbarButton>
            </div>

            {/* Editor Content */}
            <div className={`bg-${currentTheme.mode === 'dark' ? 'slate-800' : 'white'}`}>
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}

export default function AdminLegalPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [documents, setDocuments] = useState([])
    const [selectedDoc, setSelectedDoc] = useState(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [previewMode, setPreviewMode] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        is_active: true
    })

    useEffect(() => {
        checkAuthorization()
    }, [])

    const checkAuthorization = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('is_admin, role')
                .eq('id', user.id)
                .single()

            // Only allow admin or super_admin
            const hasAccess = userData?.is_admin ||
                userData?.role === 'admin' || userData?.role === 'super_admin'

            if (!hasAccess) { router.push('/dashboard'); return }

            setIsAuthorized(true)
            await loadDocuments()
        } catch (error) {
            console.error('Error:', error)
            router.push('/auth/login')
        } finally {
            setLoading(false)
        }
    }

    const loadDocuments = async () => {
        try {
            const { data, error } = await supabase
                .from('legal_documents')
                .select('*')
                .order('title', { ascending: true })

            if (error) throw error
            setDocuments(data || [])

            // Auto-select first document if available
            if (data && data.length > 0) {
                selectDocument(data[0])
            }
        } catch (error) {
            console.error('Error loading documents:', error)
            setMessage({ type: 'error', text: 'Failed to load documents' })
        }
    }

    const selectDocument = (doc) => {
        setSelectedDoc(doc)
        setFormData({
            title: doc.title,
            content: doc.content,
            is_active: doc.is_active
        })
        setPreviewMode(false)
        setMessage(null)
    }

    const handleSave = async () => {
        if (!selectedDoc) return

        setSaving(true)
        setMessage(null)

        try {
            const { error } = await supabase
                .from('legal_documents')
                .update({
                    title: formData.title,
                    content: formData.content,
                    is_active: formData.is_active,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedDoc.id)

            if (error) throw error

            setMessage({ type: 'success', text: 'Document saved successfully!' })
            await loadDocuments()

            // Re-select the document to refresh data
            const { data: updatedDoc } = await supabase
                .from('legal_documents')
                .select('*')
                .eq('id', selectedDoc.id)
                .single()

            if (updatedDoc) {
                setSelectedDoc(updatedDoc)
            }
        } catch (error) {
            console.error('Error saving:', error)
            setMessage({ type: 'error', text: 'Failed to save document' })
        } finally {
            setSaving(false)
        }
    }

    const handleCreateNew = async () => {
        const docKey = prompt('Enter a unique document key (e.g., privacy_policy):')
        if (!docKey) return

        const title = prompt('Enter document title:')
        if (!title) return

        try {
            const { data, error } = await supabase
                .from('legal_documents')
                .insert({
                    document_key: docKey.toLowerCase().replace(/\s+/g, '_'),
                    title: title,
                    content: '<p>Enter your content here...</p>',
                    is_active: true
                })
                .select()
                .single()

            if (error) throw error

            setMessage({ type: 'success', text: 'Document created!' })
            await loadDocuments()
            if (data) selectDocument(data)
        } catch (error) {
            console.error('Error creating document:', error)
            setMessage({ type: 'error', text: error.message || 'Failed to create document' })
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className={`h-8 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    if (!isAuthorized) {
        return null
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className={`text-2xl font-bold text-${currentTheme.text}`}>Legal Documents</h1>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>Manage terms of service and legal content</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className={`px-4 py-2 bg-${currentTheme.accent} text-white rounded-lg hover:opacity-90 transition-all text-sm font-medium`}
                >
                    + New Document
                </button>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="flex gap-6">
                {/* Document List */}
                <div className={`w-1/4 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    <h3 className={`text-sm font-semibold text-${currentTheme.text} mb-3`}>Documents</h3>
                    <div className="space-y-2">
                        {documents.map(doc => (
                            <div
                                key={doc.id}
                                onClick={() => selectDocument(doc)}
                                className={`p-3 rounded-lg cursor-pointer transition-all ${selectedDoc?.id === doc.id
                                        ? `bg-${currentTheme.accent}/20 border border-${currentTheme.accent}/50`
                                        : `bg-${currentTheme.border}/30 hover:bg-${currentTheme.border}/50`
                                    }`}
                            >
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>{doc.title}</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>{doc.document_key}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${doc.is_active
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {doc.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {documents.length === 0 && (
                            <p className={`text-${currentTheme.textMuted} text-sm`}>No documents found</p>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className={`flex-1 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    {selectedDoc ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className={`text-lg font-semibold text-${currentTheme.text}`}>
                                        {previewMode ? 'Preview' : 'Edit Document'}
                                    </h3>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>
                                        Last updated: {formatDate(selectedDoc.updated_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPreviewMode(!previewMode)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium ${previewMode
                                                ? `bg-${currentTheme.accent} text-white`
                                                : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        {previewMode ? 'Edit' : 'Preview'}
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className={`px-4 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 disabled:opacity-50`}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>

                            {previewMode ? (
                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-6 max-h-[600px] overflow-y-auto`}>
                                    <h2 className={`text-xl font-bold text-${currentTheme.text} mb-4`}>{formData.title}</h2>
                                    <div
                                        className={`text-${currentTheme.text} text-sm leading-relaxed prose prose-sm max-w-none ${currentTheme.mode === 'dark' ? 'prose-invert' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: formData.content }}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                            Document Title
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className={`w-full bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg px-4 py-2 text-${currentTheme.text} focus:outline-none focus:border-${currentTheme.accent}`}
                                        />
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                            Content
                                        </label>
                                        <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>
                                            Tip: You can copy and paste from Google Docs and formatting will be preserved!
                                        </p>
                                        <TiptapEditor
                                            content={formData.content}
                                            onChange={(content) => setFormData({ ...formData, content })}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 mt-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className={`text-sm text-${currentTheme.text}`}>Document is active</span>
                                        </label>
                                    </div>

                                    <div className={`p-3 bg-${currentTheme.border}/30 rounded-lg mt-4`}>
                                        <p className={`text-xs text-${currentTheme.textMuted}`}>
                                            <strong>Document Key:</strong> {selectedDoc.document_key}
                                        </p>
                                        <p className={`text-xs text-${currentTheme.textMuted} mt-1`}>
                                            This key is used to reference this document in the purchase flow.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={`flex items-center justify-center h-64 text-${currentTheme.textMuted}`}>
                            Select a document to edit
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
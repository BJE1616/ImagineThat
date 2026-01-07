'use client'

import { useState, useEffect } from 'react'
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
const TiptapEditor = ({ content, onChange, readOnly = false }) => {
    const { currentTheme } = useTheme()

    const editor = useEditor({
        extensions: [StarterKit],
        content: content,
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            if (!readOnly) {
                onChange(editor.getHTML())
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 ${currentTheme.mode === 'dark' ? 'prose-invert' : ''}`
            }
        }
    })

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content)
        }
    }, [content, editor])

    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly)
        }
    }, [readOnly, editor])

    if (!editor) {
        return <div className="h-[400px] animate-pulse bg-gray-200 rounded"></div>
    }

    return (
        <div className={`border border-${currentTheme.border} rounded-lg overflow-hidden ${readOnly ? 'opacity-75' : ''}`}>
            {/* Toolbar - hidden in read-only mode */}
            {!readOnly && (
                <div className={`flex flex-wrap gap-1 p-2 border-b border-${currentTheme.border} bg-${currentTheme.border}/30`}>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
                        <strong>B</strong>
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
                        <em>I</em>
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
                        <s>S</s>
                    </ToolbarButton>
                    <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
                        H1
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
                        H2
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
                        H3
                    </ToolbarButton>
                    <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
                        • List
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
                        1. List
                    </ToolbarButton>
                    <div className={`w-px h-6 bg-${currentTheme.border} mx-1`}></div>
                    <ToolbarButton onClick={() => editor.chain().focus().undo().run()} isActive={false} title="Undo">
                        ↩
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().redo().run()} isActive={false} title="Redo">
                        ↪
                    </ToolbarButton>
                </div>
            )}
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
    const [documentGroups, setDocumentGroups] = useState({})
    const [selectedDocKey, setSelectedDocKey] = useState(null)
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [showHistory, setShowHistory] = useState(false)
    const [viewingOldVersion, setViewingOldVersion] = useState(false)

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

            const hasAccess = userData?.is_admin || userData?.role === 'admin' || userData?.role === 'super_admin'
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
                .order('document_key', { ascending: true })
                .order('version', { ascending: false })

            if (error) throw error

            // Group by document_key
            const groups = {}
            data?.forEach(doc => {
                if (!groups[doc.document_key]) {
                    groups[doc.document_key] = []
                }
                groups[doc.document_key].push(doc)
            })

            setDocumentGroups(groups)

            // Auto-select first document if available
            const keys = Object.keys(groups)
            if (keys.length > 0 && !selectedDocKey) {
                selectDocument(keys[0])
            }
        } catch (error) {
            console.error('Error loading documents:', error)
            setMessage({ type: 'error', text: 'Failed to load documents' })
        }
    }

    const selectDocument = (docKey) => {
        const versions = documentGroups[docKey]
        if (!versions || versions.length === 0) return

        const latestVersion = versions[0] // Already sorted desc
        setSelectedDocKey(docKey)
        setSelectedVersion(latestVersion)
        setViewingOldVersion(false)
        setShowHistory(false)
        setFormData({
            title: latestVersion.title,
            content: latestVersion.content,
            is_active: latestVersion.is_active
        })
        setMessage(null)
    }

    const viewVersion = (doc) => {
        setSelectedVersion(doc)
        setFormData({
            title: doc.title,
            content: doc.content,
            is_active: doc.is_active
        })
        const latestVersion = documentGroups[selectedDocKey]?.[0]
        setViewingOldVersion(doc.id !== latestVersion?.id)
        setShowHistory(false)
    }

    const restoreVersion = async (doc) => {
        if (!confirm(`Restore version ${doc.version} as the new current version?`)) return

        // Create new version with old content
        await saveAsNewVersion(doc.title, doc.content)
    }

    const saveAsNewVersion = async (title, content) => {
        if (!selectedDocKey) return

        setSaving(true)
        setMessage(null)

        try {
            const versions = documentGroups[selectedDocKey]
            const newVersionNum = versions.length > 0 ? versions[0].version + 1 : 1

            // Deactivate all old versions
            await supabase
                .from('legal_documents')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('document_key', selectedDocKey)

            // Create new version
            const { data: newDoc, error } = await supabase
                .from('legal_documents')
                .insert({
                    document_key: selectedDocKey,
                    title: title,
                    content: content,
                    version: newVersionNum,
                    is_active: true
                })
                .select()
                .single()

            if (error) throw error

            setMessage({ type: 'success', text: `Saved as version ${newVersionNum}!` })
            await loadDocuments()

            // Refresh selection
            setTimeout(() => {
                setSelectedVersion(newDoc)
                setViewingOldVersion(false)
            }, 100)
        } catch (error) {
            console.error('Error saving:', error)
            setMessage({ type: 'error', text: 'Failed to save document' })
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        saveAsNewVersion(formData.title, formData.content)
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
                    version: 1,
                    is_active: true
                })
                .select()
                .single()

            if (error) throw error

            setMessage({ type: 'success', text: 'Document created!' })
            await loadDocuments()
            if (data) {
                setSelectedDocKey(data.document_key)
                setSelectedVersion(data)
                setFormData({
                    title: data.title,
                    content: data.content,
                    is_active: data.is_active
                })
            }
        } catch (error) {
            console.error('Error creating document:', error)
            setMessage({ type: 'error', text: error.message || 'Failed to create document' })
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getCurrentVersions = () => documentGroups[selectedDocKey] || []

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

    if (!isAuthorized) return null

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
                        {Object.entries(documentGroups).map(([docKey, versions]) => {
                            const latest = versions[0]
                            return (
                                <div
                                    key={docKey}
                                    onClick={() => selectDocument(docKey)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all ${selectedDocKey === docKey
                                        ? `bg-${currentTheme.accent}/20 border border-${currentTheme.accent}/50`
                                        : `bg-${currentTheme.border}/30 hover:bg-${currentTheme.border}/50`
                                        }`}
                                >
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>{latest.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400`}>
                                            v{latest.version}
                                        </span>
                                        <span className={`text-[10px] text-${currentTheme.textMuted}`}>
                                            {versions.length} version{versions.length > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        {Object.keys(documentGroups).length === 0 && (
                            <p className={`text-${currentTheme.textMuted} text-sm`}>No documents found</p>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className={`flex-1 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                    {selectedVersion ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h3 className={`text-lg font-semibold text-${currentTheme.text}`}>
                                            {viewingOldVersion ? 'Viewing Old Version' : 'Edit Document'}
                                        </h3>
                                        <p className={`text-xs text-${currentTheme.textMuted}`}>
                                            v{selectedVersion.version} • {formatDate(selectedVersion.updated_at || selectedVersion.created_at)}
                                        </p>
                                    </div>
                                    {/* History Toggle */}
                                    <button
                                        onClick={() => setShowHistory(!showHistory)}
                                        className={`px-2 py-1 rounded text-xs font-medium ${showHistory
                                            ? `bg-${currentTheme.accent} text-white`
                                            : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                            }`}
                                    >
                                        📜 History ({getCurrentVersions().length})
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {viewingOldVersion ? (
                                        <>
                                            <button
                                                onClick={() => selectDocument(selectedDocKey)}
                                                className={`px-3 py-1.5 rounded text-sm font-medium bg-${currentTheme.border} text-${currentTheme.textMuted}`}
                                            >
                                                ← Back to Current
                                            </button>
                                            <button
                                                onClick={() => restoreVersion(selectedVersion)}
                                                className={`px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500`}
                                            >
                                                Restore This Version
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className={`px-4 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 disabled:opacity-50`}
                                        >
                                            {saving ? 'Saving...' : 'Publish New Version'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* History Dropdown */}
                            {showHistory && (
                                <div className={`mb-4 p-3 bg-${currentTheme.border}/30 rounded-lg`}>
                                    <p className={`text-xs font-medium text-${currentTheme.textMuted} mb-2`}>Version History</p>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {getCurrentVersions().map(doc => (
                                            <div
                                                key={doc.id}
                                                onClick={() => viewVersion(doc)}
                                                className={`flex items-center justify-between p-2 rounded cursor-pointer ${selectedVersion.id === doc.id
                                                    ? `bg-${currentTheme.accent}/20`
                                                    : `hover:bg-${currentTheme.border}/50`
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-medium text-${currentTheme.text}`}>
                                                        v{doc.version}
                                                    </span>
                                                    {doc.is_active && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                                            current
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] text-${currentTheme.textMuted}`}>
                                                    {formatDate(doc.updated_at || doc.created_at)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {viewingOldVersion && (
                                <div className="mb-4 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                                    <p className="text-yellow-400 text-xs">
                                        ⚠️ You are viewing an archived version. Click "Restore" to make this the current version.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                        Document Title
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        disabled={viewingOldVersion}
                                        className={`w-full bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg px-4 py-2 text-${currentTheme.text} focus:outline-none focus:border-${currentTheme.accent} ${viewingOldVersion ? 'opacity-75' : ''}`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                        Content
                                    </label>
                                    {!viewingOldVersion && (
                                        <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>
                                            Tip: Copy and paste from Google Docs - formatting will be preserved!
                                        </p>
                                    )}
                                    <TiptapEditor
                                        content={formData.content}
                                        onChange={(content) => setFormData({ ...formData, content })}
                                        readOnly={viewingOldVersion}
                                    />
                                </div>

                                <div className={`p-3 bg-${currentTheme.border}/30 rounded-lg`}>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>
                                        <strong>Document Key:</strong> {selectedDocKey}
                                    </p>
                                </div>
                            </div>
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
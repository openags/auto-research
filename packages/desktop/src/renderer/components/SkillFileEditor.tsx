/**
 * SkillFileEditor — File browser + code editor for skill folders.
 *
 * Reuses the same patterns as LatexEditor (file tree, tabs, context menu,
 * inline create/rename, CodeMirror editor) but wired to the skills API.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import CodeEditor from './CodeEditor'
import {
  ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
  Plus, FolderPlus, RefreshCw, Save,
  Trash2, Pencil, PanelLeftClose, PanelLeftOpen,
  X, File, ChevronLeft,
} from 'lucide-react'
import { api } from '../services/api'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

interface OpenTab { path: string; name: string }

interface Props {
  skillName: string
  icon: React.ReactNode
  label: string
  onBack: () => void
}

type InlineInput = {
  kind: 'create-file' | 'create-folder' | 'rename'
  parentPath: string
  oldPath?: string
  value: string
} | null

type DeleteConfirm = { path: string } | null

export default function SkillFileEditor({ skillName, icon, label, onBack }: Props): React.ReactElement {
  // File tree
  const [tree, setTree] = useState<FileEntry[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false)

  // Tabs & editor
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})

  // Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [error, setError] = useState<string | null>(null)

  // Context menu & inline input
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null)
  const [inlineInput, setInlineInput] = useState<InlineInput>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // ── Effects ──────────────────────────────────────

  useEffect(() => {
    if (inlineInput && inlineInputRef.current) {
      inlineInputRef.current.focus()
      if (inlineInput.kind === 'rename') {
        const dotIdx = inlineInput.value.lastIndexOf('.')
        inlineInputRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : inlineInput.value.length)
      } else {
        inlineInputRef.current.select()
      }
    }
  }, [inlineInput])

  useEffect(() => {
    if (error) {
      const timer = window.setTimeout(() => setError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // ── Data loading ─────────────────────────────────

  const loadTree = useCallback(async () => {
    try {
      const data = await api.get<FileEntry[]>(`/api/skills/${skillName}/files`)
      setTree(data)
    } catch { setTree([]) }
  }, [skillName])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  // Auto-open SKILL.md on mount
  useEffect(() => {
    if (tree.length > 0 && openTabs.length === 0) {
      const skillMd = tree.find(e => e.name === 'SKILL.md')
      if (skillMd) void openFile(skillMd.path, skillMd.name)
    }
  }, [tree])

  // ── File operations ──────────────────────────────

  const openFile = async (filePath: string, name: string) => {
    if (!openTabs.find(t => t.path === filePath)) setOpenTabs(prev => [...prev, { path: filePath, name }])
    setActiveTab(filePath)
    if (!(filePath in contents)) {
      try {
        const fc = await api.get<{ content: string }>(`/api/skills/${skillName}/file?path=${encodeURIComponent(filePath)}`)
        setContents(prev => ({ ...prev, [filePath]: fc.content }))
      } catch { setContents(prev => ({ ...prev, [filePath]: '' })) }
    }
  }

  const closeTab = (path: string) => {
    setOpenTabs(prev => prev.filter(t => t.path !== path))
    setDirty(prev => { const n = { ...prev }; delete n[path]; return n })
    setContents(prev => { const n = { ...prev }; delete n[path]; return n })
    if (activeTab === path) {
      const remaining = openTabs.filter(t => t.path !== path)
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].path : null)
    }
  }

  const saveFile = async (filePath: string) => {
    const content = contents[filePath]
    if (content === undefined) return
    setSaveStatus('saving')
    try {
      await api.put(`/api/skills/${skillName}/file`, { path: filePath, content })
      setDirty(prev => ({ ...prev, [filePath]: false }))
      setSaveStatus('saved')
    } catch { setError('Save failed'); setSaveStatus('unsaved') }
  }

  // ── Inline create/rename/delete ──────────────────

  const commitCreate = async () => {
    if (!inlineInput || (inlineInput.kind !== 'create-file' && inlineInput.kind !== 'create-folder')) return
    const name = inlineInput.value.trim()
    if (!name) { setInlineInput(null); return }
    const isDir = inlineInput.kind === 'create-folder'
    const filePath = inlineInput.parentPath ? `${inlineInput.parentPath}/${name}` : name
    try {
      await api.post(`/api/skills/${skillName}/file`, { path: filePath, is_dir: isDir })
      await loadTree()
      if (!isDir) void openFile(filePath, name)
    } catch { setError('Create failed') }
    setInlineInput(null); setContextMenu(null)
  }

  const startCreate = (parentPath: string, isDir: boolean) => {
    setInlineInput({ kind: isDir ? 'create-folder' : 'create-file', parentPath, value: isDir ? '' : 'new-file.md' })
    if (parentPath) setExpandedDirs(prev => new Set(prev).add(parentPath))
    setContextMenu(null)
  }

  const commitDelete = async () => {
    if (!deleteConfirm) return
    try {
      await api.delete(`/api/skills/${skillName}/file?path=${encodeURIComponent(deleteConfirm.path)}`)
      closeTab(deleteConfirm.path); await loadTree()
    } catch { setError('Delete failed') }
    setDeleteConfirm(null); setContextMenu(null)
  }

  const startRename = (filePath: string) => {
    const name = filePath.split('/').pop() || ''
    setInlineInput({ kind: 'rename', parentPath: '', oldPath: filePath, value: name })
    setContextMenu(null)
  }

  const commitRename = async () => {
    if (!inlineInput || inlineInput.kind !== 'rename' || !inlineInput.oldPath) return
    const newName = inlineInput.value.trim()
    if (!newName) { setInlineInput(null); return }
    const oldPath = inlineInput.oldPath
    const parts = oldPath.split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')
    try {
      await api.post(`/api/skills/${skillName}/rename`, { old_path: oldPath, new_path: newPath })
      closeTab(oldPath)
      await loadTree()
    } catch { setError('Rename failed') }
    setInlineInput(null)
  }

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  // ── Active content ───────────────────────────────

  const activeContent = activeTab ? contents[activeTab] || '' : ''

  // ── Render helpers ───────────────────────────────

  const renderInlineInput = (parentPath: string) => {
    if (!inlineInput || inlineInput.kind === 'rename' || inlineInput.parentPath !== parentPath) return null
    const isFolder = inlineInput.kind === 'create-folder'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', marginBottom: 2 }}>
        {isFolder ? <Folder size={13} color="#f59e0b" /> : <FileText size={13} color="var(--accent)" />}
        <input ref={inlineInputRef} value={inlineInput.value}
          onChange={(e) => setInlineInput({ ...inlineInput, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') void commitCreate(); if (e.key === 'Escape') setInlineInput(null) }}
          onBlur={() => void commitCreate()}
          placeholder={isFolder ? 'Folder name' : 'File name'}
          style={{ flex: 1, border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', fontSize: 11, outline: 'none', background: 'var(--bg-card)', color: 'var(--text)' }} />
      </div>
    )
  }

  const renderTreeNode = (entry: FileEntry): React.ReactNode => {
    const isExpanded = expandedDirs.has(entry.path)
    const isActive = !entry.is_dir && activeTab === entry.path
    const isRenaming = inlineInput?.kind === 'rename' && inlineInput.oldPath === entry.path

    if (isRenaming) {
      return (
        <div key={entry.path} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', marginBottom: 2 }}>
          {entry.is_dir ? <Folder size={13} color="#f59e0b" /> : <FileText size={13} color="var(--accent)" />}
          <input ref={inlineInputRef} value={inlineInput!.value}
            onChange={(e) => setInlineInput({ ...inlineInput!, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void commitRename(); if (e.key === 'Escape') setInlineInput(null) }}
            onBlur={() => void commitRename()}
            style={{ flex: 1, border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', fontSize: 11, outline: 'none', background: 'var(--bg-card)', color: 'var(--text)' }} />
        </div>
      )
    }

    const fileColor = entry.name === 'SKILL.md' ? 'var(--accent)'
      : entry.name.endsWith('.md') ? '#22c55e'
        : entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') ? '#f59e0b'
          : 'var(--text-tertiary)'

    return (
      <div key={entry.path}>
        <div
          onClick={() => entry.is_dir ? toggleDir(entry.path) : openFile(entry.path, entry.name)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDir: entry.is_dir }) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
            cursor: 'pointer', borderRadius: 6, fontSize: 12, marginBottom: 1,
            background: isActive ? 'var(--accent-medium, rgba(79,110,247,0.08))' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: isActive ? 600 : 400,
            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.03))' }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
        >
          {entry.is_dir ? (
            <>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {isExpanded ? <FolderOpen size={13} color="#f59e0b" /> : <Folder size={13} color="#f59e0b" />}
            </>
          ) : (
            <>
              <span style={{ width: 12 }} />
              <File size={13} color={fileColor} />
            </>
          )}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
        </div>
        {entry.is_dir && isExpanded && (
          <div style={{ paddingLeft: 12 }}>
            {renderInlineInput(entry.path)}
            {entry.children.map(renderTreeNode)}
          </div>
        )}
      </div>
    )
  }

  // ── Keyboard shortcuts ───────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (activeTab) void saveFile(activeTab)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Render ───────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}
      onClick={() => { setContextMenu(null) }}>

      {/* ── Toolbar ─────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button onClick={() => {
          if (activeTab && dirty[activeTab]) void saveFile(activeTab)
          onBack()
        }}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)', fontSize: 11 }}>
          <ChevronLeft size={13} /> Back
        </button>

        {/* File tree toggle */}
        <button onClick={() => setFileTreeCollapsed(!fileTreeCollapsed)}
          style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
          title={fileTreeCollapsed ? 'Show file tree' : 'Hide file tree'}>
          {fileTreeCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        {/* Skill name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 4 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{skillName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'auto', minWidth: 0 }}>
          {openTabs.map(tab => (
            <div key={tab.path} onClick={() => setActiveTab(tab.path)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                background: activeTab === tab.path ? 'rgba(79,110,247,0.08)' : 'transparent',
                color: activeTab === tab.path ? 'var(--accent)' : 'var(--text-tertiary)',
                fontWeight: activeTab === tab.path ? 600 : 400,
                border: activeTab === tab.path ? '1px solid rgba(79,110,247,0.15)' : '1px solid transparent',
              }}>
              {dirty[tab.path] && <span style={{ color: '#f59e0b', fontSize: 8 }}>●</span>}
              {tab.name}
              <span onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
                style={{ fontSize: 10, opacity: 0.5, cursor: 'pointer', marginLeft: 2, lineHeight: 1 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}>
                ✕
              </span>
            </div>
          ))}
        </div>

        {/* Save button + status */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => activeTab && void saveFile(activeTab)} disabled={!activeTab}
            style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text)' }}>
            <Save size={12} /> Save
          </button>
          <span style={{ fontSize: 10, padding: '2px 6px', color: saveStatus === 'saved' ? '#16a34a' : saveStatus === 'saving' ? '#f59e0b' : '#8b95a5' }}>
            {saveStatus === 'saved' ? '● Saved' : saveStatus === 'saving' ? '● Saving...' : '○ Unsaved'}
          </span>
        </div>
      </div>

      {/* ── Main 2-panel area ───────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* File Tree Panel */}
        {!fileTreeCollapsed && (
          <div style={{ width: 220, minWidth: 140, maxWidth: 300, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', background: 'var(--bg-sidebar, var(--bg-card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 6px', gap: 4, borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>Files</span>
              <button onClick={() => startCreate('', false)} title="New file"
                style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}>
                <Plus size={14} />
              </button>
              <button onClick={() => startCreate('', true)} title="New folder"
                style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}>
                <FolderPlus size={14} />
              </button>
              <button onClick={() => void loadTree()} title="Refresh"
                style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: 4 }}>
                <RefreshCw size={13} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path: '', isDir: true }) }}>
              {renderInlineInput('')}
              {tree.map(renderTreeNode)}
            </div>
          </div>
        )}

        {/* Editor Panel */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeTab ? (
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <CodeEditor
                value={activeContent}
                onChange={(val) => {
                  if (activeTab) {
                    setContents(prev => ({ ...prev, [activeTab]: val }))
                    setDirty(prev => ({ ...prev, [activeTab]: true }))
                    setSaveStatus('unsaved')
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 8 }}>
              <FileText size={32} strokeWidth={1.2} />
              <div style={{ fontSize: 13 }}>Select a file from the tree to start editing</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ctrl+S to save</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ──────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '3px 12px',
        borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)',
        fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0,
      }}>
        <span>{label}</span>
        {activeTab && <span>{activeTab}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ color: saveStatus === 'saved' ? '#16a34a' : saveStatus === 'saving' ? '#f59e0b' : '#8b95a5' }}>
          {saveStatus === 'saved' ? '● Synced' : saveStatus === 'saving' ? '● Saving...' : '○ Unsaved changes'}
        </span>
      </div>

      {/* ── Error toast ─────────────────────────── */}
      {error && (
        <div style={{
          position: 'fixed', bottom: 40, right: 20, padding: '8px 16px',
          background: '#dc2626', color: '#fff', borderRadius: 8, fontSize: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999,
        }}>
          {error}
        </div>
      )}

      {/* ── Context menu ────────────────────────── */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1001, minWidth: 150, padding: 4,
        }}
          onClick={(e) => e.stopPropagation()}>
          {contextMenu.isDir && (
            <>
              <div style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => startCreate(contextMenu.path, false)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <Plus size={12} /> New File
              </div>
              <div style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => startCreate(contextMenu.path, true)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <FolderPlus size={12} /> New Folder
              </div>
            </>
          )}
          {contextMenu.path && (
            <>
              <div style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => startRename(contextMenu.path)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <Pencil size={12} /> Rename
              </div>
              <div style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}
                onClick={() => { setDeleteConfirm({ path: contextMenu.path }); setContextMenu(null) }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <Trash2 size={12} /> Delete
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Delete confirmation ─────────────────── */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1002,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Delete file?</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Are you sure you want to delete <strong>{deleteConfirm.path}</strong>?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
              <button onClick={() => void commitDelete()}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

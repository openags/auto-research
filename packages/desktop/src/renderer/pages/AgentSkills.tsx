import React, { useEffect, useState, useCallback } from 'react'
import { Tag, Empty, Spin, Modal, Input, message } from 'antd'
import {
  Zap, Search, Plus, FolderUp, ChevronRight, Trash2,
} from 'lucide-react'
import { api } from '../services/api'
import SkillFileEditor from '../components/SkillFileEditor'

interface SkillInfo {
  name: string
  description: string
  type: string
  version: string
  roles: string[]
  triggers: string[]
  source_path?: string
}

export default function AgentSkills(): React.ReactElement {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [filtered, setFiltered] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Editor
  const [editingSkill, setEditingSkill] = useState<string | null>(null)

  const fetchSkills = useCallback(() => {
    setLoading(true)
    api.get<SkillInfo[]>('/api/skills/')
      .then(data => {
        const agentSkills = data.filter(s => s.type !== 'robot')
        setSkills(agentSkills)
        setFiltered(agentSkills)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (!value) { setFiltered(skills); return }
    const lower = value.toLowerCase()
    setFiltered(skills.filter(s =>
      s.name.includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.triggers.some(t => t.toLowerCase().includes(lower)),
    ))
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/api/skills', {
        name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: 'agent',
        description: newDesc || 'A new agent skill',
      })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      fetchSkills()
      message.success('Agent skill created')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create skill')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    Modal.confirm({
      title: `Delete "${name}"?`,
      content: 'This will permanently delete the skill folder and all its files.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.delete(`/api/skills/${name}`)
        if (editingSkill === name) setEditingSkill(null)
        fetchSkills()
      },
    })
  }

  // ── Editor view ────────────────────────────
  if (editingSkill) {
    return (
      <SkillFileEditor
        skillName={editingSkill}
        icon={<Zap size={15} color="var(--accent)" />}
        label="Agent Skill"
        onBack={() => { setEditingSkill(null); fetchSkills() }}
      />
    )
  }

  // ── Card grid view ─────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="var(--accent)" strokeWidth={2} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Agent Skills</h2>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Digital skills for AI research agents
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            borderRadius: 7, background: 'var(--bg-input)', border: '1px solid var(--border)', width: 200,
          }}>
            <Search size={13} color="var(--text-tertiary)" />
            <input value={searchValue} onChange={e => handleSearch(e.target.value)}
              placeholder="Search..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: 'var(--text)' }} />
          </div>
          <button type="button" onClick={() => message.info('Select a skill folder or .zip file to import (coming soon)')}
            style={{ ...btnStyle, gap: 5 }}>
            <FolderUp size={14} /> Import
          </button>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ ...btnStyle, background: 'var(--accent)', color: '#fff', border: 'none', gap: 5 }}>
            <Plus size={14} /> New Skill
          </button>
        </div>
      </div>

      {/* Skill cards */}
      {filtered.length === 0 && !searchValue ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)', padding: '48px 24px',
          textAlign: 'center', color: 'var(--text-tertiary)',
        }}>
          <Zap size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No agent skills yet</div>
          <div style={{ fontSize: 12, maxWidth: 360, margin: '0 auto 16px' }}>
            Agent skills define reusable behaviors, instructions, and tool configurations for AI research agents.
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ ...btnStyle, background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 20px', gap: 5 }}>
            <Plus size={14} /> Create First Skill
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="No matching skills" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {filtered.map(skill => {
            const hovered = hoveredSkill === skill.name
            return (
              <div key={skill.name}
                onMouseEnter={() => setHoveredSkill(skill.name)}
                onMouseLeave={() => setHoveredSkill(null)}
                onClick={() => setEditingSkill(skill.name)}
                style={{
                  padding: '16px 18px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: hovered ? 'var(--bg-sidebar)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  transform: hovered ? 'translateY(-1px)' : 'none',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={14} color="var(--accent)" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{skill.name}</span>
                  </div>
                  <div onClick={e => handleDelete(skill.name, e)}
                    style={{ padding: 4, borderRadius: 4, cursor: 'pointer', color: 'var(--text-tertiary)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
                    title="Delete">
                    <Trash2 size={13} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8, minHeight: 36 }}>
                  {skill.description}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skill.roles.map(r => (
                    <Tag key={r} color="blue" style={{ margin: 0, fontSize: 10 }}>{r}</Tag>
                  ))}
                  {skill.triggers.filter(t => t !== 'always').map(t => (
                    <Tag key={t} color="green" style={{ margin: 0, fontSize: 10 }}>{t}</Tag>
                  ))}
                  <Tag color="default" style={{ margin: 0, fontSize: 10 }}>v{skill.version}</Tag>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Click to edit <ChevronRight size={12} />
                </div>
              </div>
            )
          })}

          {/* Add card */}
          <div onClick={() => setShowCreate(true)}
            style={{
              padding: '16px 18px', borderRadius: 'var(--radius)',
              border: '2px dashed var(--border)', background: 'transparent',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', minHeight: 140,
              color: 'var(--text-tertiary)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}>
            <Plus size={24} style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>New Agent Skill</span>
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal
        title="New Agent Skill"
        open={showCreate}
        onOk={handleCreate}
        onCancel={() => setShowCreate(false)}
        confirmLoading={creating}
        okText="Create"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
          <div>
            <label style={labelStyle}>Skill Name</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. search-papers, verify-citations, summarize-findings" />
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Lowercase, use dashes. This becomes the folder name.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <Input.TextArea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="e.g. Searches academic databases for relevant papers given a research query"
              rows={2} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  borderRadius: 7, padding: '6px 14px', fontSize: 12,
  cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
  display: 'block', marginBottom: 4,
}

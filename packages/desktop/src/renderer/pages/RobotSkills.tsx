import React, { useEffect, useState, useCallback } from 'react'
import { Tag, Spin, Modal, Input, Select, message } from 'antd'
import {
  Cpu, Plus, FolderUp, ChevronRight, Trash2,
  Wifi, Usb, Radio, Cable, Network, Server,
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
  frontmatter?: Record<string, unknown>
}

const PROTOCOLS = [
  { value: 'rest', label: 'REST API', icon: Wifi, desc: 'HTTP/HTTPS endpoints for modern lab devices' },
  { value: 'grpc', label: 'gRPC', icon: Server, desc: 'High-performance RPC for complex instruments' },
  { value: 'mqtt', label: 'MQTT', icon: Radio, desc: 'Pub/sub messaging for IoT sensors and devices' },
  { value: 'opcua', label: 'OPC-UA', icon: Network, desc: 'Industrial automation standard protocol' },
  { value: 'ros2', label: 'ROS 2', icon: Network, desc: 'Robot Operating System for robotics platforms' },
  { value: 'sila2', label: 'SiLA 2', icon: Server, desc: 'Standardisation in Lab Automation protocol' },
  { value: 'can', label: 'CAN Bus', icon: Cable, desc: 'Controller Area Network for embedded devices' },
  { value: 'modbus', label: 'Modbus TCP/RTU', icon: Network, desc: 'Industrial serial communication protocol' },
  { value: 'serial', label: 'RS-232 / RS-485', icon: Cable, desc: 'Serial port for legacy instruments' },
  { value: 'usb', label: 'USB / VISA', icon: Usb, desc: 'USB-connected instruments (SCPI/VISA)' },
  { value: 'ethernet_ip', label: 'EtherNet/IP', icon: Network, desc: 'Industrial Ethernet for PLCs and drives' },
  { value: 'profinet', label: 'PROFINET', icon: Network, desc: 'Siemens industrial Ethernet standard' },
  { value: 'custom', label: 'Custom', icon: Cable, desc: 'Custom or proprietary protocol' },
]

export default function RobotSkills(): React.ReactElement {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newProtocol, setNewProtocol] = useState('rest')
  const [creating, setCreating] = useState(false)

  // Editor
  const [editingSkill, setEditingSkill] = useState<string | null>(null)

  const fetchSkills = useCallback(() => {
    setLoading(true)
    api.get<SkillInfo[]>('/api/skills/')
      .then(data => setSkills(data.filter(s => s.type === 'robot')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/api/skills', {
        name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: 'robot',
        description: newDesc || `Robot skill for hardware control`,
        protocol: newProtocol,
      })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      setNewProtocol('rest')
      fetchSkills()
      message.success('Robot skill created')
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
        icon={<Cpu size={15} color="#0891b2" />}
        label="Robot Skill"
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
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#0891b210', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={18} color="#0891b2" strokeWidth={2} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Robot Skills</h2>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Connect physical lab hardware to AI agents</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => message.info('Select a skill folder or .zip file to import (coming soon)')}
            style={{ ...btnStyle, gap: 5 }}>
            <FolderUp size={14} /> Import
          </button>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ ...btnStyle, background: '#0891b2', color: '#fff', border: 'none', gap: 5 }}>
            <Plus size={14} /> New Robot Skill
          </button>
        </div>
      </div>

      {/* Protocol guidance */}
      <div style={{
        background: 'linear-gradient(135deg, #0891b208, #06b6d408)',
        border: '1px solid #0891b220', borderRadius: 'var(--radius)',
        padding: '16px 20px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Getting Started with Robot Skills
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          A Robot Skill is a folder containing documentation that tells AI agents how to control a specific piece of lab hardware.
          Before creating a skill, make sure you have:
        </div>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 12px', paddingLeft: 18 }}>
          <li><strong>Communication protocol</strong> identified (see example protocols below)</li>
          <li><strong>Command reference</strong> — all available commands, parameters, and expected responses</li>
          <li><strong>Connection details</strong> — IP address / port / baud rate / endpoint URL</li>
          <li><strong>Safety constraints</strong> — emergency stop, axis limits, speed limits, interlocks</li>
        </ul>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Example Protocols
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROTOCOLS.map(p => {
            const Icon = p.icon
            return (
              <div key={p.value} title={p.desc} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'default',
              }}>
                <Icon size={10} /> {p.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Skill cards */}
      {skills.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)', padding: '48px 24px',
          textAlign: 'center', color: 'var(--text-tertiary)',
        }}>
          <Cpu size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No robot skills yet</div>
          <div style={{ fontSize: 12, maxWidth: 360, margin: '0 auto 16px' }}>
            Create a robot skill to document how AI agents should communicate with your lab hardware.
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ ...btnStyle, background: '#0891b2', color: '#fff', border: 'none', padding: '8px 20px', gap: 5 }}>
            <Plus size={14} /> Create First Robot Skill
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {skills.map(skill => {
            const hovered = hoveredSkill === skill.name
            const protocol = skill.frontmatter?.protocol as string
            const protoInfo = PROTOCOLS.find(p => p.value === protocol)
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
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0891b212', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={14} color="#0891b2" />
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
                  {protoInfo && <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>{protoInfo.label}</Tag>}
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
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0891b2'; e.currentTarget.style.color = '#0891b2' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}>
            <Plus size={24} style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>New Robot Skill</span>
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal
        title="New Robot Skill"
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
              placeholder="e.g. ur5e-arm, plate-reader, hplc-agilent" />
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Lowercase, use dashes. This becomes the folder name.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <Input.TextArea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="e.g. Universal Robots UR5e collaborative robot arm controller"
              rows={2} />
          </div>
          <div>
            <label style={labelStyle}>Communication Protocol</label>
            <Select value={newProtocol} onChange={setNewProtocol} style={{ width: '100%' }}
              options={PROTOCOLS.map(p => ({ value: p.value, label: `${p.label} — ${p.desc}` }))} />
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

/**
 * Skills Routes — SOUL.md / SKILL.md management + file operations
 */

import { Router, Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val
}

interface SkillInfo {
  name: string
  path: string
  description?: string
  type?: string
  version?: string
  roles?: string[]
  triggers?: string[]
  source_path?: string
  frontmatter?: Record<string, unknown>
}

interface SoulInfo {
  name: string
  path: string
  role?: string
  frontmatter?: Record<string, unknown>
}

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

export function createSkillsRoutes(skillsDir?: string): Router {
  const router = Router()
  const defaultSkillsDir = skillsDir || path.join(process.cwd(), 'skills')

  // List all skills
  router.get('/skills', (_req: Request, res: Response) => {
    try {
      const skills = discoverSkills(defaultSkillsDir)
      res.json(skills)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  // Get single skill
  router.get('/skills/:name', (req: Request, res: Response) => {
    try {
      const skills = discoverSkills(defaultSkillsDir)
      const skill = skills.find(s => s.name === param(req.params.name))
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' })
        return
      }

      const content = fs.readFileSync(skill.path, 'utf-8')
      res.json({ ...skill, content })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  // Create a new skill (scaffold folder + SKILL.md)
  router.post('/skills', (req: Request, res: Response) => {
    try {
      const { name, type, description, protocol, endpoint } = req.body as {
        name?: string
        type?: string
        description?: string
        protocol?: string
        endpoint?: string
      }
      if (!name) { res.status(400).json({ error: 'name is required' }); return }
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
        res.status(400).json({ error: 'Name must be lowercase alphanumeric with dashes/underscores' })
        return
      }

      const skillDir = path.join(defaultSkillsDir, name)
      if (fs.existsSync(skillDir)) {
        res.status(409).json({ error: 'Skill already exists' })
        return
      }

      fs.mkdirSync(skillDir, { recursive: true })

      const skillType = type || 'agent'
      const frontmatter: Record<string, unknown> = {
        name,
        description: description || `A new ${skillType} skill`,
        type: skillType,
        roles: [],
        tools: [],
        triggers: [],
        version: '1.0.0',
      }

      if (skillType === 'robot') {
        frontmatter.protocol = protocol || ''
        frontmatter.endpoint = endpoint || ''
        frontmatter.hardware = { manufacturer: '', model: '', firmware: '' }
        frontmatter.commands = []
      }

      const body = skillType === 'robot'
        ? ROBOT_SKILL_BODY
        : AGENT_SKILL_BODY

      const content = `---\n${yaml.dump(frontmatter, { lineWidth: 120 })}---\n\n${body}`
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')

      res.status(201).json({ name, path: skillDir, type: skillType })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Create failed' })
    }
  })

  // Delete a skill
  router.delete('/skills/:name', (req: Request, res: Response) => {
    try {
      const skills = discoverSkills(defaultSkillsDir)
      const skill = skills.find(s => s.name === param(req.params.name))
      if (!skill) { res.status(404).json({ error: 'Skill not found' }); return }

      const skillDir = path.dirname(skill.path)
      if (!skillDir.startsWith(defaultSkillsDir)) {
        res.status(403).json({ error: 'Cannot delete skills outside skills directory' })
        return
      }

      fs.rmSync(skillDir, { recursive: true, force: true })
      res.status(204).send()
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed' })
    }
  })

  // ── Skill file operations ──────────────────────────

  // File tree for a skill
  router.get('/skills/:name/files', (req: Request, res: Response) => {
    try {
      const skills = discoverSkills(defaultSkillsDir)
      const skill = skills.find(s => s.name === param(req.params.name))
      if (!skill) { res.status(404).json({ error: 'Skill not found' }); return }

      const skillDir = path.dirname(skill.path)
      res.json(buildSkillTree(skillDir, skillDir))
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  // Read a file within a skill
  router.get('/skills/:name/file', (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string
      if (!filePath) { res.status(400).json({ error: 'path is required' }); return }

      const skillDir = resolveSkillDir(param(req.params.name))
      if (!skillDir) { res.status(404).json({ error: 'Skill not found' }); return }

      const fullPath = path.resolve(skillDir, filePath)
      if (!fullPath.startsWith(skillDir)) { res.status(403).json({ error: 'Path traversal' }); return }
      if (!fs.existsSync(fullPath)) { res.status(404).json({ error: 'File not found' }); return }

      const content = fs.readFileSync(fullPath, 'utf-8')
      res.json({ content })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Read failed' })
    }
  })

  // Write a file within a skill
  router.put('/skills/:name/file', (req: Request, res: Response) => {
    try {
      const { path: filePath, content } = req.body as { path?: string; content?: string }
      if (!filePath || content === undefined) {
        res.status(400).json({ error: 'path and content required' }); return
      }

      const skillDir = resolveSkillDir(param(req.params.name))
      if (!skillDir) { res.status(404).json({ error: 'Skill not found' }); return }

      const fullPath = path.resolve(skillDir, filePath)
      if (!fullPath.startsWith(skillDir)) { res.status(403).json({ error: 'Path traversal' }); return }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf-8')
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Write failed' })
    }
  })

  // Create a file or directory within a skill
  router.post('/skills/:name/file', (req: Request, res: Response) => {
    try {
      const { path: filePath, is_dir } = req.body as { path?: string; is_dir?: boolean }
      if (!filePath) { res.status(400).json({ error: 'path required' }); return }

      const skillDir = resolveSkillDir(param(req.params.name))
      if (!skillDir) { res.status(404).json({ error: 'Skill not found' }); return }

      const fullPath = path.resolve(skillDir, filePath)
      if (!fullPath.startsWith(skillDir)) { res.status(403).json({ error: 'Path traversal' }); return }

      if (is_dir) {
        fs.mkdirSync(fullPath, { recursive: true })
      } else {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, '', 'utf-8')
      }
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Create failed' })
    }
  })

  // Delete a file within a skill
  router.delete('/skills/:name/file', (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string
      if (!filePath) { res.status(400).json({ error: 'path required' }); return }

      const skillDir = resolveSkillDir(param(req.params.name))
      if (!skillDir) { res.status(404).json({ error: 'Skill not found' }); return }

      const fullPath = path.resolve(skillDir, filePath)
      if (!fullPath.startsWith(skillDir)) { res.status(403).json({ error: 'Path traversal' }); return }

      fs.rmSync(fullPath, { recursive: true, force: true })
      res.status(204).send()
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed' })
    }
  })

  // Rename a file within a skill
  router.post('/skills/:name/rename', (req: Request, res: Response) => {
    try {
      const { old_path, new_path } = req.body as { old_path?: string; new_path?: string }
      if (!old_path || !new_path) { res.status(400).json({ error: 'old_path and new_path required' }); return }

      const skillDir = resolveSkillDir(param(req.params.name))
      if (!skillDir) { res.status(404).json({ error: 'Skill not found' }); return }

      const oldFull = path.resolve(skillDir, old_path)
      const newFull = path.resolve(skillDir, new_path)
      if (!oldFull.startsWith(skillDir) || !newFull.startsWith(skillDir)) {
        res.status(403).json({ error: 'Path traversal' }); return
      }

      fs.renameSync(oldFull, newFull)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Rename failed' })
    }
  })

  // ── Souls ──────────────────────────────────────────

  router.get('/souls', (_req: Request, res: Response) => {
    try {
      const souls = discoverSouls(defaultSkillsDir)
      res.json(souls)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  router.get('/souls/:name', (req: Request, res: Response) => {
    try {
      const souls = discoverSouls(defaultSkillsDir)
      const soul = souls.find(s => s.name === param(req.params.name))
      if (!soul) {
        res.status(404).json({ error: 'Soul not found' })
        return
      }

      const content = fs.readFileSync(soul.path, 'utf-8')
      res.json({ ...soul, content })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })

  // ── Helpers ────────────────────────────────────────

  function resolveSkillDir(name: string): string | null {
    const skills = discoverSkills(defaultSkillsDir)
    const skill = skills.find(s => s.name === name)
    if (!skill) return null
    return path.dirname(skill.path)
  }

  return router
}

// ── Discovery ─────────────────────────────────────────

function discoverSkills(baseDir: string): SkillInfo[] {
  const skills: SkillInfo[] = []
  if (!fs.existsSync(baseDir)) return skills

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.skill.md') || entry.name === 'SKILL.md') {
        const skill = parseSkillFile(fullPath)
        if (skill) skills.push(skill)
      }
    }
  }

  walk(baseDir)
  return skills
}

function discoverSouls(baseDir: string): SoulInfo[] {
  const souls: SoulInfo[] = []
  if (!fs.existsSync(baseDir)) return souls

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.soul.md') || entry.name === 'SOUL.md') {
        const soul = parseSoulFile(fullPath)
        if (soul) souls.push(soul)
      }
    }
  }

  walk(baseDir)
  return souls
}

// ── Parsing ───────────────────────────────────────────

function parseSkillFile(filePath: string): SkillInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(content)

    const name = frontmatter?.name as string ||
      path.basename(filePath).replace(/\.skill\.md$/, '').replace(/^SKILL$/, path.basename(path.dirname(filePath)))
    const description = frontmatter?.description as string ||
      body.split('\n\n')[0]?.slice(0, 200) || ''

    return {
      name,
      path: filePath,
      description,
      type: (frontmatter?.type as string) || 'agent',
      version: (frontmatter?.version as string) || '1.0.0',
      roles: (frontmatter?.roles as string[]) || [],
      triggers: (frontmatter?.triggers as string[]) || [],
      source_path: filePath,
      frontmatter: frontmatter ?? undefined,
    }
  } catch {
    return null
  }
}

function parseSoulFile(filePath: string): SoulInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { frontmatter } = parseFrontmatter(content)

    const name = frontmatter?.name as string ||
      path.basename(filePath).replace(/\.soul\.md$/, '').replace(/^SOUL$/, path.basename(path.dirname(filePath)))
    const role = frontmatter?.role as string || frontmatter?.description as string

    return { name, path: filePath, role, frontmatter: frontmatter ?? undefined }
  } catch {
    return null
  }
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown> | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }

  try {
    const frontmatter = yaml.load(match[1]) as Record<string, unknown>
    return { frontmatter, body: match[2] }
  } catch {
    return { frontmatter: null, body: content }
  }
}

// ── File tree ─────────────────────────────────────────

function buildSkillTree(dir: string, relativeTo: string): FileEntry[] {
  if (!fs.existsSync(dir)) return []
  const entries: FileEntry[] = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(relativeTo, fullPath)

    if (entry.isDirectory()) {
      entries.push({
        name: entry.name,
        path: relPath,
        is_dir: true,
        size: 0,
        children: buildSkillTree(fullPath, relativeTo),
      })
    } else {
      const stat = fs.statSync(fullPath)
      entries.push({
        name: entry.name,
        path: relPath,
        is_dir: false,
        size: stat.size,
        children: [],
      })
    }
  }

  entries.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

// ── Scaffold templates ────────────────────────────────

const AGENT_SKILL_BODY = `## Overview

Describe what this agent skill does and when it should be activated.

## Instructions

Step-by-step instructions for the agent when this skill is triggered.

## Examples

Provide example inputs and expected outputs.
`

const ROBOT_SKILL_BODY = `## Hardware Overview

Describe the hardware device this skill controls.

## Communication Protocol

Document the communication interface in detail:
- **Protocol**: (e.g. REST API, gRPC, MQTT, CAN bus, RS-232, RS-485, USB, Modbus, OPC-UA, SiLA 2, ROS 2, Industrial Ethernet)
- **Baud rate / port**: (for serial connections)
- **Endpoint / topic**: (for network protocols)
- **Authentication**: (if applicable)

## Command Reference

List all available commands and their parameters:

| Command | Parameters | Description | Response |
|---------|-----------|-------------|----------|
| example | \`{param: value}\` | Description | Expected response |

## Safety Constraints

Document any safety-critical limits or constraints:
- Emergency stop procedure
- Axis / range limits
- Speed limits
- Collision avoidance notes

## Setup Instructions

How to connect and initialize the hardware for the first time.
`

/**
 * Claude Code provider — uses @anthropic-ai/claude-agent-sdk.
 *
 * Resolution strategy (server / non-Electron context):
 *   1. Global `claude` CLI — preferred
 *   2. Bundled @anthropic-ai/claude-code cli.js — fallback (requires system node)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import { WsWriter } from './types.js'

const activeSessions = new Map<string, { instance: any; abort: () => void }>()

// ── Claude Code Detection ────────────────────────────

interface ClaudeCodeInfo {
  executablePath: string
  version: string
  source: 'global' | 'bundled'
}

let _cached: ClaudeCodeInfo | null = null

function detectClaudeCode(): ClaudeCodeInfo {
  if (_cached) return _cached

  // 1. Check global claude CLI
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude'
    const raw = execSync(cmd, { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    const globalPath = raw.split(/\r?\n/)[0].trim()
    if (globalPath && fs.existsSync(globalPath)) {
      const ver = execSync(`"${globalPath}" --version`, { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
      _cached = { executablePath: globalPath, version: ver, source: 'global' }
      console.log(`[claude-sdk] Using global Claude Code (${ver}): ${globalPath}`)
      return _cached
    }
  } catch { /* not installed globally */ }

  // 2. Bundled @anthropic-ai/claude-code cli.js
  const require_ = createRequire(import.meta.url)
  let cliPath: string
  try {
    const pkg = require_.resolve('@anthropic-ai/claude-code/package.json')
    cliPath = path.join(path.dirname(pkg), 'cli.js')
  } catch {
    const sdk = require_.resolve('@anthropic-ai/claude-agent-sdk')
    cliPath = path.join(path.dirname(sdk), 'cli.js')
  }

  let ver = 'unknown'
  try {
    const pkg = require_.resolve('@anthropic-ai/claude-code/package.json')
    ver = JSON.parse(fs.readFileSync(pkg, 'utf-8')).version || ver
  } catch {}

  _cached = { executablePath: cliPath, version: ver, source: 'bundled' }
  console.log(`[claude-sdk] Using bundled Claude Code (${ver}): ${cliPath}`)
  return _cached
}

export function getClaudeCodeInfo(): { source: string; version: string; path: string } {
  const info = detectClaudeCode()
  return { source: info.source, version: info.version, path: info.executablePath }
}

export function resetClaudeCodeDetection(): void {
  _cached = null
}

// ── SDK Query ────────────────────────────────────────

export async function queryClaudeSDK(
  command: string,
  options: {
    sessionId?: string
    cwd?: string
    model?: string
    permissionMode?: string
  },
  writer: WsWriter,
): Promise<void> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const cc = detectClaudeCode()

  const sdkOptions: Record<string, any> = {
    pathToClaudeCodeExecutable: cc.executablePath,
    model: options.model || 'sonnet',
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    tools: { type: 'preset', preset: 'claude_code' },
    settingSources: ['project', 'user', 'local'],
  }

  if (options.cwd) {
    if (!fs.existsSync(options.cwd)) fs.mkdirSync(options.cwd, { recursive: true })
    sdkOptions.cwd = options.cwd
  }
  if (options.sessionId) sdkOptions.resume = options.sessionId

  if (options.permissionMode === 'bypassPermissions' || options.permissionMode === 'dangerously-skip-permissions') {
    sdkOptions.permissionMode = 'bypassPermissions'
  }

  let capturedSessionId = options.sessionId || null

  try {
    const queryInstance = query({ prompt: command, options: sdkOptions })

    for await (const message of queryInstance) {
      if ((message as any).session_id && !capturedSessionId) {
        capturedSessionId = (message as any).session_id
        writer.sendSessionCreated(capturedSessionId!)
        activeSessions.set(capturedSessionId!, {
          instance: queryInstance,
          abort: () => (queryInstance as any).interrupt?.(),
        })
      }

      const msg = message as any

      if (msg.type === 'assistant' && msg.message?.content) {
        const content = msg.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              writer.sendText(block.text)
            } else if (block.type === 'tool_use') {
              const detail = formatToolInput(block.name, block.input)
              writer.send({ type: 'tool_use', name: block.name, toolId: block.id, detail })
            } else if (block.type === 'thinking') {
              writer.send({ type: 'thinking', content: block.thinking })
            }
          }
        }
      }

      if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content) {
          if (block.type === 'tool_result') {
            writer.send({
              type: 'tool_result',
              toolId: block.tool_use_id,
              isError: block.is_error || false,
            })
          }
        }
      }

      if (msg.type === 'result') {
        const usage = msg.usage || {}
        writer.sendResult(
          msg.total_cost_usd || msg.cost_usd,
          { input: usage.input_tokens || 0, output: usage.output_tokens || 0 },
        )
      }
    }
  } catch (err) {
    writer.sendError(err instanceof Error ? err.message : String(err))
  } finally {
    writer.sendComplete()
    if (capturedSessionId) activeSessions.delete(capturedSessionId)
  }
}

function formatToolInput(name: string, input: any): string {
  if (!input || typeof input !== 'object') return ''
  switch (name) {
    case 'Read': return input.file_path || ''
    case 'Write': return input.file_path || ''
    case 'Edit': return input.file_path || ''
    case 'Bash': return (input.command || '').substring(0, 100)
    case 'Glob': return input.pattern || ''
    case 'Grep': return `${input.pattern || ''} ${input.path || ''}`
    case 'Agent': return input.description || input.prompt?.substring(0, 60) || ''
    default: {
      const firstVal = Object.values(input).find(v => typeof v === 'string')
      return typeof firstVal === 'string' ? firstVal.substring(0, 80) : ''
    }
  }
}

export function abortClaudeSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.abort()
    activeSessions.delete(sessionId)
    return true
  }
  return false
}

export function isClaudeSessionActive(sessionId: string): boolean {
  return activeSessions.has(sessionId)
}

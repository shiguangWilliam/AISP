import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'src', 'data')
const usersFile = path.join(dataDir, 'users.json')
const conversationsFile = path.join(dataDir, 'conversations.json')
const scoresFile = path.join(dataDir, 'scores.json')
const agentsFile = path.join(dataDir, 'agents.json')
const agentSessionsFile = path.join(dataDir, 'agentSessions.json')

const ensureFile = (file, initial) => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial))
}

ensureFile(usersFile, [])
ensureFile(conversationsFile, [])
ensureFile(scoresFile, [])
ensureFile(agentsFile, [])
ensureFile(agentSessionsFile, [])

const read = (file) => {
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

const write = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data))
}

export const getUsers = () => read(usersFile)
export const saveUsers = (data) => write(usersFile, data)

export const getConversations = () => read(conversationsFile)
export const saveConversations = (data) => write(conversationsFile, data)

export const getScores = () => read(scoresFile)
export const saveScores = (data) => write(scoresFile, data)

export const getAgents = () => read(agentsFile)
export const saveAgents = (data) => write(agentsFile, data)

export const getAgentSessions = () => read(agentSessionsFile)
export const saveAgentSessions = (data) => write(agentSessionsFile, data)


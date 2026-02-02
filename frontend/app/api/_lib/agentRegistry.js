import { getAgents } from '../../../src/data/store'

export const loadAgentRegistry = () => {
  const key = process.env.QINGYAN_API_KEY
  const secret = process.env.QINGYAN_API_SECRET

  if (!key || !secret) {
    throw new Error('Missing Qingyan API credentials. Set QINGYAN_API_KEY and QINGYAN_API_SECRET in frontend/.env.local (server-only).')
  }

  const agents = getAgents()
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error('Missing agents list in src/data/agents.json')
  }

  return { key, secret, agents }
}

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const SECRETS_FILE = path.join(process.cwd(), '.secrets.json')
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'

class SecretsManager {
  constructor() {
    this.secrets = this.loadSecrets()
  }

  encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  }

  decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  loadSecrets() {
    try {
      if (fs.existsSync(SECRETS_FILE)) {
        const data = fs.readFileSync(SECRETS_FILE, 'utf8')
        const encrypted = JSON.parse(data)
        const decrypted = {}
        
        for (const [key, value] of Object.entries(encrypted)) {
          decrypted[key] = this.decrypt(value)
        }
        
        return decrypted
      }
    } catch (error) {
      console.error('Error loading secrets:', error)
    }
    return {}
  }

  saveSecrets() {
    try {
      const encrypted = {}
      
      for (const [key, value] of Object.entries(this.secrets)) {
        encrypted[key] = this.encrypt(value)
      }
      
      fs.writeFileSync(SECRETS_FILE, JSON.stringify(encrypted, null, 2))
    } catch (error) {
      console.error('Error saving secrets:', error)
    }
  }

  getSecret(key) {
    return this.secrets[key]
  }

  setSecret(key, value) {
    this.secrets[key] = value
    this.saveSecrets()
  }

  deleteSecret(key) {
    delete this.secrets[key]
    this.saveSecrets()
  }
}

const secretsManager = new SecretsManager()

export function useSecrets() {
  return {
    getSecret: (key) => secretsManager.getSecret(key),
    setSecret: (key, value) => secretsManager.setSecret(key, value),
    deleteSecret: (key) => secretsManager.deleteSecret(key)
  }
}

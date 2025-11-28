import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

app.use(cors())
app.use(express.json())

// Demo users for authentication
const demoUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    team_id: null
  },
  {
    id: '2',
    email: 'user@example.com',
    password: bcrypt.hashSync('user123', 10),
    role: 'user',
    team_id: null
  }
]

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' })
    }
    req.user = user
    next()
  })
}

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = demoUsers.find(u => u.email === email)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        team_id: user.team_id
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

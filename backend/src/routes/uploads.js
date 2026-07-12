import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { config } from '../config.js'

// Осигурај дека папката за слики постои
fs.mkdirSync(config.uploadDir, { recursive: true })

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype] || '.jpg'}`),
})

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: config.maxPhotos },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)
    cb(new Error('Дозволени се само слики (JPEG, PNG, WEBP).'))
  },
})

export const uploadsRouter = Router()

// Прикачување на слики: враќа јавни URL-и што се чуваат во колоните photo_1..photo_6.
uploadsRouter.post('/', upload.array('files', config.maxPhotos), (req, res) => {
  const files = req.files || []
  if (files.length === 0) return res.status(400).json({ error: 'Нема прикачени слики.' })
  const urls = files.map((f) => `${config.publicBaseUrl}/uploads/${path.basename(f.path)}`)
  res.status(201).json({ urls })
})

// Vercel serverless влез — ја користи истата Express апликација како
// локалниот сервер. Сите /api/* и /uploads/* барања се насочени овде
// (види vercel.json). Базата се поврзува преку DATABASE_URL env варијабла.
import { app } from '../backend/src/app.js'

export default app

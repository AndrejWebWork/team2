// Vercel serverless влез — ја користи истата Express апликација како
// локалниот сервер. Сите /api/* и /uploads/* барања се насочени овде
// (види vercel.json). Базата се поврзува преку DATABASE_URL env варијабла.
//
// Апликацијата се вчитува мрзеливо (lazy) со try/catch: ако нешто падне при
// иницијализација, одговараме со читлива грешка наместо генеричкиот
// FUNCTION_INVOCATION_FAILED екран на Vercel.
let appPromise = null

export default async function handler(req, res) {
  try {
    if (!appPromise) appPromise = import('../backend/src/app.js')
    const { app } = await appPromise
    return app(req, res)
  } catch (err) {
    appPromise = null // дозволи повторен обид на следното барање
    console.error('API init failed:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      error: 'INIT_FAILED',
      message: String(err && err.message),
      stack: String(err && err.stack).split('\n').slice(0, 6),
    }))
  }
}

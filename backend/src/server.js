// Локален/класичен сервер — ја подига заедничката Express апликација.
// На Vercel не се користи овој фајл (таму влезот е api/index.js).
import { app } from './app.js'
import { config } from './config.js'

app.listen(config.port, () => {
  console.log(`EkoSkopje API слуша на ${config.publicBaseUrl} (порта ${config.port})`)
})

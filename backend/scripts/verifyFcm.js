import 'dotenv/config'
import { verifyPush } from '../src/lib/fcm.js'

const result = await verifyPush()
console.log(JSON.stringify(result, null, 2))
if (!result.tokenOk) process.exitCode = 1

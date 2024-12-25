import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getProjectRoot() {
  return join(__dirname, '..', '..', '..') 
}
console.log(__dirname)
export const baseDirectory = getProjectRoot()
export const uploadsPath = join(baseDirectory, 'api/uploads')

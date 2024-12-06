import path from "path"
import ApplicationModel from "../../../../models/Application.model.js"
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const baseDirectory = join(__dirname, '..', '..' ,'..', '..', 'api', 'uploads')

const downloadFile = (bot) => {
    bot.action([/download_file_(.+)/], async (ctx) => {
        const applicationId = ctx.match[1]
        try {
            const application = await ApplicationModel.findById(applicationId)
            if (!application) {
                await ctx.reply('Заявка не найдена.')
                return
            }
            const filePath = path.join(baseDirectory, application.fileAnswer)
            if (!fs.existsSync(filePath)) {
                await ctx.reply('Файл не найден.')
                return
            }
            await ctx.replyWithDocument({ source: filePath })
        } catch (error) {
            console.error('Error downloading file:', error)
            await ctx.reply('Произошла ошибка при загрузке файла. Пожалуйста, попробуйте снова.')
        }
    })
}

export default downloadFile
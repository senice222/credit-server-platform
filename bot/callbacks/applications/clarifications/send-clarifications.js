import { Markup } from "telegraf"
import multer from "multer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const uploadPath = path.join(__dirname, '../../../../api/uploads')
const upload = multer({ dest: uploadPath })

const sendClarifications = (bot) => {
    bot.action([/clarify_(.+)/], async (ctx) => {
        const applicationId = ctx.match[1]
        await ctx.reply(`Отправьте уточнения в этот чат. Можно отправить как текст, так и файлы. Как закончите отправлять, нажмите "Готово".`)

        ctx.session.applicationId = applicationId
        ctx.session.clarifications = []
        ctx.session.collectingClarifications = true
    })

    bot.on('text', async (ctx) => {
        if (ctx.session.collectingClarifications) {
            ctx.session.clarifications.push({
                type: 'text',
                content: ctx.message.text,
                timestamp: new Date()
            })
            if (ctx.session.clarifications.length === 1) {
                try {
                    await ctx.reply(`Продолжайте отправлять сообщения. Как закончите отправлять, нажмите “Готово”.`, {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Готово', `done_${ctx.session.applicationId}`)
                        ]).resize().reply_markup
                    })
                } catch (error) {
                    console.error('Error editing message:', error)
                }
            }
        }
    })

    bot.on('document', async (ctx) => {
        if (ctx.session.collectingClarifications) {
            const file = ctx.message.document
            const fileUrl = await ctx.telegram.getFileLink(file.file_id)
            const fileName = Buffer.from(file.file_name, 'binary').toString('utf8');
            ctx.session.clarifications.push({
                type: 'document',
                fileId: file.file_id,
                fileName: fileName,
                fileUrl,
                timestamp: new Date()
            })

            if (ctx.session.clarifications.length === 1) {
                try {
                    await ctx.reply(`Продолжайте отправлять сообщения. Как закончите отправлять, нажмите “Готово”.`, {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Готово', `done_${ctx.session.applicationId}`)
                        ]).resize().reply_markup
                    })
                } catch (error) {
                    console.error('Error editing message:', error)
                }
            }
        }
    })

    bot.on('photo', async (ctx) => {
        if (ctx.session.collectingClarifications) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1]
            const fileUrl = await ctx.telegram.getFileLink(photo.file_id)

            ctx.session.clarifications.push({
                type: 'photo',
                fileId: photo.file_id,
                fileUrl,
                timestamp: new Date()
            })

            if (ctx.session.clarifications.length === 1) {
                try {
                    await ctx.reply(`Продолжайте отправлять сообщения. Как закончите отправлять, нажмите “Готово”.`, {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Готово', `done_${ctx.session.applicationId}`)
                        ]).resize().reply_markup
                    })
                } catch (error) {
                    console.error('Error editing message:', error)
                }
            }
        }
    })

}
export default sendClarifications

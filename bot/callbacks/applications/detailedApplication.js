import { Markup } from 'telegraf'
import ApplicationModel from '../../../models/Application.model.js'

export function extractFileName(file) {
    const fileName = file.split('.')[0]; 

    return fileName;
}

const detailedApplication = (bot) => {
    const API_URL = process.env.API_URL;

    bot.action([/\?detailedApp_(.+)/], async (ctx) => {
        const applicationId = ctx.match[1];
        try {
            const application = await ApplicationModel.findById(applicationId);
            if (!application) {
                await ctx.reply('Заявка не найдена.');
                return;
            }

            let messageText = `Заявка №${application.normalId}\nСтатус: ${application.status}`;
            
            if (application.status === "На уточнении") {
                messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––"
            }

            const buyerDocs = application.buyerDocuments?.filter(file => file.trim() !== '') || [];
            const sellerDocs = application.sellerDocuments?.filter(file => file.trim() !== '') || [];

            if (application.comments) {
                messageText += `\n\nОтвет на заявку:\nКомментарий: ${application.comments}`
            }

            if (buyerDocs.length > 0) {
                messageText += `\nДокументы для покупателя:`;
                buyerDocs.map((file, index) => {
                    const encodedFile = encodeURIComponent(file);
                    console.log(`${API_URL}/uploads/${encodedFile}`)
                    messageText += `\n${index + 1}. <a href="${API_URL}/uploads/${encodedFile}">скачать</a>`;
                });
            }
            
            if (sellerDocs.length > 0) {
                messageText += `\nДокументы для продавца:`;
                sellerDocs.map((file, index) => {
                    const encodedFile = encodeURIComponent(file);
                    messageText += `\n${index + 1}. <a href="${API_URL}/uploads/${encodedFile}">скачать</a>`;
                });
            }

            messageText += `\n\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите "Вопрос по заявке №${application.normalId}".`

            await ctx.editMessageText(messageText, {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('Вернуться назад', `?myApplications`)]
                ]).resize().reply_markup,
                parse_mode: 'HTML'
            });

        } catch (error) {
            console.error('Error in detailedApplication:', error);
            await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
        }
    });
};

export default detailedApplication

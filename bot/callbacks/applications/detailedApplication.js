import { Markup } from 'telegraf'
import ApplicationModel from '../../../models/Application.model.js'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'

export function extractFileName(file) {
    const fileName = file.split('.')[0]; 
    
    return fileName;
}

async function createZipArchive(files, zipName) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(`uploads/${zipName}`);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        output.on('close', () => resolve(zipName));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);

        files.forEach(file => {
            const filePath = path.join('uploads', file);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file });
            }
        });

        archive.finalize();
    });
}

const detailedApplication = (bot) => {
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

            // Add documents information
            const buyerDocs = application.buyerDocuments?.filter(file => file.trim() !== '') || [];
            const sellerDocs = application.sellerDocuments?.filter(file => file.trim() !== '') || [];

            if (application.comments) {
                messageText += `\n\nОтвет на заявку:\nКомментарий: ${application.comments}`
            }

            if (buyerDocs.length > 0) {
                const buyerZipName = `buyer_docs_${application.normalId}.zip`;
                await createZipArchive(buyerDocs, buyerZipName);
                
                messageText += `\nПакет документов для покупателя:`;
                messageText += `\n<a href="https://orders.consultantnlgpanel.ru/api/uploads/${encodeURIComponent(buyerZipName)}">Скачать все документы (ZIP)</a>`;
                buyerDocs.map((file, index) => {
                    const encodedFile = encodeURIComponent(file);
                    messageText += `\n${index + 1}. <a href="https://orders.consultantnlgpanel.ru/api/uploads/${encodedFile}">скачать</a>`;
                });
            }
            
            if (sellerDocs.length > 0) {
                const sellerZipName = `seller_docs_${application.normalId}.zip`;
                await createZipArchive(sellerDocs, sellerZipName);
                
                messageText += `\nПакет документов для продавца:`;
                messageText += `\n<a href="https://orders.consultantnlgpanel.ru/api/uploads/${encodeURIComponent(sellerZipName)}">Скачать все документы (ZIP)</a>`;
                sellerDocs.map((file, index) => {
                    const encodedFile = encodeURIComponent(file);
                    messageText += `\n${index + 1}. <a href="https://orders.consultantnlgpanel.ru/api/uploads/${encodedFile}">скачать</a>`;
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

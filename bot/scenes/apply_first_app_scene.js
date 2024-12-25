import {Markup, Scenes} from "telegraf"
import {extractFileName} from '../callbacks/applications/detailedApplication.js';
import {anyChanceRequirements, cancelKeyboard, formalDeal, skip} from "./keyboard.js"
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import {dirname, join} from 'path';
import {v4 as uuidv4} from 'uuid';
import {fileURLToPath} from 'url';
import UserModel from "../../models/User.model.js"
import ApplicationModel from "../../models/Application.model.js"
import {sendMail} from "../../utils/sendMail.js"
import dotenv from 'dotenv'
import multer from 'multer';
import ApplicationSchema from "../../models/Application.model.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadDirectory = path.join(__dirname, '../../api/uploads');

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {recursive: true});
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = uuidv4();
        const fileName = `${path.parse(file.originalname).name}_${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
    }
});
const upload = multer({storage: storage});

const handleFileUpload = async (ctx, fileType) => {
    try {
        const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = file.file_id;
        const fileInfo = await ctx.telegram.getFile(fileId);
        const filePath = fileInfo.file_path;

        const uniqueSuffix = uuidv4();
        const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
        const localFilePath = path.join(uploadDirectory, fileName);
        const fileStream = fs.createWriteStream(localFilePath);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

        const downloadStream = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        downloadStream.data.pipe(fileStream);

        const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;
        ctx.wizard.state.data[fileType].push(publicFileUrl);
        
        if (ctx.wizard.state.data[fileType].length === 1 && fileType !== 'allDocuments') {
            const msg = await ctx.reply(
                `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку "Готово" ниже.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Готово', callback_data: `?${fileType}_done`}]
                        ],
                    },
                    parse_mode: 'HTML',
                }
            );
            ctx.wizard.state.deleteMessages.push(msg.message_id);
        }
    } catch (err) {
        console.error('Error during file download:', err);
        await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
    }
};

const moveToNextStep = async (ctx, stepNumber, message, keyboard = cancelKeyboard) => {
    const msg = await ctx.reply(
        `<b>${stepNumber}/6 ${message}</b>`,
        {
            reply_markup: keyboard.reply_markup,
            parse_mode: "HTML"
        }
    );
    ctx.wizard.state.deleteMessages.push(msg.message_id);
    ctx.wizard.next();
};

const ApplyApplication = new Scenes.WizardScene(
    'apply_first_application',
    async ctx => {
        ctx.wizard.state.deleteMessages = [];
        ctx.wizard.state.data = {};
        ctx.wizard.state.data.isFormalDeal = null;
        ctx.wizard.state.data.fileAct = [];
        ctx.wizard.state.data.fileExplain = [];
        ctx.wizard.state.data.additionalInformation = []
        ctx.wizard.state.data.actSverki = [];
        ctx.wizard.state.data.lastDateActSverki = null;
        ctx.wizard.state.data.allDocuments = [];
        ctx.wizard.state.data.cart60file = [];
        ctx.wizard.state.data.previousDocuments = [];
        ctx.wizard.state.currentStep = '';
        ctx.wizard.state.data.isFormalDeal = false;
        
        const msg = await ctx.reply(
            `<b>⚙️ Введите полное название компании:</b> \n\n<i>Пример: ООО "Компания"</i>`,
            {
                reply_markup: cancelKeyboard.reply_markup,
                parse_mode: 'HTML',
            }
        );
        ctx.wizard.state.deleteMessages.push(msg.message_id);
        ctx.wizard.next();
    },
    async ctx => {
        if (ctx.updateType === 'message') {
            ctx.wizard.state.data['name'] = ctx.message.text;
            ctx.wizard.state.data['id'] = ctx.from.id
            const msg = await ctx.reply(
                `<b>⚙️ Введите ИНН компании</b> \n\n<i>Пример: 7877675123</i>`,
                {
                    reply_markup: cancelKeyboard.reply_markup,
                    parse_mode: 'HTML',
                }
            );
            ctx.wizard.state.deleteMessages.push(msg.message_id);
            ctx.wizard.next();
        } else if (ctx.update.callback_query.data.startsWith('?detailedApp_')) {
            // Действие для кнопки с ?detailedApp_
            const callbackData = ctx.update.callback_query.data;
            ctx.wizard.state = {};
            const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
            try {
                const application = await ApplicationModel.findById(applicationId);
                if (!application) {
                    await ctx.reply('Заявка не найдена.');
                    return;
                }

                // Формируем текст заявки
                let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                if (application.dateAnswer) {
                    messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                }
                if (application.status === "На уточнении") {
                    messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в том чате выше и отправьте их.</i>\n–––––";
                }

                const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                if (application.comments) {
                    messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                }

                if (validFiles.length > 0) {
                    validFiles.forEach((file) => {
                        const fileName = extractFileName(file);
                        const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                        messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                    });
                }

                messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                await ctx.editMessageText(
                    messageText,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            [Markup.button.callback('Вернуться назад', `?myApplications`)]
                        ]).resize().reply_markup,
                        parse_mode: 'HTML'
                    }
                );

            } catch (error) {
                console.error('Error in detailedApplication:', error);
                await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
            }

        } else if (callbackData === '?cancelScene') {
            // Действие для отмены сцены
            await ctx.reply('Вы отменили действие.');
            ctx.scene.leave();
        } else {
            await ctx.reply('Пожалуйста, введите название компании.');
        }

    },
    async ctx => {
        if (ctx.updateType === 'message') {
            ctx.wizard.state.data.accepted = true;
            ctx.wizard.state.data['inn'] = ctx.message.text;
            const msg = await ctx.reply(`<b>⚙️ 1/6 Отправьте файл договора(ов)</b> (включая все дополнительные соглашения и приложения).\n\n Договор необходимо отправить в формате Word \n\n <i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>`, {
                reply_markup: cancelKeyboard.reply_markup,
                parse_mode: "HTML"
            });

            ctx.wizard.state.deleteMessages.push(msg.message_id);
            ctx.wizard.next();
        } else if (ctx.update.callback_query.data.startsWith('?detailedApp_')) {
            // Действие для кнопки с ?detailedApp_
            const callbackData = ctx.update.callback_query.data;
            ctx.wizard.state = {};
            const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
            try {
                const application = await ApplicationModel.findById(applicationId);
                if (!application) {
                    await ctx.reply('Заявка не найдена.');
                    return;
                }

                // Формируем текст заявки
                let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                if (application.dateAnswer) {
                    messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                }
                if (application.status === "На уточнении") {
                    messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
                }

                const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                if (application.comments) {
                    messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                }

                if (validFiles.length > 0) {
                    validFiles.forEach((file) => {
                        const fileName = extractFileName(file);
                        const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                        messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                    });
                }

                messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                await ctx.editMessageText(
                    messageText,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            [Markup.button.callback('Вернуться назад', `?myApplications`)]
                        ]).resize().reply_markup,
                        parse_mode: 'HTML'
                    }
                );

            } catch (error) {
                console.error('Error in detailedApplication:', error);
                await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
            }

        } else if (callbackData === '?cancelScene') {
            // Действие для отмены сцены
            await ctx.reply('Вы отменили действие.');
            ctx.scene.leave();
        }
    },
    async ctx => {
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?done_act') {
                const msg = await ctx.reply(`<b>2/6 Отправьте акт сверки. Если акта сверки нет, нажмите кнопку “Пропустить”.</b>`, {
                    reply_markup: skip.reply_markup,
                    parse_mode: "HTML"
                })

                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            } else if (callbackData.startsWith('?detailedApp_')) {
                // Действие для кнопки с ?detailedApp_
                ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
                ctx.scene.leave()
                const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
                try {
                    const application = await ApplicationModel.findById(applicationId);
                    if (!application) {
                        await ctx.reply('Заявка не найдена.');
                        return;
                    }

                    // Формируем текст заявки
                    let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                    if (application.dateAnswer) {
                        messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                    }
                    if (application.status === "На уточнении") {
                        messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
                    }

                    const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                    if (application.comments) {
                        messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                    }

                    if (validFiles.length > 0) {
                        validFiles.forEach((file) => {
                            const fileName = extractFileName(file);
                            const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                            messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                        });
                    }

                    messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                    await ctx.editMessageText(
                        messageText,
                        {
                            reply_markup: Markup.inlineKeyboard([
                                [Markup.button.callback('Вернуться назад', `?myApplications`)]
                            ]).resize().reply_markup,
                            parse_mode: 'HTML'
                        }
                    );

                } catch (error) {
                    console.error('Error in detailedApplication:', error);
                    await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
                }

            } else if (callbackData === '?cancelScene') {
                // Действие для отмены сцены
                await ctx.reply('Вы отменили действие.');
                ctx.scene.leave();
            }
        } else if (ctx.message.document) {
            try {
                const file = ctx.message.document
                const fileId = file.file_id;
                const fileName = file.file_name || ''; // Получаем имя файла
                const wordFileRegex = /\.(doc|docx)$/i; // Регулярное выражение для Word файлов
                if (ctx.message.document) {
                    // Проверка расширения
                    if (!wordFileRegex.test(fileName)) {
                        const msg = await ctx.reply('Пожалуйста, отправьте файл Word.');
                        ctx.wizard.state.deleteMessages.push(msg.message_id);
                    }
                }
                if (wordFileRegex.test(fileName)) {
                    const fileInfo = await ctx.telegram.getFile(fileId);
                    const filePath = fileInfo.file_path;

                    const uniqueSuffix = uuidv4();
                    const savedFileName = `${uniqueSuffix}@${path.basename(filePath)}`;
                    const localFilePath = path.join(uploadDirectory, savedFileName);
                    const fileStream = fs.createWriteStream(localFilePath);
                    const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

                    const downloadStream = await axios({
                        url: fileUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    downloadStream.data.pipe(fileStream);

                    const publicFileUrl = `${process.env.URL}/api/uploads/${savedFileName}`;
                    ctx.wizard.state.data.fileAct.push(publicFileUrl);

                    if (ctx.wizard.state.data.fileAct.length === 1) {
                        const msg = await ctx.reply(
                            `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку “Готово” ниже.`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: 'Готово', callback_data: '?done_act' }]
                                    ],
                                },
                                parse_mode: 'HTML',
                            }
                        );
                        ctx.wizard.state.deleteMessages.push(msg.message_id);
                    }
                }
            } catch (err) {
                console.error('Error during file download:', err);
                await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
            }
        } else if (ctx.message.text) {
            const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
            ctx.wizard.state.deleteMessages.push(msg.message_id);
        } else {
            await ctx.reply('Пожалуйста, отправьте файл.');
        }        
    },
    // async ctx => {
    //     if (ctx.updateType === 'callback_query') {
    //         const callbackData = ctx.update.callback_query.data;
    //         if (callbackData === '?done_act') {
    //             await moveToNextStep(ctx, 4, 'Отправьте любые документы из перечисленных: УПД, КС-2, КС-3, акты выполненных работ.');
    //         }
    //         if (callbackData === '?yes_formal') {
    //             // ctx.wizard.state.isFormalDeal = true
    //             // const msg = await ctx.reply(`<b>3/7 Отправьте акт сверки. Если акта сверки нет, нажмите кнопку “Пропустить”.</b>`, {
    //             //     reply_markup: skip.reply_markup,
    //             //     parse_mode: "HTML"
    //             // })

    //             // ctx.wizard.state.deleteMessages.push(msg.message_id);
    //             // ctx.wizard.next();
    //         }
    //         if (callbackData === '?no_formal') {
    //             // ctx.wizard.state.isFormalDeal = false
    //             // const msg = await ctx.reply(`<b>3/7 Отправьте акт сверки. Если акта сверки нет, нажмите кнопку “Пропустить”.</b>`, {
    //             //     reply_markup: skip.reply_markup,
    //             //     parse_mode: "HTML"
    //             // })

    //             // ctx.wizard.state.deleteMessages.push(msg.message_id);
    //             // ctx.wizard.next();
    //         } else if (callbackData.startsWith('?detailedApp_')) {
    //             // Действие для кнопки с ?detailedApp_
    //             ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
    //             ctx.scene.leave()
    //             const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
    //             try {
    //                 const application = await ApplicationModel.findById(applicationId);
    //                 if (!application) {
    //                     await ctx.reply('Заявка не найдена.');
    //                     return;
    //                 }

    //                 // Формируем текст заявки
    //                 let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
    //                 if (application.dateAnswer) {
    //                     messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
    //                 }
    //                 if (application.status === "На уточнении") {
    //                     messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
    //                 }

    //                 const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
    //                 if (application.comments) {
    //                     messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
    //                 }

    //                 if (validFiles.length > 0) {
    //                     validFiles.forEach((file) => {
    //                         const fileName = extractFileName(file);
    //                         const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
    //                         messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
    //                     });
    //                 }

    //                 messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

    //                 await ctx.editMessageText(
    //                     messageText,
    //                     {
    //                         reply_markup: Markup.inlineKeyboard([
    //                             [Markup.button.callback('Вернуться назад', `?myApplications`)]
    //                         ]).resize().reply_markup,
    //                         parse_mode: 'HTML'
    //                     }
    //                 );

    //             } catch (error) {
    //                 console.error('Error in detailedApplication:', error);
    //                 await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
    //             }

    //         } else if (callbackData === '?cancelScene') {
    //             // Действие для отмены сцены
    //             await ctx.reply('Вы отменили действие.');
    //             ctx.scene.leave();
    //         }
    //     } else if (ctx.message.document || ctx.message.photo) {
    //         try {
    //             const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
    //             const fileId = file.file_id;
    //             const fileInfo = await ctx.telegram.getFile(fileId);
    //             const filePath = fileInfo.file_path;

    //             const uniqueSuffix = uuidv4();
    //             const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
    //             const localFilePath = path.join(uploadDirectory, fileName);
    //             const fileStream = fs.createWriteStream(localFilePath);
    //             const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

    //             const downloadStream = await axios({
    //                 url: fileUrl,
    //                 method: 'GET',
    //                 responseType: 'stream'
    //             });

    //             downloadStream.data.pipe(fileStream);

    //             const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;
    //             ctx.wizard.state.data.fileAct.push(publicFileUrl);

    //             if (ctx.wizard.state.data.fileAct.length === 1) {
    //                 const msg = await ctx.reply(
    //                     `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку “Готово” ниже.`,
    //                     {
    //                         reply_markup: {
    //                             inline_keyboard: [
    //                                 [{text: 'Готово', callback_data: '?done_act'}]
    //                             ],
    //                         },
    //                         parse_mode: 'HTML',
    //                     }
    //                 );
    //                 ctx.wizard.state.deleteMessages.push(msg.message_id);
    //             }
    //         } catch (err) {
    //             console.error('Error during file download:', err);
    //             await ctx.reply('Произошла ошибка при сохранении фала. Попробуйте снова.');
    //         }
    //     } else if (ctx.message.text) {
    //         const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
    //         ctx.wizard.state.deleteMessages.push(msg.message_id);
    //     } else {
    //         await ctx.reply('Пожалуйста, отправьте файл.');
    //     }
    // },
    async ctx => {
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?skip') {
                ctx.wizard.state.actSverki = [];
                const msg = await ctx.reply(`<b>3/6 Отправьте любые документы из перечисленных: УПД, КС-2, КС-3, акты выполненных работ.</b>`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Готово', callback_data: '?allDocuments_done'}]
                        ],
                    },
                    parse_mode: "HTML"
                });
                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            } else if (callbackData === '?acts_sverki_done') {
                const msg = await ctx.reply(`<b>Отправьте дату последнего акта сверки.</b> \n\n<b>Пример: 12.11.2024</b>`, {
                    parse_mode: "HTML"
                });
                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.state.waitingForDate = true;
            } else if (callbackData === '?allDocuments_done') {
                const {allDocuments} = ctx.wizard.state.data
                if (allDocuments.length > 0) {  
                    await moveToNextStep(ctx, 4, 'Отправьте карточку 60 счета (заинтересованного периода)\n\n<i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>');
                    ctx.wizard.state.currentStep = 'cart60file';
                } else {
                    const msg = await ctx.reply(`Отправьте файл.`, {
                        parse_mode: "HTML"
                    });
                    ctx.wizard.state.deleteMessages.push(msg.message_id);
                }
            }
        } else if (ctx.message.document || ctx.message.photo) {
            try {
                const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
                const fileId = file.file_id;
                const fileInfo = await ctx.telegram.getFile(fileId);
                const filePath = fileInfo.file_path;

                const uniqueSuffix = uuidv4();
                const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
                const localFilePath = path.join(uploadDirectory, fileName);
                const fileStream = fs.createWriteStream(localFilePath);
                const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

                const downloadStream = await axios({
                    url: fileUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                downloadStream.data.pipe(fileStream);

                const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;

                // Определяем, куда сохранять файл на основе текущего состояния
                if (!ctx.wizard.state.data.actSverki.length && !ctx.wizard.state.waitingForDate) {
                    ctx.wizard.state.data.actSverki.push(publicFileUrl);
                    if (ctx.wizard.state.data.actSverki.length === 1) {
                        const msg = await ctx.reply(
                            `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку "Готово" ниже.`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{text: 'Готово', callback_data: '?acts_sverki_done'}]
                                    ],
                                },
                                parse_mode: 'HTML',
                            }
                        );
                        ctx.wizard.state.deleteMessages.push(msg.message_id);
                    }
                } else {
                    ctx.wizard.state.data.allDocuments.push(publicFileUrl);
                    
                }
            } catch (err) {
                console.error('Error during file download:', err);
                await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
            }
        } else if (ctx.message.text) {
            if (ctx.wizard.state.waitingForDate) {
                ctx.wizard.state.data.lastDateActSverki = ctx.message.text;
                ctx.wizard.state.waitingForDate = false;
                const msg = await ctx.reply(`<b>3/6 Отправьте любые документы из перечисленных: УПД, КС-2, КС-3, акты выполненных работ.</b>`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Готово', callback_data: '?allDocuments_done'}]
                        ],
                    },
                    parse_mode: "HTML"
                });
                ctx.wizard.state.deleteMessages.push(msg.message_id);
            } else {
                const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
                ctx.wizard.state.deleteMessages.push(msg.message_id);
            }
        }
    },
    async ctx => {
        console.log("обработка да нет вторая")
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?yes_chance') {
                const msg = await ctx.reply(`<b>6/6 Отправьте файл предыдущих ответов или указанные документы, если таковые имеются \n\n или информацию которая была отправлена, касающиеся этого периода этой кредиторской задолженности.</b> \n\n<i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>`, {
                    reply_markup: cancelKeyboard.reply_markup,
                    parse_mode: "HTML"
                })

                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            }
            if (callbackData === '?no_chance') {
                const {
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                } = ctx.wizard.state.data
                ctx.wizard.state.data.owner = ctx.from.id;

                const user = await UserModel.findOne({ id: ctx.from.id });

                const newApplication = new ApplicationSchema({
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    demandsOrganization: false,
                    owner: ctx.from.id
                });
                await newApplication.save()
                user.applications.push(newApplication._id);
                await user.save();

                // Отправка письма
                sendMail(newApplication, `${process.env.URL}/application/${newApplication._id}`, 'new');

                await ctx.reply(
                    `<b>✅ Заявка №${newApplication.normalId} создана и отправлена на рассмотрение!</b>\n<i>В ближайшее время мы сообщим\nВам время рассмотрения заявки</i>`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Перейти к заявке', `?detailedApp_${newApplication._id}`)
                        ]).resize().reply_markup,
                        parse_mode: 'HTML',
                    }
                );

                ctx.scene.leave();
            }
        
            if (callbackData === '?allDocuments_done') {
                const {allDocuments} = ctx.wizard.state.data
                if (allDocuments.length > 0) {  
                    await moveToNextStep(ctx, 4, 'Отправьте карточку 60 счета (заинтересованного периода)\n\n<i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>');
                    ctx.wizard.state.currentStep = 'cart60file';
                } else {
                    const msg = await ctx.reply(`Отправьте файл.`, {
                        parse_mode: "HTML"
                    });
                    ctx.wizard.state.deleteMessages.push(msg.message_id);
                }
            }
            if (callbackData === '?cart60file_done') {
                const msg = await ctx.reply(`<b>5/6 Были ли ранее случаи выставления требований к данной организации?</b>`, {
                    reply_markup: anyChanceRequirements.reply_markup,
                    parse_mode: "HTML"
                });
                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            }
        } else if (ctx.message.document || ctx.message.photo) {
            if (ctx.wizard.state.currentStep === 'cart60file') {
                console.log("cart60file")
                await handleFileUpload(ctx, 'cart60file');
            } else {
                console.log("allDocuments")
                await handleFileUpload(ctx, 'allDocuments');
            }
        } else if (ctx.message.text) {
            const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
            ctx.wizard.state.deleteMessages.push(msg.message_id);
        }
    },
    async ctx => {
        console.log("обработка да нет первая")
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?yes_chance') {
                const msg = await ctx.reply(`<b>6/6 Отправьте файл предыдущих ответов или указанные документы, если таковые имеются \n\n или информацию которая была отправлена, касающиеся этого периода этой кредиторской задолженности.</b> \n\n<i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>`, {
                    reply_markup: cancelKeyboard.reply_markup,
                    parse_mode: "HTML"
                })

                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            }
            if (callbackData === '?no_chance') {
                const {
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                } = ctx.wizard.state.data
                ctx.wizard.state.data.owner = ctx.from.id;

                const user = await UserModel.findOne({ id: ctx.from.id });

                const newApplication = new ApplicationSchema({
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    demandsOrganization: false,
                    owner: ctx.from.id
                });
                await newApplication.save()
                user.applications.push(newApplication._id);
                await user.save();

                // Отправка письма
                sendMail(newApplication, `${process.env.URL}/application/${newApplication._id}`, 'new');

                await ctx.reply(
                    `<b>✅ Заявка №${newApplication.normalId} создана и отправлена на рассмотрение!</b>\n<i>В ближайшее время мы сообщим\nВам время рассмотрения заявки</i>`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Перейти к заявке', `?detailedApp_${newApplication._id}`)
                        ]).resize().reply_markup,
                        parse_mode: 'HTML',
                    }
                );

                ctx.scene.leave();
            }
            if (callbackData === '?allDocuments60_done') {
                const msg = await ctx.reply(`<b>5/6 Были ли ранее случаи выставления требований к данной организации?</b>`, {
                    reply_markup: anyChanceRequirements.reply_markup,
                    parse_mode: "HTML"
                });
                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            }
            if (callbackData.startsWith('?detailedApp_')) {
                // Действие для кнопки с ?detailedApp_
                ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
                ctx.scene.leave()
                const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
                try {
                    const application = await ApplicationModel.findById(applicationId);
                    if (!application) {
                        await ctx.reply('Заявка не найдена.');
                        return;
                    }

                    // Формируем текст заявки
                    let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                    if (application.dateAnswer) {
                        messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                    }
                    if (application.status === "На уточнении") {
                        messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
                    }

                    const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                    if (application.comments) {
                        messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                    }

                    if (validFiles.length > 0) {
                        validFiles.forEach((file) => {
                            const fileName = extractFileName(file);
                            const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                            messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                        });
                    }

                    messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                    await ctx.editMessageText(
                        messageText,
                        {
                            reply_markup: Markup.inlineKeyboard([
                                [Markup.button.callback('Вернуться назад', `?myApplications`)]
                            ]).resize().reply_markup,
                            parse_mode: 'HTML'
                        }
                    );

                } catch (error) {
                    console.error('Error in detailedApplication:', error);
                    await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
                }

            } else if (callbackData === '?cancelScene') {
                // Действие для отмены сцены
                await ctx.reply('Вы отменили действие.');
                ctx.scene.leave();
            }
        } else if (ctx.message.document || ctx.message.photo) {
            try {
                const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
                const fileId = file.file_id;
                const fileInfo = await ctx.telegram.getFile(fileId);
                const filePath = fileInfo.file_path;

                const uniqueSuffix = uuidv4();
                const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
                const localFilePath = path.join(uploadDirectory, fileName);
                const fileStream = fs.createWriteStream(localFilePath);
                const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

                const downloadStream = await axios({
                    url: fileUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                downloadStream.data.pipe(fileStream);

                const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;
                ctx.wizard.state.data.cart60file.push(publicFileUrl);
                if (ctx.wizard.state.data.cart60file.length === 1) {
                    const msg = await ctx.reply(
                        `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку "Готово" ниже.`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: 'Готово', callback_data: '?allDocuments60_done'}]
                                ],
                            },
                            parse_mode: 'HTML',
                        }
                    );
                    ctx.wizard.state.deleteMessages.push(msg.message_id);
                }
            } catch (err) {
                console.error('Error during file download:', err);
                await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
            }
        } else {
            await ctx.reply('Пожалуйста, отправьте файл.');
        }
    },
    async ctx => {
        console.log("обработка да нет третья")
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?yes_chance') {
                const msg = await ctx.reply(`<b>6/6 Отправьте файл предыдущих ответов или указанные документы, если таковые имеются \n\n или информацию которая была отправлена, касающиеся этого периода этой кредиторской задолженности.</b> \n\n<i>Пожалуйста, отправляйте по одному файлу за раз. Вы можете отправить несколько файлов.</i>`, {
                    reply_markup: cancelKeyboard.reply_markup,
                    parse_mode: "HTML"
                })

                ctx.wizard.state.deleteMessages.push(msg.message_id);
                ctx.wizard.next();
            }
            if (callbackData === '?no_chance') {
                const {
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                } = ctx.wizard.state.data
                ctx.wizard.state.data.owner = ctx.from.id;

                const user = await UserModel.findOne({ id: ctx.from.id });

                const newApplication = new ApplicationSchema({
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    demandsOrganization: false,
                    owner: ctx.from.id
                });
                await newApplication.save()
                user.applications.push(newApplication._id);
                await user.save();

                // Отправка письма
                sendMail(newApplication, `${process.env.URL}/application/${newApplication._id}`, 'new');

                await ctx.reply(
                    `<b>✅ Заявка №${newApplication.normalId} создана и отправлена на рассмотрение!</b>\n<i>В ближайшее время мы сообщим\nВам время рассмотрения заявки</i>`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Перейти к заявке', `?detailedApp_${newApplication._id}`)
                        ]).resize().reply_markup,
                        parse_mode: 'HTML',
                    }
                );

                ctx.scene.leave();
            }
            if (callbackData === '?previousDocuments_done') {
                const {
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    previousDocuments
                } = ctx.wizard.state.data
                ctx.wizard.state.data.owner = ctx.from.id;

                const user = await UserModel.findOne({ id: ctx.from.id });

                const newApplication = new ApplicationSchema({
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    demandsOrganization: false,
                    previousDocuments,
                    owner: ctx.from.id
                });
                await newApplication.save()
                user.applications.push(newApplication._id);
                await user.save();

                // Отправка письма
                sendMail(newApplication, `${process.env.URL}/application/${newApplication._id}`, 'new');

                await ctx.reply(
                    `<b>✅ Заявка №${newApplication.normalId} создана и отправлена на рассмотрение!</b>\n<i>В ближайшее время мы сообщим\nВам время рассмотрения заявки</i>`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Перейти к заявке', `?detailedApp_${newApplication._id}`)
                        ]).resize().reply_markup,
                        parse_mode: 'HTML',
                    }
                );

                ctx.scene.leave();
            } else if (callbackData.startsWith('?detailedApp_')) {
                // Действие для кнопки с ?detailedApp_
                ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
                ctx.scene.leave()
                const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
                try {
                    const application = await ApplicationModel.findById(applicationId);
                    if (!application) {
                        await ctx.reply('Заявка не найдена.');
                        return;
                    }

                    // Формируем текст заявки
                    let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                    if (application.dateAnswer) {
                        messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                    }
                    if (application.status === "На уточнении") {
                        messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
                    }

                    const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                    if (application.comments) {
                        messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                    }

                    if (validFiles.length > 0) {
                        validFiles.forEach((file) => {
                            const fileName = extractFileName(file);
                            const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                            messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                        });
                    }

                    messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                    await ctx.editMessageText(
                        messageText,
                        {
                            reply_markup: Markup.inlineKeyboard([
                                [Markup.button.callback('Вернуться назад', `?myApplications`)]
                            ]).resize().reply_markup,
                            parse_mode: 'HTML'
                        }
                    );

                } catch (error) {
                    console.error('Error in detailedApplication:', error);
                    await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
                }

            } else if (callbackData === '?cancelScene') {
                // Действие для отмены сцены
                await ctx.reply('Вы отменили действие.');
                ctx.scene.leave();
            }
        } else if (ctx.message.document || ctx.message.photo) {
            try {
                const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
                const fileId = file.file_id;
                const fileInfo = await ctx.telegram.getFile(fileId);
                const filePath = fileInfo.file_path;

                const uniqueSuffix = uuidv4();
                const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
                const localFilePath = path.join(uploadDirectory, fileName);
                const fileStream = fs.createWriteStream(localFilePath);
                const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

                const downloadStream = await axios({
                    url: fileUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                downloadStream.data.pipe(fileStream);

                const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;

                if (ctx.wizard.state.data.cart60file.length === 0) {
                    ctx.wizard.state.data.cart60file.push(publicFileUrl);
        
                    if (ctx.wizard.state.data.cart60file.length === 1) {
                        const msg = await ctx.reply(
                            `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку "Готово" ниже.`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: 'Готово', callback_data: '?allDocuments60_done' }],
                                    ],
                                },
                                parse_mode: 'HTML',
                            }
                        );
                        ctx.wizard.state.deleteMessages.push(msg.message_id);
                    }
                } else {
                    ctx.wizard.state.data.previousDocuments = ctx.wizard.state.data.previousDocuments || [];
                    ctx.wizard.state.data.previousDocuments.push(publicFileUrl);
        
                    if (ctx.wizard.state.data.previousDocuments.length === 1) {
                        const msg = await ctx.reply(
                            `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку "Готово" ниже.`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: 'Готово', callback_data: '?previousDocuments_done' }],
                                    ],
                                },
                                parse_mode: 'HTML',
                            }
                        );
                        ctx.wizard.state.deleteMessages.push(msg.message_id);
                    }
                }
            } catch (err) {
                console.error('Error during file download:', err);
                await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
            }
        } else if (ctx.message.text) {
            const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
            ctx.wizard.state.deleteMessages.push(msg.message_id);
        } else {
            await ctx.reply('Пожалуйста, отправьте файл.');
        }
    },
    async ctx => {
        if (ctx.updateType === 'callback_query') {
            const callbackData = ctx.update.callback_query.data;
            if (callbackData === '?previousDocuments_done') {
                const {
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    previousDocuments
                } = ctx.wizard.state.data
                ctx.wizard.state.data.owner = ctx.from.id;

                const user = await UserModel.findOne({ id: ctx.from.id });

                const newApplication = new ApplicationSchema({
                    name,
                    inn,
                    isFormalDeal,
                    fileAct,
                    fileExplain,
                    additionalInformation,
                    actSverki,
                    lastDateActSverki,
                    allDocuments,
                    cart60file,
                    demandsOrganization: false,
                    previousDocuments,
                    owner: ctx.from.id
                });
                await newApplication.save()
                user.applications.push(newApplication._id);
                await user.save();

                // Отправка письма
                sendMail(newApplication, `${process.env.URL}/application/${newApplication._id}`, 'new');

                await ctx.reply(
                    `<b>✅ Заявка №${newApplication.normalId} создана и отправлена на рассмотрение!</b>\n<i>В ближайшее время мы сообщим\nВам время рассмотрения заявки</i>`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.button.callback('Перейти к заявке', `?detailedApp_${newApplication._id}`)
                        ]).resize().reply_markup,
                        parse_mode: 'HTML',
                    }
                );

                ctx.scene.leave();
            } else if (callbackData.startsWith('?detailedApp_')) {
                // Действие для кнопки с ?detailedApp_
                ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
                ctx.scene.leave()
                const applicationId = callbackData.split('_')[1]; // Получаем ID заявки из callback_data
                try {
                    const application = await ApplicationModel.findById(applicationId);
                    if (!application) {
                        await ctx.reply('Заявка не найдена.');
                        return;
                    }

                    // Формируем текст заявки
                    let messageText = `<b>Заявка №${application.normalId}</b>\n<b>Статус: </b>${application.status}`;
                    if (application.dateAnswer) {
                        messageText += `\nБудет рассмотрена до: ${application.dateAnswer}`;
                    }
                    if (application.status === "На уточнении") {
                        messageText += "\n–––––\n<i>Проверьте сообщение об уточнениях в этом чате выше и отправьте их.</i>\n–––––";
                    }

                    const validFiles = application.fileAnswer.filter(file => file.trim() !== '');
                    if (application.comments) {
                        messageText += `\n---\n<b>Ответ по заявке:</b>\n<b>Комментарии:</b> ${application.comments || 'Нет комментариев'}`;
                    }

                    if (validFiles.length > 0) {
                        validFiles.forEach((file) => {
                            const fileName = extractFileName(file);
                            const encodedFile = encodeURIComponent(file); // Кодируем файл для корректного URL
                            messageText += `\n<b>${fileName}</b>: <a href="${process.env.URL}/api/uploads/${encodedFile}">Скачать</a>\n`;
                        });
                    }

                    messageText += `\n----\nПри возникновении вопросов по заявке обращайтесь на почту adm01@uk-fp.ru. В теме письма укажите “Вопрос по заявке №${application.normalId}”.`;

                    await ctx.editMessageText(
                        messageText,
                        {
                            reply_markup: Markup.inlineKeyboard([
                                [Markup.button.callback('Вернуться назад', `?myApplications`)]
                            ]).resize().reply_markup,
                            parse_mode: 'HTML'
                        }
                    );

                } catch (error) {
                    console.error('Error in detailedApplication:', error);
                    await ctx.reply('Произошла ошибка при загрузке заявки. Пожалуйста, попробуйте снова.');
                }

            } else if (callbackData === '?cancelScene') {
                // Действие для отмены сцены
                await ctx.reply('Вы отменили действие.');
                ctx.scene.leave();
            }
        } else if (ctx.message.document || ctx.message.photo) {
            try {
                const file = ctx.message.document || ctx.message.photo[ctx.message.photo.length - 1];
                const fileId = file.file_id;
                const fileInfo = await ctx.telegram.getFile(fileId);
                const filePath = fileInfo.file_path;

                const uniqueSuffix = uuidv4();
                const fileName = `${uniqueSuffix}@${path.basename(filePath)}`;
                const localFilePath = path.join(uploadDirectory, fileName);
                const fileStream = fs.createWriteStream(localFilePath);
                const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

                const downloadStream = await axios({
                    url: fileUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                downloadStream.data.pipe(fileStream);

                const publicFileUrl = `${process.env.URL}/api/uploads/${fileName}`;
                ctx.wizard.state.data.previousDocuments.push(publicFileUrl);

                if (ctx.wizard.state.data.previousDocuments.length === 1) {
                    const msg = await ctx.reply(
                        `Продолжайте отправлять файлы, если это необходимо. Как закончите, нажмите на кнопку “Готово” ниже.`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: 'Готово', callback_data: '?previousDocuments_done'}]
                                ],
                            },
                            parse_mode: 'HTML',
                        }
                    );
                    ctx.wizard.state.deleteMessages.push(msg.message_id);
                }
            } catch (err) {
                console.error('Error during file download:', err);
                await ctx.reply('Произошла ошибка при сохранении файла. Попробуйте снова.');
            }
        } else if (ctx.message.text) {
            const msg = await ctx.reply('На этом этапе нельзя отправить текст. Пожалуйста, отправьте файл.');
            ctx.wizard.state.deleteMessages.push(msg.message_id);
        } else {
            await ctx.reply('Пожалуйста, отправьте файл.');
        }
    }

)

ApplyApplication.on('message', async (ctx, next) => {
    ctx.wizard.state.deleteMessages.push(ctx.message.message_id)
    next()
})

ApplyApplication.action('?delete', async ctx => {
    ctx.deleteMessage(ctx.message.message_id)
})

ApplyApplication.action('?cancelScene', async ctx => {
    ctx.wizard.state.deleteMessages.forEach(item => ctx.deleteMessage(item))
    await ctx.scene.leave()
})

export default ApplyApplication

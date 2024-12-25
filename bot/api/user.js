import ApplicationModel from '../../models/Application.model.js';
import { Markup } from 'telegraf';
import multer from "multer";
import path, { dirname } from "path";
import fs from 'fs'
import { fileURLToPath } from "url";
import { format, parseISO, isValid, addHours, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import iconv from 'iconv-lite'
import UserModel from '../../models/User.model.js';
import { extractFileName } from '../callbacks/applications/detailedApplication.js';

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const uploadDirectory = path.join(__dirname, '../../api/uploads')

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory)
    },
    filename: function (req, file, cb) {
        const fileName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf-8')
        cb(null, fileName);
    }
})
const upload = multer({ storage: storage })

export const deleteApplication = (app, bot) => {
    app.delete("/api/application/delete/:id", async (req, res) => {
        const { id } = req.params
        const { _id } = req.body;
        try {
            const application = await ApplicationModel.findByIdAndDelete(_id)
            const user = await UserModel.findOne({ id })
            user.applications.filter(item => item !== _id)
            await user.save()
            await bot.telegram.sendMessage(id, `Заявка №${application.normalId} удалена.`,
                {
                    reply_markup: Markup.inlineKeyboard([
                        Markup.button.callback('В главное меню', `?start`)
                    ]).resize().reply_markup
                }
            );

            res.status(200).send('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send('Failed to send message');
        }
    });
};

export const setDateToAnswer = (app, bot) => {
    app.post("/api/application/set-date/:id", async (req, res) => {
        const { id } = req.params;
        const { _id, date } = req.body;

        try {
            const application = await ApplicationModel.findById(_id);
            if (!application) {
                return res.status(404).json("Application not found");
            }

            let normalizedDate = parseISO(date);

            if (!isNaN(normalizedDate)) {
                normalizedDate = startOfDay(addHours(normalizedDate, 3));
            } else {
                return res.status(400).json("Invalid date format");
            }

            const formattedDate = format(normalizedDate, 'dd.MM.yyyy', { locale: ru });
            application.dateAnswer = formattedDate;
            application.status = "В работе";
            
            application.history.push({ label: `Установлен срок ответа: до ${formattedDate}` });
            await application.save();

            await bot.telegram.sendMessage(id, `<b>🕓 Заявка №${application.normalId}</b> будет рассмотрена до ${formattedDate}.`, {
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.callback('Перейти к заявке', `?detailedApp_${application._id}`)
                ]).resize().reply_markup,
                parse_mode: "HTML"
            });

            res.status(200).send('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send('Failed to send message');
        }
    })
}

export const changeStatus = (app, bot) => {
    app.put("/api/application/change-status/:id", async (req, res) => {
        const { id } = req.params
        const { _id, status } = req.body;
        try {
            const application = await ApplicationModel.findById(_id)
            if (!application) {
                return res.status(404).json("Application not found")
            }
            application.status = status
            application.history.push({ label: `Статус изменен на: ${status}` })
            await application.save()

            await bot.telegram.sendMessage(id, `Статус заявки №${application.normalId} изменен на ${status}.`,
                {
                    reply_markup: Markup.inlineKeyboard([
                        Markup.button.callback('Перейти к заявке', `?detailedApp_${application._id}`)
                    ]).resize().reply_markup
                }
            );

            res.status(200).send('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send('Failed to send message');
        }
    });
};

export const closeApplication = (app, bot) => {
    app.put("/api/application/close-status/:id", upload.fields([
        { name: 'buyerFiles', maxCount: 10 },
        { name: 'sellerFiles', maxCount: 10 }
    ]), async (req, res) => {
        const { id } = req.params;
        const { comments } = req.body;
        
        const buyerFiles = req.files?.buyerFiles?.map(file => file.filename) || [];
        const sellerFiles = req.files?.sellerFiles?.map(file => file.filename) || [];

        try {
            const application = await ApplicationModel.findById(req.body._id);
            if (!application) {
                return res.status(404).json("Application not found");
            }

            application.status = "Отклонена";
            application.buyerDocuments = buyerFiles;
            application.sellerDocuments = sellerFiles;
            
            // Add to history
            const historyEntry = {
                label: "Заявка отклонена",
                files: {
                    buyer: buyerFiles,
                    seller: sellerFiles
                },
                comments: comments
            };
            application.history.push(historyEntry);
            
            await application.save();

            const messageText = `Заявка №${application.normalId} отклонена.${
                comments ? `\nКомментарий:\n${comments}` : ''
            }`;

            await bot.telegram.sendMessage(id, messageText, {
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.callback('Перейти к заявке', `?detailedApp_${application._id}`)
                ]).resize().reply_markup
            });

            res.status(200).send('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send('Failed to send message');
        }
    });
};


export const reviewedApplication = (app, bot) => {
    app.put("/api/application/reviewed/:id", upload.fields([
        { name: 'buyerFiles' },
        { name: 'sellerFiles' }
    ]), async (req, res) => {
        const { id } = req.params
        const { _id, status, comments, admin } = req.body;
        
        const buyerFiles = req.files?.buyerFiles?.map(file => file.filename) || [];
        const sellerFiles = req.files?.sellerFiles?.map(file => file.filename) || [];

        try {
            const updateData = { 
                status,
                buyerDocuments: buyerFiles,
                sellerDocuments: sellerFiles,
                comments
            };

            const application = await ApplicationModel.findByIdAndUpdate(
                _id,
                { $set: updateData },
                { new: true }
            );

            if (!application) {
                return res.status(404).json({ message: 'Application not found' });
            }

            const historyEntry = {
                label: comments || "Добавлены документы",
                admin,
                type: "documents",
                files: {
                    buyer: buyerFiles,
                    seller: sellerFiles
                }
            };
            
            application.history.push(historyEntry);
            application.status = "Рассмотрена"
            await application.save();

            await bot.telegram.sendMessage(id, `✅Заявка №${application.normalId} ${status}!\nНажмите на кнопку ниже, чтобы увидеть ответ`, {
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.callback('Перейти к заявке', `?detailedApp_${application._id}`)
                ]).resize().reply_markup
            });

            res.status(200).send('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send('Failed to send message');
        }
    });
};


export const getClarifications = (app, bot) => {
    app.post("/api/application/get-clarifications/:id", upload.array('files'), async (req, res) => {
        const { id } = req.params;
        const { _id, text, admin } = req.body;
        const files = req.files || [];

        try {
            const application = await ApplicationModel.findById(_id);
            if (!application) {
                return res.status(404).json("Application not found");
            }

            const fileUrls = files.map(file => `https://orders.consultantnlgpanel.ru/api/uploads/${file.filename}`);


            application.status = "На уточнении";
            application.history.push({ label: "Заявка передана на уточнение" });
            application.history.push({ label: "Статус заявки сменен На уточнении" });
            if (text) {
                const historyEntry = { label: text, admin, type: "comment" };
                if (fileUrls.length > 0) {
                    historyEntry.fileUrls = fileUrls;
                }
                application.history.push(historyEntry);
            }
            await application.save();

            let messageText = `По заявке №${application.normalId} требуются уточнения:\n---\n${text}`;
            if (fileUrls.length > 0) {
                messageText += `\n\nФайлы уточнений:`;
                fileUrls.forEach((fileUrl) => {
                    const file = extractFileName(fileUrl)
                    messageText += `\n<a href="${fileUrl}">${file}</a>`;
                });
            }

            await bot.telegram.sendMessage(id, messageText, {
                parse_mode: 'HTML',
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.callback('Отправить уточнение', `clarify_${application._id}`)
                ]).resize().reply_markup
            });

            res.status(200).send('Message sent successfully');
        } catch (e) {
            console.log("clarifications:", e);
            res.status(500).send('Error processing request');
        }
    });
}

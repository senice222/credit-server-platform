import { Markup } from 'telegraf'
import UserModel from '../../../models/User.model.js';

function firstLetter(str) {
    if (!str) return str;

    return str[0].toUpperCase() + str.slice(1);
}

function splitIntoChunks(arr, chunkSize) {
    let chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}

const listApplicationsAction = (bot) => {
    bot.action(["?myApplications", /\?myApplications_(.+)/], async (ctx) => {
        try {
            const user = await UserModel.findOne({ id: ctx.from.id }).populate('applications')
            if (!user || !user.applications.length) {
                await ctx.reply('У Вас нет заявок.')
                return
            }
    
            let buttons = user.applications.map(button => {
                if (button.name.length >= 15) {
                    var buttonTitle = button.name.slice(0, 15) + '...';
                } else {
                    var buttonTitle = `${firstLetter(button.name)}, Номер - ${button.normalId}`;
                }
                const appId = button._id
                return {text: `⭐️ ${buttonTitle}`, callback_data: `?detailedApp_${appId}`}
            })
            buttons.filter(section => section !== null && section !== undefined);
    
            const rows = splitIntoChunks(buttons, 1)
            let pages = [];

            for (let i = 0; i < rows.length; i += 5) {
                pages.push(rows.slice(i, i + 5));
            }
            pages = pages.map((page, i) => {
                let navigationButtons = [];
                let additionalButtons = [];
                
                if (i !== 0) navigationButtons.push({text: '<<', callback_data: '?myApplications_0'});
                if (i !== 0) navigationButtons.push({text: '<', callback_data: '?myApplications_' + (i - 1)});
                navigationButtons.push({text: `[${i+1}/${pages.length}]`, callback_data: '@'});
                if (i !== pages.length - 1) navigationButtons.push({text: '>', callback_data: '?myApplications_' + (i + 1)});
                if (i !== pages.length - 1) navigationButtons.push({text: '>>', callback_data: '?myApplications_' + String(pages.length-1)});
        
                additionalButtons.push({text: `🔙 В главное меню`, callback_data: '?start'});
                
                return [...page, navigationButtons, additionalButtons];
            });

            ctx.editMessageText(
                "Выберите заявку",
                {
                    reply_markup: {
                        resize_keyboard: true,
                        inline_keyboard: pages[ctx.match[1] ? ctx.match[1] : 0],
                    }
                }
            )
        } catch (error) {
            console.error('Error in listApplicationsAction:', error)
            await ctx.reply('Произошла ошибка при загрузке заявок. Пожалуйста, попробуйте снова.')
        }
    })
}
export default listApplicationsAction
import { Telegraf, Scenes, session } from 'telegraf'
import dotenv from 'dotenv'
import startCommand from './bot/commands/start.js';
import startAction from './bot/callbacks/start.js';
import applyCallback from './bot/callbacks/apply_application.js';
import ApplyApplication from './bot/scenes/apply_first_app_scene.js';
import is_registered from './bot/middleware/is_registered.js';
import is_blocked from './bot/middleware/is_user_blocked.js';
import ApplyExistingApplication from './bot/scenes/apply_existing_app_scene.js';
import listApplicationsAction from './bot/callbacks/applications/listApplicationsAction.js';
import detailedApplication from './bot/callbacks/applications/detailedApplication.js';
import downloadFile from './bot/callbacks/applications/downloadFile/downloadFile.js';
import { changeStatus, closeApplication, deleteApplication, getClarifications, reviewedApplication, setDateToAnswer } from './bot/api/user.js';
import sendClarifications from './bot/callbacks/applications/clarifications/send-clarifications.js';
import done from './bot/callbacks/applications/clarifications/done.js';

dotenv.config();

const initBot = (app) => {
    const bot = new Telegraf(process.env.TOKEN);

    bot.use(session())

    const Stage = new Scenes.Stage([
        ApplyApplication,
        ApplyExistingApplication
    ])

    // middlewares
    bot.use(Stage.middleware())
    is_registered(bot)
    is_blocked(bot)
    // api
    setDateToAnswer(app, bot)
    reviewedApplication(app, bot)
    getClarifications(app, bot)
    changeStatus(app, bot)
    closeApplication(app, bot)
    deleteApplication(app, bot)
    // commands 
    startCommand(bot)

    // callbacks    
    startAction(bot)
    applyCallback(bot)
    listApplicationsAction(bot)
    detailedApplication(bot)
    downloadFile(bot)
    sendClarifications(bot)
    done(bot)

    bot.launch().then(() => {
        console.log('Bot is running');
    }).catch(err => {
        console.error('Failed to launch bot:', err);
    });
}

export default initBot
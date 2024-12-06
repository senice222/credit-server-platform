export default (bot) => {
    bot.use(async (ctx, next) => {
        try {
            await next();
        } catch (error) {
            if (error.code === 403 && error.description.includes('bot was blocked by the user')) {
                console.error('Bot was blocked by the user:', ctx.from.id);
            } else {
                console.error('An error occurred:', error);
            }
        }
    });
};
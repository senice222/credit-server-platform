import UserModel from "../../models/User.model.js";

export default (bot) => {
    bot.use(async (ctx, next) => {
        if (ctx.from) {
            const user = await UserModel.findOne({ id: ctx.from.id });
            const username = ctx.from.username ? ctx.from.username : ctx.from.first_name;

            if (!user) {
                const date = new Date()
                const doc = new UserModel({
                    id: ctx.from.id,
                    username,
                    registered: date,
                });
                await doc.save();
            }
        }
        next();
    });
};
import { Markup } from "telegraf"

export const cancelKeyboard = Markup.inlineKeyboard([
    [
        Markup.button.callback("❌ Отменить", "?cancelScene")
    ]
]).resize()

export const formalDeal = Markup.inlineKeyboard([
    [
        Markup.button.callback("Да", "?yes_formal")
    ],
    [
        Markup.button.callback("Нет", "?no_formal"),
    ]
]).resize()

export const anyChanceRequirements = Markup.inlineKeyboard([
    [
        Markup.button.callback("Да", "?yes_chance")
    ],
    [
        Markup.button.callback("Нет", "?no_chance"),
    ]
]).resize()

export const skip = Markup.inlineKeyboard([
    [
        Markup.button.callback("Пропустить", "?skip")
    ]
]).resize()

export const understand = Markup.inlineKeyboard([
    [
        Markup.button.callback('❌ Удалить сообщение', '?delete')
    ]
]).resize()
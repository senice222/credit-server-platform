import mongoose from 'mongoose';
import mongooseSequence from 'mongoose-sequence';

const AutoIncrement = mongooseSequence(mongoose);

const ApplicationSchema = new mongoose.Schema(
    {
        normalId: {
            type: Number,
            unique: true // Поле должно быть уникальным
        },
        name: {
            type: String,
            required: true,
        },
        inn: {
            type: String,
            required: true,
        },
        history: {
            type: [],
            default: []
        },
        status: {
            type: String, // ['Cоздана', 'Рассмотрена', 'Отклонена', 'На рассмотрении', 'В работе']
            default: 'Создана'
        },
        clarificationsAnswer: {
            type: [
                {
                    text: String,
                    files: [String],
                    date: { type: Date, default: Date.now }
                }
            ],
            default: []
        },
        comments: {
            type: String,
            default: ''
        },
        fileAnswer: {
            type: [String],
            default: []
        },
        clarifications: {
            type: Boolean,
            default: false
        },
        dateAnswer: {
            type: String,
            default: ""
        },
        isFormalDeal: {
            type: Boolean,
            default: null // Может быть null
        },
        fileAct: {
            type: [String], // Массив строк (например, ссылки на файлы)
            default: [] // По умолчанию пустой массив
        },
        fileExplain: {
            type: [String],
            default: []
        },
        additionalInformation: {
            type: [String],
            default: []
        },
        actSverki: {
            type: [String],
            default: []
        },
        lastDateActSverki: {
            type: String, // Указано как строка
            default: null
        },
        allDocuments: {
            type: [String],
            default: []
        },
        cart60file: {
            type: [String],
            default: []
        },
        demandsOrganization: {
            type: Boolean,
            required: true
        },
        previousDocuments: {
            type: [String],
            default: []
        },
        owner: {
            type: Number,
            required: true
        },
        buyerDocuments: {
            type: [String],
            default: []
        },
        sellerDocuments: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true // Добавляет поля createdAt и updatedAt
    }
);

// Подключение автоинкремента для поля `normalId`
ApplicationSchema.plugin(AutoIncrement, { inc_field: 'normalId' });

export default mongoose.model('Application', ApplicationSchema);

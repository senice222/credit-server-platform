import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
dotenv.config()

const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: "465",
    secure: true,
    auth: {
        user: "kashamuchi@yandex.com",
        pass: "jphzldrcskhvjvcr",
    },
});

export const sendMail = (application, link, type) => {
    const subject = type === 'clarification'
        ? `Поступили уточнения по заявке №${application.normalId}`
        : `Поступили требования №${application.normalId}`

    const styledEmailContent = `
    <p>Компания: ${application.name}</p>    
    <p>ИНН: ${application.inn}</p>
    <p>Для просмотра ${type === 'clarification' ? 'уточнений и ответа' : 'заявки и ответа'} на заявку перейдите в админ панель: <a href="${link}">ОТКРЫТЬ</a></p>
`   
    const mailOptions = {
        from: '"Ответ на требования" <kashamuchi@yandex.com>', 
        to: process.env.RECEIVER,
        subject,
        html: styledEmailContent
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error)
        } else {
            console.log('Email sent successfully')
        }
    })
}
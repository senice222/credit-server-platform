import ApplicationModel from "../models/Application.model.js"

export const getAll = async (req, res) => {
    try {
        const access = req.access

        if (!access?.includes('Заявки')) {
            return res.status(403).json({message: "Недостаточно прав доступа"})
        }
        const applications = await ApplicationModel.find({})
        if (!applications) {
            return res.status(404).json({
                message: 'Заявки не найдены'
            })
        }
        res.status(200).json(applications);
    } catch (e) {
        console.log("error getting applications:", e)
    }
}

export const getDetailed = async (req, res) => {
    const {id} = req.params
    try {
        const access = req.access

        if (!access?.includes('Заявки')) {
            return res.status(403).json({message: "Недостаточно прав доступа"})
        }
        const application = await ApplicationModel.findById(id)
        if (!application) {
            return res.status(404).json({
                message: 'Заявкa не найдены'
            })
        }
        res.status(200).json(application);
    } catch (e) {
        console.log("error getting application:", e)
    }
}


export const getDetailedCompany = async (req, res) => {
    const { inn } = req.params
    const access = req.access

    try {
        if (!access?.includes('Компании')) {
            return res.status(403).json({message: "Недостаточно прав доступа"})
        }
        const application = await ApplicationModel.find({ inn })
        
        if (!application) {
            return res.status(404).json({
                message: 'Заявка не найдена'
            })
        }

        res.status(200).json(application)
    } catch (e) {
        console.error("Error getting application:", e)
        res.status(500).json({
            message: 'Внутренняя ошибка сервера'
        })
    }
}
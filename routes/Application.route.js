import {Router} from 'express'
import * as applicationService from '../services/Application.service.js'
import checkAdmin from "../utils/checkAdmin.js";


const ApplicationRoute = Router()

ApplicationRoute.get("/application/getAll", checkAdmin, applicationService.getAll)
ApplicationRoute.get("/application/detailed/:id", checkAdmin, applicationService.getDetailed)
ApplicationRoute.get("/application/inn/:inn", checkAdmin, applicationService.getDetailedCompany)


export default ApplicationRoute
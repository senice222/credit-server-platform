import {Router} from 'express'
import * as adminService from '../services/Admin.service.js'
import checkAdmin from "../utils/checkAdmin.js";


const AdminRoute = Router()

AdminRoute.post('/admin/create', checkAdmin, adminService.createAdmin)
AdminRoute.post('/admin/login', adminService.login)
AdminRoute.get('/admin/me', checkAdmin, adminService.getMe)
AdminRoute.put('/admin/changePassword', checkAdmin, adminService.changeUserPassword)
AdminRoute.get('/admins', checkAdmin, adminService.getAdmins)
AdminRoute.get('/admin/:id', checkAdmin, adminService.getUserById)
AdminRoute.delete('/admin/:id', checkAdmin, adminService.deleteAdmin)
AdminRoute.put('/admin/:id', checkAdmin, adminService.changeAdmin)
AdminRoute.post('/admin/generateTransferKey', checkAdmin, adminService.generateTransferKey)
AdminRoute.post('/admin/validateTransferKey', adminService.validateTransferKey)



export default AdminRoute

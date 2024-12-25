import express from 'express'
import path from "path";
import AdminRoute from './routes/Admin.route.js';
import ApplicationRoute from './routes/Application.route.js';

const startServer = (router) => {

    const __dirname = path.resolve();
    router.use('/api', AdminRoute)
    router.use('/api', ApplicationRoute)
    router.use('/api/uploads', express.static(path.join(__dirname, 'api/uploads')));
}

export default startServer
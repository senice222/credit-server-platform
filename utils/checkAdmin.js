import jwt from "jsonwebtoken";
import AdminModel from "../models/Admin.model.js";

const checkAdmin = async (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/Bearer\s?/, "");

    if (!token) {
        return res.status(403).json({
            message: "Нет доступа, 1",
        });
    }
    try {
        const { _id } = jwt.verify(token, "JKzbagGASvas912<<<Zkjf");
        const admin = await AdminModel.findById(_id)

        if (!admin) {
            return res.status(403).json({
                message: "Нет доступа, 3",
            });
        }
        req.userId = _id;
        req.access = admin.access
        req.super = admin.superAdmin
        next();
    } catch (err) {
        console.log(err)

        return res.status(403).json({
            message: "Нет доступа, 2",
        });
    }
};
export default checkAdmin;
import AdminModel from '../models/Admin.model.js';


export async function validateAndDeleteTransferKeyFunction(transferKey) {
    const admin = await AdminModel.findOne({ transferKey });

    if (!admin) {
        throw new Error('Недействительный transferKey');
    }

    // Удаляем transferKey после успешной проверки
    admin.transferKey = null;
    await admin.save();

    console.log('TransferKey успешно использован и удалён:', admin);
    return admin;
}
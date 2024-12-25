import { v4 as uuidv4 } from 'uuid';
import AdminModel from '../models/Admin.model.js';

export async function generateTransferKeyFunction(adminId) {
    const transferKey = uuidv4(); // Уникальный ключ
  
    const updatedAdmin = await AdminModel.findByIdAndUpdate(
      adminId,
      { transferKey },
      { new: true } // Возвращает обновлённый документ
    );
  
    if (!updatedAdmin) {
      throw new Error('Администратор не найден');
    }
  
    console.log('TransferKey создан:', updatedAdmin);
    return transferKey;
  }
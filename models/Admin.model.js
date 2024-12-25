import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema(
    {
        login: {
            type: String,
            required: true
        },
        access: [String],
        modulesAccess: {
            type: [String],
            default: []
        },
        superAdmin: true,
        passwordHash: {
            type: String,
            required: true
        },
        comment: {
            type: String,
            default: '',
        },
        superAdmin: {
            type: Boolean,
            default: false
        },
        transferKey: {
            type: String,
            default: null
        }
    }
);

export default mongoose.model('Admin', AdminSchema);
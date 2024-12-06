import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema(
    {
        login: {
            type: String,
            required: true
        },
        access: [String],
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
        }

    }
);

export default mongoose.model('Admin', AdminSchema);
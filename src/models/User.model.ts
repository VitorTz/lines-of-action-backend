import mongoose, { Schema, Document } from 'mongoose';


export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  perfilImageUrl?: string;
  createdAt: Date;
}


const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  perfilImageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now }
});


const User = mongoose.model<IUser>('User', userSchema);


export default User;
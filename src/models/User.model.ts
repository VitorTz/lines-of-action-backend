import mongoose, { Schema, Document } from 'mongoose';
import { IAddress, addressSchema } from './Address.model';


export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  perfilImageUrl?: string;
  age: number;
  createdAt: Date;
  address: IAddress;
}


const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  password: { type: String, required: true },
  perfilImageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  address: { type: addressSchema, required: true }
});


const User = mongoose.model<IUser>('User', userSchema);


export default User;
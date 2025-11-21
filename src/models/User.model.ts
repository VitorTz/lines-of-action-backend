import mongoose, { Schema, Document } from 'mongoose';
import { IAddress, addressSchema } from './Address.model';


export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  perfilImageUrl?: string;
  age: number;
  rank: number;
  createdAt: Date;
  address: IAddress;
}


export interface UserResponse {
  id: string
  username: string
  email: string
  rank: number
  perfilImageUrl: string | null
  age: number
  address: IAddress
  createdAt: string
}


const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  rank: { type: Number, required: true, default: 0 },
  age: { type: Number, required: true },
  password: { type: String, required: true },
  perfilImageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  address: { type: addressSchema, required: true }
});


const User = mongoose.model<IUser>('User', userSchema);


export function getUserResponse(user: any): UserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    rank: user.rank,
    perfilImageUrl: user.perfilImageUrl,
    age: user.age,
    address: user.address,
    createdAt: user.createdAt.toISOString()
  }
};


export default User;
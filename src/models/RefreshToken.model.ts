import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User.model';


export interface IRefreshToken extends Document {
  userId: IUser['_id'];
  token: string;
  createdAt: Date;
}


const refreshTokenSchema = new Schema<IRefreshToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});


const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);


export default RefreshToken;
import { Schema } from 'mongoose';

export interface IAddress {
    
  city: string;
  state: string;
  country: string;

}



export const addressSchema = new Schema<IAddress>(
  {
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);


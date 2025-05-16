import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config();

const connectToDB = async () =>{
    try{
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected to DB');
    }
    catch(err){
        console.log('error with DB', err);
    }
}

export default connectToDB
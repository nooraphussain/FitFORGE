const mongoose = require('mongoose')
require('dotenv').config();

//conneting database
const connectDB = () => {
    mongoose.connect(process.env.mongoURI) .then(() => {
        console.log('Successfully connected to the database');
    }) .catch((error) => {
        console.log('error while connecting to the database', error);
        process.exit(1)
    })
}


module.exports = {
    connectDB
}
const mongoose = require('mongoose');

const userCollection = 'user';

const userSchema = new mongoose.Schema(
{
    username: {type: String, max: 100},
    password: {type: String, max:1000}
});
 
const users = mongoose.model(userCollection, userSchema);

module.exports = {
    users
}
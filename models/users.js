var mongoose = require('mongoose');
var userSchema = new mongoose.Schema({
  _id: String,
  status: String,
  pic: String,
  name: String,
  state: String,
  distance: Number,
  days: String,
  lastMessage:String,
  location: String
});
module.exports = mongoose.model('users', userSchema);
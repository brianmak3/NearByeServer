var mongoose = require('mongoose');
var messageSchema = new mongoose.Schema({
   from: String, 
   to: String, 
   messages: [
    {  id:Number,
      time: String,
      date: String,
      read: String,
      text: String,
      media:  String,
      location: String, 
      friend: String
    }
   ]
});
module.exports = mongoose.model('drafts', messageSchema);

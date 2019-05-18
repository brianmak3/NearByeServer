
const
  express = require('express'),
  app = express(),
  http = require('http').Server(app),
   groupArray = require('group-array'),
  io = require('socket.io')(http),
  mongo = require('mongodb').MongoClient,
  cors = require('cors'),
   fs = require('fs'),
  ObjectId = require('mongodb').ObjectId,
  multer = require('multer'),
  mergeByKey = require("array-merge-by-key");
  path = require('path'),
  mongoose = require('mongoose'),
 storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
         callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`);
    }

});
 var upload = multer({ storage : storage, limits: { fieldSize: 10 * 1024 * 1024 }}).single('image'),
  Users = require('./models/users'),
   DraftMessages = require('./models/messages');
 mongoose.connect('mongodb://nearby:nearby@127.0.0.1/nearBy');
   //mongoose.connect('mongodb://127.0.0.1/nearBye',{ useNewUrlParser: true } );
const WebSocket = require('ws');
 
const wss = new WebSocket.Server({
  port: 8080,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }

});
app.use(cors());
app.use(express.static('www'));
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
// home
app.get('/', (req, res) => {
  res.send('Unknown origin.');
});
app.post('/imageChat',(req, res)=>{
   upload(req, res, function (err) {
            if (err)
                console.log(err);
           else{
              var url = req.body.url+'//uploads/';
                var pic = url + req.file.filename;
                res.status(201).json(pic);
            }
         })
 })
app.post('/imagePost',(req, res)=>{
   upload(req, res, function (err) {
            if (err)
                console.log(err);
           else{
              var url = req.body.url+'//uploads/';
                var pic = url + req.file.filename,
                 userId  = req.body.info;
                res.status(201).json(pic);
                deleteImage(userId);
                //socketemit to friends to change profile pic
                Users.updateOne({'_id': userId}, {$set: {'pic': pic}}, function (err) {
                    if (err)
                        throw err;
                });
           }

        })
})


// setup socket.io
wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

wss.on('connection', function(socket){
    socket.on('message', function(info){
      var datax = JSON.parse(info);
      if(datax.id){
        socket.userId = datax.id;
        updateSocketId(socket.userId ,socket, 'Online');
     }
      var data = datax.data;
      switch(data.action){
        case 'signup':
        var signupData = data;
         Users.findOne({_id: data._id}, {__v:0}, function(err, user){
                  if(err)
                    throw err;
                  if(!user){
                      var newUser = new Users;
                      newUser._id = signupData._id
                      newUser.status = signupData.status;
                      newUser.pic = signupData.pic;
                      newUser.state = 'Online';
                      newUser.name = signupData.name;
                      newUser.save(function(err){
                        if(err)
                          throw err;
                        socket.send(JSON.stringify({
                             action: 'signup',
                             datam: newUser
                          }));
                      })
                  }else
                    socket.send(JSON.stringify({
                     action: 'signup',
                     datam: user
                  }));
                  
                 
          });
         break;
         case 'findUsers':
           var friends = data.friends.filter((cont)=>{return cont !==null});
           var conts = friends.map(a  => a._id);
          Users.find({_id: {$in:conts}},{pic:1, _id:1, status:1}, function(err, users){
              if(err)
                throw err
              else{
                  var usersFound = users.map(x => Object.assign(x, friends.find(y => y._id == x._id)))
                  var datam = {
                    action: 'foundUsers',
                    datam: usersFound
                  }
                socket.send(JSON.stringify(datam));
              }
         })
          break;
          case 'draftsSent':
           /*data.chats.map((a)=>{
            })*/
            var chats = groupArray(data.chats, 'to');
            Object.values(chats).map((a)=>{
                a = a.map(function(item) {item.friend = item.from; return item; });
                checkAndSendText(socket,a,a[0].to, a[0].from);
            })
          break;
          case 'logOut':
             console.log(data);
          break;
           case 'newChat':
             var msg = [data.msg].map(function(item) {item.friend = item.from; return item; });;
              checkAndSendText(socket,msg, data.msg.to, data.msg.from);
              //console.log(data)
           break;
          case 'checkOnline':
           Users.findOne({'_id':data.friendId},{_id:1,state:1},function(err, user){
              if(err)
                 throw err;
               else
                { 
                  socket.send(JSON.stringify({action:'userStatus',datam:user}));
                  if(data.friendId)
                    console.log('update all as read from friend');
                }

             })
            sendReadStatus({
              updateVal: 'read',
              friend: data.myId,
              from: data.friendId
           })
          break;
          case 'removeProfile':
              Users.findOne({'_id': data.user}, {pic:1, _id:0}, function (err, userx) {
                    if (err)
                        throw err;
                    else {               
                     var rem = 'public/'+userx.pic.split('//')[2];
                        if (userx.pic !== 'avatar') {
                               fs.unlink(rem, function (e) {
                            });
                        }
                        Users.updateOne({'_id': data.user}, {$set: {'pic': 'avatar'}}, function (err) {
                    if (err)
                        throw err;
                    socket.send(JSON.stringify({action:'removeProfile', data:data}));
                    //remove dpic from friends
                });
                    }
                });
          break;
          case 'updateUser':
           var userData = data.data;
           if(userData.pic== 'avatar')deleteImage(userData._id);
           Users.updateOne({_id: userData._id}, {$set: userData}, function(err){
              if(err)
                 throw err;
               //send update to friends and if not online, in there freindsList
            })
           break;
           case 'updateReadAll':
                    sendReadStatus(data);
           break;
           case 'lastSeen':
                broadCast(JSON.stringify(data));
           break;
      }

    })
    socket.on('close',function(){
      updateSocketId(socket.userId ,socket, ''+Date.now());
    })

      socket.on('findUsers', function(data){
         Users.find({_id: {$in:data}},{pic:1, _id:1, status:1}, function(err, users){
              if(err)
                throw err
              else
                socket.emit('foundUsers', users);
                
              
         })
      });
});
function getDrafts(userId, socket){
   DraftMessages.find({to: userId}, {_id:0, 'messages._id':0},function(err,msgs){
        if(err)
          throw err;
        else if(msgs.length > 0){
        socket.send(JSON.stringify({action: 'DraftsChats', datam:msgs}));
        DraftMessages.deleteMany({to: userId}, function(err){
         if(err)
           throw err;
       })
      }

    });
}
function updateSocketId(userId,socket,status){
   if(status !== 'Online'){
    var date = new Date(parseInt(status));
    status = date.toString().substr(0,21);
  }else{
    getDrafts(userId, socket)
  }
  
   Users.updateOne({_id:userId},{$set:{ state:status}}, function(err, res){
    if(err)
       throw err
     else 
       broadCast(JSON.stringify({action:'userStatus',datam:{state:status, _id:userId}}))
   })
}
function broadCast(data){
    wss.clients.forEach(function each(client){
      if (client.readyState === WebSocket.OPEN) {
       client.send(data);
    }
    })
}
function deleteImage(userId){
   Users.findOne({'_id': userId}, {pic:1, _id:0}, function (err, user) {
          if (err)
              throw err;
          else {
           var rem = 'public/'+user.pic.split('//')[2];
              if (user.pic !== 'avatar') {
                     fs.unlink(rem, function (e) {
                  });
              }
          }
      });
}
function checkAndSendText(socket,message, to, from){
   Users.findOne({_id:to},{_id:0,state:1},function(err,res){
    if(err)
       throw err
     else{
      var update;
       if(res.state == 'Online'){
            update = 'done-all';
            broadCast(JSON.stringify({action: 'newMessage', datam:message}))
       }else{
           update =  'checkmark';
         DraftMessages.findOne({to: to,from:from},{messages:0},function(err, res){
            if(err)
               throw err;
             else if(res){
              DraftMessages.updateOne({to: to,from:from},{$push:{messages: message}},function(err){
                if(err)
                  throw err;
              })
             }else{
                var newDraft = new DraftMessages();
                newDraft.from = from;
                newDraft.to = to;
                newDraft.messages = message;
                newDraft.save(function(err){
                  if(err)
                    throw err;
                })
             }
         })
       }
       //do a notification here.
       sendReadStatus({
            updateVal: update,
            friend: to,
            from:from
           })
         
       }
   })
}
function sendReadStatus(data){
            broadCast(JSON.stringify({action: 'updateRead', datam:data}))
}

function removeuser(id){
   Users.updateOne({$or:[{socketId: id},{_id: id}]},{$set: {state: Date.now(), socketId: '', location: {lat: '', lng: ''}} }, 
           function(err, res){
            if(err)
              throw err;
          })
}
const port = process.env.PORT || 3001;
http.listen(port, () => {
  console.log('listening on port', port);
});

function socketEmit(socket, data, thirdParty){
   if(thirdParty){
    socket.emit('serverData', data);
    socket.broadcast.emit('serverData', data);
   }else{
    socket.emit('serverData', data);
   }
}

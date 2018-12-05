'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var shortid = require('shortid');
var validUrl = require('valid-url');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

const connectOptions = {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE
};
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URI, connectOptions, (err, db) => {
  if (err) console.log(`Error`, err);
  console.log(`Connected to MongoDB`);
});



app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));


app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});



app.route('/api/shorturl/new')
    .post( (req,res, next) => {
  //connect to database
  mongo.MongoClient.connect(process.env.MONGO_URI, (err, db) => {
        if (err) {
          console.log("Unable to connect to server", err);
        } else {
          console.log("Connected to server");
          let collection = db.collection('links');
          let url = req.body.url;
          let host = req.get('host') + "/"
          console.log(url);
          //function to generate short link 
          let generateLink = function(db, callback) {
            //check if url is valid - UserStory1
            if (validUrl.isUri(url)){
              collection.findOne({"url": url}, {"short": 1, "_id": 0}, (err, doc) =>{
                if(doc != null){
                  res.json({
                  "original_url": url, 
                  "short_url":host + doc.short
                });
                }
                else{
                   //generate a short code
                    let shortCode = shortid.generate();
                    let newUrl = { url: url, short: shortCode };
                    collection.insert([newUrl]);
                      res.json({
                        "original_url":url, 
                        "short_url":host + shortCode
                      });
                }
              });
            }
            //give error when url is invalid - UserStory 2
            else {
                console.log('Not a URI');
                res.json({
                  "error": "Invalid url"
                })
            }
          };
          
          generateLink(db, function(){
            db.close();
          });
        }
  }); 
});

//given short url redirect to original url - UserStory 3
app.route('/:short')
    .get( (req,res, next) => {
  mongo.MongoClient.connect(process.env.MONGO_URI, (err,db) => {
    if (err) {
          console.log("Unable to connect to server", err);
        } else {
          let collection = db.collection('links');
          let short = req.params.short;
          
          //search for original url in db and redirect the browser
          collection.findOne({"short": short}, {"url": 1, "_id": 0}, (err, doc) => {
            if (doc != null) {
              res.redirect(doc.url);
            } else {
              res.json({ error: "Shortlink not found in the database." });
            };
          });
        }
    db.close();
  });
});

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});

'use strict';

//dependencies
var config = require('./config'),
    express = require('express.io'),
    mongoStore = require('connect-mongo')(express),
    http = require('http'),
    path = require('path'),
    passport = require('passport'),
    mongoose = require('mongoose');

var app;
//create express app
app=express();
//app.server = http.createServer(app);
/* hook in io?*/
app.http().io();
app.io.set('log level', 3); 
app.io.set('transports', [  'xhr-polling', 'websocket' ]); 


var allowCrossDomain = function(req, res, next) { 
    res.header("Connection", "Upgrade"); 
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Headers", "X-Requested-With"); 
    next(); 
} 

//setup the web server
/*
var io = require('socket.io').listen(app.server);
*/


//setup mongoose
app.db = mongoose.createConnection(config.mongodb.uri);
app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
app.db.once('open', function () {
  //and... we have a data store
});

//config data models
require('./models')(app, mongoose);

//setup the session store
app.sessionStore = new mongoStore({ url: config.mongodb.uri });

//config express in all environments
app.configure(function(){
  //settings
  app.disable('x-powered-by');
  app.set('port', config.port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('strict routing', true);
  app.set('project-name', config.projectName);
  app.set('company-name', config.companyName);
  app.set('system-email', config.systemEmail);
  app.set('crypto-key', config.cryptoKey);
  app.set('require-account-verification', false);

  //smtp settings
  app.set('smtp-from-name', config.smtp.from.name);
  app.set('smtp-from-address', config.smtp.from.address);
  app.set('smtp-credentials', config.smtp.credentials);

  //twitter settings
  app.set('twitter-oauth-key', config.oauth.twitter.key);
  app.set('twitter-oauth-secret', config.oauth.twitter.secret);

  //github settings
  app.set('github-oauth-key', config.oauth.github.key);
  app.set('github-oauth-secret', config.oauth.github.secret);

  //facebook settings
  app.set('facebook-oauth-key', config.oauth.facebook.key);
  app.set('facebook-oauth-secret', config.oauth.facebook.secret);

  //middleware
  app.use(allowCrossDomain);
  app.use(express.favicon(__dirname + '/public/favicon.ico'));
  app.use(express.logger('dev'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());

  //app.use(express.cookieSession());
  app.use(express.session({
    secret: config.cryptoKey,
    store: app.sessionStore
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);

  //error handler
  app.use(require('./views/http/index').http500);

  //global locals
  app.locals.projectName = app.get('project-name');
  app.locals.copyrightYear = new Date().getFullYear();
  app.locals.copyrightName = app.get('company-name');
  app.locals.cacheBreaker = '';
});

//config express in dev environment
app.configure('development', function(){
  app.use(express.errorHandler());
});

//setup passport
require('./passport')(app, passport);

//route requests
require('./routes')(app, passport);

//setup utilities
require('./utilities')(app);

//listen up
//app.server.listen(app.get('port'),'162.243.253.40', function(){
app.server.listen(app.get('port'),'localhost', function(){
  //and... we're live
});

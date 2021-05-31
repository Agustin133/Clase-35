const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const handlebars = require('express-handlebars');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const {fork} = require('child_process');
const compression = require('compression');
const log4js = require('log4js');
const nodemailer = require('nodemailer');

const passport = require('passport');
const bCrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy

const { options } = require('./conection')
const { users } = require('./create_model');
const { Server, request } = require('http');
const { query } = require('express');

const app = express();
app.use(compression());
app.use(express.urlencoded({extended: true}));
app.use(flash());

app.use(cookieParser());
app.use(session({
    store: MongoStore.create({ 
        mongoUrl: 'mongodb://localhost/sesiones',
        ttl: 10 * 60, // 10 min
    }),
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 6000
    }
}));

app.engine("hbs",handlebars({
    extname: ".hbs",
    defaultLayout: "index.hbs",
  })
);

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
      user: 'lilly30@ethereal.email',
      pass: 'hyXzjK3AAHBpXawP73'
  }
});

const mailoptionsLogIn = {
  from: 'Servidor Node.js',
  to: 'lilly30@ethereal.email',
  subject: 'LogIn',
  html: '<h1>Usuario logeado con Facebook</h1>'
}

const transporterGmail = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: 'obertiagustin6@gmail.com',
    pass: 'agusoberti775'
  }
})

const mailoptions = {
  from: 'Servidor Node.js',
  to: 'obertiagustin6@gmail.com',
  subject: 'LogIn',
  html: '<h1>Usuario logeado con Facebook</h1>',
  attachments: [
      {
        path: 'facebook-logo-1.png'
      }
  ]
}

const accountSid = 'ACdaf5250c03d4bbfbf4062723ff84ea3e';
const authToken = 'c3f1460834be7419690286649f5da72d';

const client = require('twilio')(accountSid, authToken);

log4js.configure({
  appenders: {
      console: {type: 'console'},
      fileWarn: {type: 'file', filename: './src/logger/warn.log'},
      fileErr: {type: 'file', filename: './src/logger/err.log'}
  },
  categories: {
      default: {appenders: ['console'], level: 'trace'},
      fileWarn: {appenders: ['fileWarn'], level:'warn'},
      fileErr: {appenders: ['fileErr'], level: 'error'}
  }
})

const loggerFileWarn = log4js.getLogger('fileWarn');
const loggerFileErr = log4js.getLogger('fileErr');
const loggerConsole = log4js.getLogger();

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    "login",
    new LocalStrategy(
      {
        passReqToCallback: true,
      },
      (req, username, password, cb) => {
        users.findOne({ username: username }, (err, user) => {
          if (err) return done(err);
          if (!user) {
            loggerFileErr.error(`User not found with username ${username}`);
            loggerConsole.error(`User not found with username ${username}`);
            return cb(null, false);
          }
          if (!validatePassword(user, password)) {
            loggerFileWarn.warn('Invalid password');
            loggerConsole.warn('Invalid password');
            return cb(null, false);
          }
        return cb(null, user);
      });
    }
  )
);

const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || '306795227722812';
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET || '18b872c4f425ad399a451e8a6d11de5e';
passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_CLIENT_ID,
      clientSecret: FACEBOOK_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/callback",
    },
    function (accessToken, refreshToken, profile, cb) {
      const findOrCreateUser = function () {
        users.findOne({ facebookId: profile.id }, function (err, user) {
          if (err) {
            loggerFileErr.error('Error in SignUp');
            loggerConsole.error(`Error in SingUn: ${err}`);
            return cb(err);
          }
          if (user) {
            loggerFileWarn.warn('user already exists');
            loggerConsole.warn('user already exists');
            return cb(null, false);
          } else {
            var newUser = new users();
            newUser.facebookId = profile.id;
            newUser.username = profile.displayName;
            newUser.save((err) => {
              if (err) {
                loggerFileErr.error('Error in saving user');
                loggerConsole.error(`Error in saving user: ${err}`);
                throw err;
              }
              loggerConsole.info('User registration succesful');
              transporter.sendMail(mailoptionsLogIn, (err, info) => {
                if(err) {
                    console.log(err);
                    return err
                }
                console.log(info)
              });
              transporterGmail.sendMail(mailoptions, (err, info) => {
                if(err) {
                    console.log(err);
                    return err
                }
                console.log(info)
              });
              return cb(null, newUser);
            });
          }
        });
      };
      process.nextTick(findOrCreateUser);
    }
  )
);

const validatePassword = (user, password) => {
  return bCrypt.compareSync(password, user.password);
};
  
passport.use("register",new LocalStrategy({
        passReqToCallback: true,
      },
      function (req, username, password, cb) {
        const findOrCreateUser = function () {
          users.findOne({ username: username }, function (err, user) {
            if (err) {
              loggerFileErr.error(`Error in SignUp`);
              loggerConsole.error(`Error in SignUp: ${err}`);
              return cb(err);
            }
            if (user) {
              loggerFileWarn.warn('User already exists');
              loggerConsole.warn('User already exists');
              return cb(null, false);
            } else {
              var newUser = new users();
              newUser.username = username;
              newUser.password = createHash(password);
              newUser.save((err) => {
                if (err) {
                  loggerFileErr.error('Error in saving user');
                  loggerConsole.error(`Error in saving user: ${err}`);
                  throw err;
                }
                client.messages.create({
                  body: 'Bienvenido!! Acabas de registrarte en Mi App <3',
                  from: '+13852037580',
                  to: '+543547598775'
              }).then(message => loggerConsole.info(message.sid))
                .catch(err => console.log(err))
                loggerConsole.info("User Registration succesful");
                return cb(null, newUser);
              });
            }
          });
        };
      process.nextTick(findOrCreateUser);
    }
  )
);
  
let createHash = function (password) {
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
};
  
passport.serializeUser((user, done) => {
  done(null, user._id);
});
  
passport.deserializeUser((id, done) => {
  users.findById(id, function (err, user) {
    done(err, user);
  });
});

app.use((req, res, next) => {
  app.locals.messages = req.flash('success');
  next();
});

app.use(require('./routes/index'));

const PORT = process.env.PORT || 3000;
app.listen( PORT, () => {
    loggerConsole.trace(`Server on port: http://localhost:${PORT}`);
});

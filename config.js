'use strict';

exports.port = process.env.PORT || 9090;
exports.mongodb = {
  uri: process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'localhost/dev_lexycross'
};
exports.companyName = 'Athuga';
exports.projectName = 'DEV VERSION || lexyCross';
exports.systemEmail = 'grokcore@gmail.com';
exports.cryptoKey = 'xtcK3YBdc4t';
exports.smtp = {
  from: {
    name: process.env.SMTP_FROM_NAME || exports.projectName +' Website',
    address: process.env.SMTP_FROM_ADDRESS || 'admin@lexycross.com'
  },
  credentials: {
    user: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    host: process.env.SMTP_HOST || 'localhost',
    ssl: false
  }
};
exports.oauth = {
  twitter: {
    key: process.env.TWITTER_OAUTH_KEY || '',
    secret: process.env.TWITTER_OAUTH_SECRET || ''
  },
  facebook: {
    key: process.env.FACEBOOK_OAUTH_KEY || '577711672343844',
    secret: process.env.FACEBOOK_OAUTH_SECRET || 'a49b672a5a8a32d18ea6009203c9eb05'
  },
  github: {
    key: process.env.GITHUB_OAUTH_KEY || '',
    secret: process.env.GITHUB_OAUTH_SECRET || ''
  }
};

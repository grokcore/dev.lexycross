'use strict';

var renderSettings = function(req, res, next, oauthMessage) {
    res.render('account/game/index', { });
};

exports.init = function(req, res, next){
  renderSettings(req, res, next, '');
};


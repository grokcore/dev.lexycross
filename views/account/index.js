'use strict';

exports.init = function(req, res){
  if (req.isAuthenticated()) {
      if (typeof(req.session.joinId)=='string') {
        var id=req.session.joinId;
        req.session.joinId=false;
        req.session.joinId=false;
        res.redirect('/game/playGame/?game='+id);
        return;
      }
  }
  res.render('account/index',{randomName:'Default'});

};


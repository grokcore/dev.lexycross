'use strict';

var gameCopy=require('gamecopy.js').copy();

exports.init = function(req, res) {
    var filters={};
    var playerFilter={}; 
    var stateFilter={ $or: [ {state:'INPROGRESS'},{state:'WAITING'} ] };
    playerFilter['playerIndex.'+req.user._id] = { $exists: true };
    filters={ $or: [ playerFilter, stateFilter ] };

    req.app.db.models.Games.find( filters,function(err,games) {
        if (err) {
            throw(err);
            return;
        }
		res.render('account/games/index',{ 
            games:games ,
            gameCopy:gameCopy
        });
	});

};

'use strict';

/* for grep dict search */
var exec = require('child_process').exec;
/* lang file */
require('gamecopy.js');

/* start your engines */
exports.init = function(req, res) {
    var _do;

    if (!req.isAuthenticated()) {
        if (!req.session.joinId)
            if (req.query.game) {
                var gameId = req.query.game.toString().replace(/[^a-z0-9]/, '');
                req.session.joinId=gameId;
            }
        res.redirect('/');
        return false;
    }

    /* call one of the externally accessible game functions */
    if (typeof(serve[(_do = 'do_' + req.params)]) == 'function') {
        serve[_do](req, res);
    }

}

var serve = {
    loadBoard: [],
    placedBoard: [],
    board: [],
    bonus: [],
    size: 15,
    /* Letter, value and total in box */
    rank: {
        "A": ["1", "9"],
        "B": ["3,", "2"],
        "C": ["3", "2"],
        "D": ["2", "4"],
        "E": ["1", "12"],
        "F": ["4", "2"],
        "G": ["2", "3"],
        "H": ["4", "2"],
        "I": ["1", "9"],
        "J": ["8", "1"],
        "K": ["5", "1"],
        "L": ["1", "4"],
        "M": ["3", "2"],
        "N": ["1", "6"],
        "O": ["1", "8"],
        "P": ["3", "2"],
        "Q": ["10", "1"],
        "R": ["1", "6"],
        "S": ["1", "4"],
        "T": ["1", "6"],
        "U": ["1", "4"],
        "V": ["4", "2"],
        "W": ["4", "2"],
        "X": ["8", "1"],
        "Y": ["4", "2"],
        "Z": ["10", "1"],
        "_": ["0", "2"]
    },

    do_dumpGame: function(req, res) {
        req.app.db.models.Games.findOne({
            _id: req.query.id
        }, function(err, game) {
            res.send(game);
        });
    },
    do_getGames: function(req, res) {
        var search = {
            isprivate: false,
            status: 'WAITING'
        };
        if (req.query.name) {
            search = {
                $or: [{
                    name: new RegExp('.*' + req.query.name + '.*', 'i')
                }, {
                    'players.name': new RegExp('^' + req.query.name + '$', 'i')
                }]
            };
        }
        req.app.db.models.Games.find(search, 'name totalplayers players.name isprivate', function(err, games) {
            res.send(games);
        });
    },
    do_playGame: function(req, res) {
        if (!req.query.game) {
            res.redirect('/?noGame');
            return;
        }
        var gameId = req.query.game.toString().replace(/[^a-z0-9]/, '');
        if (!req.user) {
            res.redirect('/?noSession');
            return;
        }
        req.app.db.models.Games.findOne({
            _id: gameId
        }, function(err, game) {
            var turn = 0;
            var hasPlayerAt = false;
            var isCreator=false;
            if (err) throw err;

            var userId = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.user._id.toString()).digest('hex');

            if (game.creator==req.user._id) isCreator=true;

            /* is the user part of the game ? */
            for (var i in game.players)
                if (userId == game.players[i].id)
                    hasPlayerAt = i;

            if (game.players.length == game.totalplayers) {
                game.status = 'INPROGRESS';
                game.started=new Date();
                game.save(function(err, game) {});
            }

            /* render the game / send notice or see if they can join */
            if (hasPlayerAt) {
                var player = game.players[game.turn];
                res.render('lexicross/game/index', {
                    gameId: serve.cleanId(gameId),
                    status: game.status,
                    game: game,
                    player: player,
                    isCreator: isCreator
                }, function(err, out) {
                    req.app.io.route('ready', function(_req) {
                        var player = game.players[game.turn];
                        var turnId = player.id;
                        if (player.useAI) {
                            serve.useAI(req,res,game);
                        }
                        /* emit our new state */
                        var emit = {
                            status: game.status,
                            turnId: turnId,
                            tilesleft: game.box.length,
                            scoreboard: game.scoreboard,
                            turn: turn,
                            board: game.board,
                            players: game.players
                        };
                        _req.io.join(userId);/* socket interface to player */
                        _req.io.join(game._id); /* socket interface to all players */
                        _req.io.room(game._id).broadcast('updateGame', emit);
                        _req.io.emit('updateGame', emit);
                        _req.io.emit('updateRack', {
                            rack: game.players[hasPlayerAt].rack
                        });
                    });
                    res.send(out);
                });
            } else {
                if (game.password) {
                    var password = req.body.password ? req.body.password : '';
                    password = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(password).digest('hex');
                    if (game.password != password) {
                        res.render('lexicross/game/login', {
                            gameId: serve.cleanId(gameId)
                        });
                    }
                }
                serve.do_joinGame(req, res);
            }
        });
    },
    do_newGame: function(req, res) {
        var password = "";
        var board = [];
        var game = {};
        var isPrivate = req.body.isprivate == 'private' ? true : false;
        var submitError = false;
        var gameName = req.body.gamename;
        var totalPlayers = parseInt(req.body.totalplayers);
        var userId = req.user._id || false;

        req.newGame=true;/* for joinGame newAIs */
        /* session lost, bail to home page */
        if (userId == false) {
            res.redirect('/?noSession');
            return;
        }

        gameName = gameName.replace(/[^A-Za-z0-9\!\'\$\#\@\ \-\_]/g, '');
        if (!gameName || gameName != req.body.gamename) {
            res.send({
                error: true,
                message: "INVALID NAME",
                success: false
            });
            return;
        }

        if (totalPlayers > 4 || totalPlayers < 1) {
            res.send({
                error: true,
                message: "INVALID PLAYER COUNT",
                success: false
            });
            return;
        }

        password = req.body.password ? (require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.body.password).digest('hex')) : '';
        board = serve.initBoard();

        /* Fill the box of tiles / 'bag of letters' */
        var box = [],
            total = 0;
        for (var l in serve.rank) {
            total = parseInt(serve.rank[l][1]);
            for (var c = 0; c < total; c++) box.push(l);
        }

        box = serve.shakeBox(box);

        game = new req.app.db.models.Games({
            created: new Date(),
            rank: serve.rank,
            box: box,
            scoreboard: [],
            status: 'WAITING',
            movecount: 0,
            board: board.gameboard,
            gameoptions: { dictionary: (req.body.dictionary=='TWL06'||req.body.dictionary=='sowpods'?req.body.dictionary:'sowpods') },
            shadowboard: board.gameboard,
            size: board.size,
            bonus: board.bonus,
            isprivate: isPrivate,
            totalplayers: totalPlayers,
            name: gameName,
            password: password,
            creator: req.user._id,
            turn: 0,
            players: []
        });

        game.save(function(err, game) {
            req.body.id = req.query.game = game._id;
            serve.do_joinGame(req, res);
        });

    },

    do_listGames: function(req, res) {
        req.app.db.models.Games.find({
            isprivate: false
        }, function(err, games) {
            var list = [];
            for (var i in games) {
                if (games[i].isprivate == true) continue;
                list.push({
                    name: games[i].name
                });
            }
            res.send(list);
        });
    },

    do_getGameData: function(req, res) {
        var id = serve.cleanId(req.query.game)
        req.app.db.models.Games.findOne({
                _id: id
            },
            function(err, game) {
                var rack = [];
                if (err) {
                    throw err;
                }
                var userCryptID = serve.crypt(req.user.id, req);

                for (var i in game.players)
                    if (userCryptID == game.players[i].id) rack = game.players[i].rack;

                res.send("var scoreboard=" + JSON.stringify(game.scoreboard) + ";var players=" + JSON.stringify(game.players) + ";var rank=" + JSON.stringify(serve.rank) + ";var bonus=" + JSON.stringify(game.bonus) + ";var board=" + JSON.stringify(game.board));

            }
        );
    },

    do_addAI: function(req, res) {
        console.log('adding AI');
        var res = res;
        var id = serve.cleanId(req.query.game);
        
        req.app.db.models.Games.findOne({ 
            _id: id
        }, function(err, game) {
            if (err) throw(err);

            var user = {
                id: serve.crypt('brain_'+(new Date()).getTime(),req),
                left: false,
                useAI: true,
                board: game.board,
                index: game.players.length,
                isActive: true,
                name: 'Silicon #'+game.players.length,
                score: 0,
                playedWords: [],
                rack: serve.pullTiles(7, game.box)
            };
            game.players.push(user);

            game.save( function(err,game){ 
                if (err) throw(err); 
                //try { res.send({ok:true}); } catch() {}
            });
        });
    },
    do_joinGame: function(req, res) {
        //Can join game?
        var id = req.query.game;
        req.session.gameId = id;
        req.app.db.models.Games.findOne({
            _id: id
        }, function(err, game) {
            if (err) throw (err);

            if (game.players.length==game.totalplayers) {
                res.redirect('/account/?gameFull');
            }

            var password = req.body.password ? req.body.password : '';
            password = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(password).digest('hex');

            if (game.password && game.password != password) {
                return res.send({
                    error: 'NOAUTH',
                    success: false
                });
            }

            /* They've already joined */
            var userId = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.user._id.toString()).digest('hex');
            for (var i in game.players)
                if (userId == game.players[i].id) {
                    res.redirect('/game/playGame?game=' + game._id);
                    return;
                }

            if (game.status == 'INPROGRESS') {
                res.redirect('/account/?gameInProgress');
                return;
            }

            var user = {
                id: userId,
                left: false,
                index: game.players.length,
                isActive: req.user.isActive,
                name: req.user.roles.account.name.full,
                score: 0,
                playedWords: [],
                rack: serve.pullTiles(7, game.box)
            };

            game.players.push(user);

            var playerIndex = game.playerIndex;
            playerIndex[req.user._id] = true;
            game.playerIndex = playerIndex;
            game.markModified('playerIndex');

            game.save(function(err, game) {
                if (req.newGame && req.body.useai=='on') {
                    req.query.game=game.id;
                    serve.do_addAI(req, res);
                }
                if (req.headers['x-requested-with'] == 'XMLHttpRequest') {
                    res.send({
                        success: true,
                        remaining: game.box.length,
                        name: game.name,
                        players: game.players,
                        board: game.board,
                        id: game._id
                    });
                } else {
                    res.redirect('/game/playGame?game=' + game._id);
                }
            });

        });
    },

    crypt: function(str, req) {
        return require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(str).digest('hex');
    },

    pullTiles: function(n, box) {
        var stack = [];
        for (var i = 0; i < n; i++) {
            stack.push(box.pop());
        }
        return stack;
    },

    shakeBox: function(box) {
        var a, b, d = box.length,
            q, r;
        for (var i in box) {
            /* swip swap randomly */
            a = Math.floor(Math.random() * d);
            b = Math.floor(Math.random() * d);
            q = box[a];
            r = box[b];
            box[a] = r;
            box[b] = q;
        }
        return box;
    },

    cleanId: function(id) {
        return id.replace(/[^a-z0-9]/, '');
    },

    initBoard: function() {
        var board = [];
        var size = 15;
        var ofx = 32;
        var ofy = 32;
        var grid = "";
        for (var j = 0; j <= size; j++) {
            board[j] = [];
            for (var i = 0; i <= size; i++) {
                var l = '';
                board[j][i] = {
                    letter: ""
                };
            }
        }
        /* bonus structure for the board/2D grid 1-n for multiplier / l for letter w for word  */
        var bonus = [
            ["3w", "1l", "1l", "2l", "1l", "1l", "1l", "3w", "1l", "1l", "1l", "2l", "1l", "1l", "3w"],
            ["1l", "2w", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "2w", "1l"],
            ["1l", "1l", "2w", "1l", "1l", "1l", "2l", "1l", "2l", "1l", "1l", "1l", "2w", "1l", "1l"],
            ["2l", "1l", "1l", "2w", "1l", "1l", "1l", "2l", "1l", "1l", "1l", "2w", "1l", "1l", "2l"],
            ["1l", "1l", "1l", "1l", "2w", "1l", "1l", "1l", "1l", "1l", "2w", "1l", "1l", "1l", "1l"],
            ["1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l"],
            ["1l", "1l", "2l", "1l", "1l", "1l", "2l", "1l", "2l", "1l", "1l", "1l", "2l", "1l", "1l"],
            ["3w", "1l", "1l", "2l", "1l", "1l", "1l", "3w", "1l", "1l", "1l", "2l", "1l", "1l", "3w"],
            ["1l", "1l", "2l", "1l", "1l", "1l", "2l", "1l", "2l", "1l", "1l", "1l", "2l", "1l", "1l"],
            ["1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l"],
            ["1l", "1l", "1l", "1l", "2w", "1l", "1l", "1l", "1l", "1l", "2w", "1l", "1l", "1l", "1l"],
            ["2l", "1l", "1l", "2w", "1l", "1l", "1l", "2l", "1l", "1l", "1l", "2w", "1l", "1l", "2l"],
            ["1l", "1l", "2w", "1l", "1l", "1l", "2l", "1l", "2l", "1l", "1l", "1l", "2w", "1l", "1l"],
            ["1l", "2w", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "3l", "1l", "1l", "1l", "2w", "1l"],
            ["3w", "1l", "1l", "2l", "1l", "1l", "1l", "3w", "1l", "1l", "1l", "2l", "1l", "1l", "3w"]
        ];
        return {
            gameboard: board,
            bonus: bonus,
            size: size
        };
    },

    do_makeMove: function(req, res) {
        var id = req.body.id;

        req.app.db.models.Games.findOne({
            _id: id
        }, function(err, game) {
            if (err) throw(err);

            /* start game request? */
            if (req.body.startGame) {
                if (req.user._id==game.creator) {
                    var turnId = game.players[game.turn].id;
                    game.status='INPROGRESS';
                    game.started=new Date();
                    game.save(function(err,game) {
                        var emit = {
                                    status: game.status,
                                    turnId: turnId,
                                    tilesleft: game.box.length,
                                    scoreboard: game.scoreboard,
                                    turn: 0,
                                    board: game.board,
                                    players: game.players
                        };
                        req.app.io.room(game._id).broadcast('updateGame', emit);
                        res.send({success:true});
                    });
                    return true;
                } else {
                    /* UI VIOLATION HAX */
                    return false;
                }
            }

            /* ...  seems problematic */
            if (req.body.leaveGame) {
                var userId = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.user._id.toString()).digest('hex');
                var playerInfo=serve.getPlayerInfo(game,userId);
                if (!playerInfo) {
                    console.log('hrm',game);
                    return false;
                }
                /* remove player from the game */
                game.players[playerInfo.playerIndex].left=true;
                req.app.io.room(game._id).broadcast('updateGame', { playerLeft: true, player: player });

                /* disconnect */
                //req.app.io.room(playerInfo.id).leave();
                game.save(function(err,game) {
                    return serve.nextPlayer(req, res, game, playerInfo);
                });
                return false;
            }



            /* SORRY YOU CAN'T MOVE UNTIL THE GAME HAS STARTED */
            if (game.status != 'INPROGRESS') {
                res.send({
                    error: 'AWAITING PLAYERS',
                    success: false
                });
                return false;
            }

            /* client side ID being used */
            var userId = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.user._id.toString()).digest('hex');
            var playerInfo;

            if (req.useAI) {
                playerInfo={ player: game.players[game.turn], playerIndex: game.turn };
            } else {
                playerInfo=serve.getPlayerInfo(game,userId);
            }
            var playerIndex=playerInfo.playerIndex; //of i in game.players
            var player=playerInfo.player;

            var wordScore = [];
            var kwords;

            var placedBoard = game.shadowboard;
            var board = game.board;
            var bonus = game.bonus;
            var size = game.size;
            var placedLetters = req.body.placedLetters||[];

            var i, j; //generalindex

            if (playerIndex != game.turn) {
                res.send({
                    error: 'NOT YOUR TURN',
                    success: false
                });
                return false;
            }
            
            if (!player) {
                /* UI VIOLATION HAX */
                // console.log(req.user._id, 'no such player in game.players', game.players);
                res.send({
                    error: 'NOT JOINED',
                    success: false
                });
                return false;
            }

            var turnId = game.players[game.turn].id;

            /* swap out the tiles and shuffle the box */
            if (req.body.swapTiles) {

                if (!placedLetters.length) {
                    return res.send({
                        error: 'NO LETTERS TO SWAP',
                        success: false
                    });
                }

                var playedWords = ['*'];
                var scoreInfo = {
                    '*': {
                        word: '*SWAP',
                        total: 0
                    }
                };

                /* pull the letters etc */
                var boxletter;
                for (i in placedLetters) {
                    if (placedLetters[i].letter) game.box.push(placedLetters[i].letter);
                }
                game.box = serve.shakeBox(game.box);

                var tiles = serve.pullTiles(placedLetters.length, game.box);
                for (var i in placedLetters) {
                    if (placedLetters[i].letter) player.rack[placedLetters[i].index] = tiles.pop()||'';
                }

                game.scoreboard.push({
                    player: player.id,
                    playedWords: playedWords,
                    scoreInfo: scoreInfo
                });

                game.players[playerIndex].rack = player.rack;

                /* ok next player's move */
                return serve.nextPlayer(req, res, game, player);
            }

            if (req.body.passTurn) {
                player.lastTurn='PASS';

                game.movecount--;
                var playedWords = ['*'];
                var scoreInfo = {
                    '*': {
                        word: '*PASS',
                        total: 0
                    }
                };

                game.scoreboard.push({
                    player: player.id,
                    playedWords: playedWords,
                    scoreInfo: scoreInfo
                });

                return serve.nextPlayer(req, res, game, player);
            }

            /* OK we're here - then we've actuall come to place some letters */
            player.lastTurn='MOVE';

            /* we're checking to see if the person has played to a connecting letter on the board */
            /* letter we're checking, from the players rack*/
            var rackLetter; 
            /* well, does it? */
            var hasConnect=false;

            /* is there distance the between placed letters */
            var diffx=false,diffy=false;
            var lastx;
            var lasty;


            /* placed letters by board position - copy these before wildcards are transposed as it's used in score calcs */
            var placedByHash=[];
            /* esnure the letters are in a straight line, and build hash by position */
            if (placedLetters.length<1) {
                return res.send({
                    error: 'BAD PLACEMENT',
                    success: false});
            }
            for (i in placedLetters) {
                var o = placedLetters[i];
                placedByHash[o.y]=placedByHash[o.y]||[];
                placedByHash[o.y][o.x]=o.letter;
                lastx=lastx||o.x;//unset state
                lasty=lasty||o.y;

                if (lastx != o.x) diffx = true;
                if (lasty != o.y) diffy = true;
                if (diffx && diffy) {
                    return res.send({
                        error: 'BAD PLACEMENT',
                        success: false
                    });
                }
                lastx = o.x;
                lasty = o.y;
            }


            var cleanLetters=[];
            /* sanitize placed letters */
            for (var i in placedLetters) {
                if (typeof(placedLetters[i].index)=='undefined') {
                    throw("UI error, no index");
                }
                var placedLetter=placedLetters[i];
                var l=placedLetter.letter;
                if (!serve.rank[l]) {
                    return res.send({
                        error: 'BAD LETTER',
                        success: false});
                }
                placedLetter.x = parseInt(placedLetter.x);
                placedLetter.y = parseInt(placedLetter.y); //normalize
                if (player.rack[placedLetter.index]!='_') {
                    placedLetter.letter=player.rack[placedLetter.index];
                }
                cleanLetters.push(placedLetter);
            };
            placedLetters=cleanLetters;

            /* is there a letter neighbour on the board? */
            for (var i in placedLetters) {
                l = placedLetters[i];
                l.y = parseInt(l.y);
                l.x = parseInt(l.x);

                if (board[l.y][l.x].letter != "") {
                    console.log(board[l.y][l.x],l);
                    if (req.useAI) {
                        return serve.dumpBoard(board);
                    } else {
                        return res.send({
                            error: 'BAD PLACEMENT',
                            success: false,
                            data: board[l.y][l.x]
                        });
                    }
                }
                if (l.y > 0)
                    if (board[l.y - 1][l.x].letter) hasConnect = true;
                if (l.y < size)
                    if (board[l.y + 1][l.x].letter) hasConnect = true;
                if (l.x > 0)
                    if (board[l.y][l.x - 1].letter) hasConnect = true;
                if (l.x < size)
                    if (board[l.y][l.x + 1].letter) hasConnect = true;
            }

            /* copy the letters placed, onto our test board */
            for (var i in placedLetters) {
                l = placedLetters[i];
                board[l.y][l.x].letter = l.letter;
            }


            /* Game didn't start on the center square */
            if (game.movecount == 0 && board[7][7].letter == '') {
                return res.send({
                    error: 'BAD PLACEMENT',
                    success: false
                });
            }

            /* Play doesn't have a cross/connecting letter after start */
            if (game.movecount > 0 && hasConnect==false) {
                return res.send({
                    error: 'BAD PLACEMENT',
                    success: false
                });
            }

            var peice=[];
            var minx=999,miny=999,maxx=-1,maxy=-1;
            /* Get the min/max x&y values for the placed letters */
            for (i in placedLetters) {
                o = placedLetters[i];
                if (!peice[o.y]) peice[o.y] = [];
                peice[o.y][o.x] = true;
                minx = o.x < minx ? o.x : minx;
                maxx = o.x > maxx ? o.x : maxx;
                miny = o.y < miny ? o.y : miny;
                maxy = o.y > maxy ? o.y : maxy;
            }

            var playDirection=(minx==maxx)?'vertical':'horizontal';

            var playMin=(miny==maxy)?minx:miny;
            var playMax=(miny==maxy)?maxx:maxy;
            var sortStack=[];
            for (var pos=playMin; pos<=playMax; pos++) {
                for (i in placedLetters) {
                    var pl=placedLetters[i];
                    if (playDirection=='horizontal') {
                        if (pl.x==pos) sortStack.push(pl);
                    } else {
                        if (pl.y==pos) sortStack.push(pl);
                    }
                }
            }
            /* make sure there are no empty gaps */
            var gap=false;
            for (var mx=minx; mx<=maxx; mx++) {
                if (board[miny][mx].letter=='') gap=true;
            }
            for (var my=miny; my<=maxy; my++) {
                if (board[my][minx].letter=='') gap=true;
            }
            if (gap) {
                serve.dumpBoard(board);
                
                return res.send({
                    error: 'BAD PLACEMENT',
                    success: false 
                });
            }

            var buildScore=0;
            var buildWord='';
            var buildWords=[];

            if (playDirection=='horizontal') {
                var leftAndRight=serve.findLeftAndRight( { x:minx, y: miny },board);
                buildWord=serve.buildWord( { left:leftAndRight.left, right:leftAndRight.right, y: miny }, board);
                buildScore=serve.buildScore( { left:leftAndRight.left, right:leftAndRight.right, y: miny }, placedByHash, board, bonus);
                if (buildWord) buildWords.push( { word:buildWord, total: buildScore });
                for (var x=leftAndRight.left; x<=leftAndRight.right; x++) {
                    if (placedByHash[miny]) if (placedByHash[miny][x]) {
                        var topAndBottom=serve.findTopAndBottom( { x:x, y:miny },board);
                        if (topAndBottom.top!=topAndBottom.bottom) {
                            buildWord=serve.buildWord( { top:topAndBottom.top, bottom:topAndBottom.bottom, x: x }, board);
                            buildScore=serve.buildScore( { top:topAndBottom.top, bottom:topAndBottom.bottom, x: x }, placedByHash, board, bonus);
                            if (buildWord) buildWords.push({word:buildWord,total:buildScore});
                        }
                    }
                }
            }

            if (playDirection=='vertical') {
                var topAndBottom=serve.findTopAndBottom( { x:minx, y: miny },board);
                buildWord=serve.buildWord( { top:topAndBottom.top, bottom:topAndBottom.bottom, x: minx }, board);
                buildScore=serve.buildScore( { top:topAndBottom.top, bottom:topAndBottom.bottom, x: minx }, placedByHash, board, bonus);
                if (buildWord) buildWords.push( { word:buildWord, total: buildScore });
                for (var y=topAndBottom.top; y<=topAndBottom.bottom; y++) {
                    if (placedByHash[y]) if (placedByHash[y][minx]) {
                        var leftAndRight=serve.findLeftAndRight( { x:minx, y:y },board);
                        if (leftAndRight.left!=leftAndRight.right) {
                            buildWord=serve.buildWord( { left:leftAndRight.left, right:leftAndRight.right, y: y }, board);
                            buildScore=serve.buildScore( { left:leftAndRight.left, right:leftAndRight.right, y: y }, placedByHash, board, bonus);
                            if (buildWord) buildWords.push({word:buildWord,total:buildScore});
                        }
                    }
                }
            }

            var playedWords='';
            var wordsChecked = buildWords.length;

            function checkGrepResult(error, stdout, stderr) {
                if (error) {
                    console.log('ERROR',wordsChecked,buildWords,error);
                    try {
                        res.send({
                            error: 'NO MATCH/CHECK ERROR',
                            success: false
                        });
                    } catch (e) {
                        console.log(e);
                    }
                    return;
                }
                grepResult += stdout.trim();
                wordsChecked--;
                if (wordsChecked == 0) {
                    /*
                     * OK the play is good, all words were found.
                     * result length will be zero for a not found word so we can always just check the length.
                     */
                    if (grepResult.length == playedWords.length) {
                        req.app.db.models.Games.findOne({
                            _id: req.body.id
                        }, function(err, game) {
                                var data;
                                data={
                                    game: game, board: player.playedBoard, player: player, buildWords: buildWords, placedLetters: placedLetters, playerIndex: playerIndex
                                };
                                serve.finishMove(req,res,data);
            
                        });


                    } else {
                        res.send({
                            error: 'NO MATCH',
                            success: false
                        });
                    }
                }
            }
        
            /* search the played words in the dictionary */
            var grepWord='';
            var grepResult='';
            buildWords.grandTotal=0;
            /* copy our validated board to pass through into game save */
            player.playedBoard=board;

            for (i in buildWords) {
                if (!buildWords[i].word) continue;
                playedWords+=buildWords[i].word;
                buildWords.grandTotal+=buildWords[i].total;
                grepWord=buildWords[i].word.toUpperCase();
                if (game.gameoptions.dictionary!='') {
                    exec("grep -E '^" + grepWord + ".$' dicts/"+game.gameoptions.dictionary||'sowpods', checkGrepResult);
                } else {
                    serve.finishMove(req,res,{
                        game: game, board: player.playedBoard, player: player, buildWords: buildWords, placedLetters:placedLetters, playerIndex: playerIndex
                    });
                }
            }
            return buildWords;

        });
    },

    finishMove: function(req,res,data) {
        /* pull some tiles from the box, modify the game board */
        var game=data.game; /* shortform-er */
        var tiles = serve.pullTiles(data.placedLetters.length, game.box);
        for (var i in data.placedLetters) data.player.rack[data.placedLetters[i].index] = tiles.pop()||'';
        data.player.score += data.buildWords.grandTotal;
        game.players[data.playerIndex] = data.player;
        if (data.board) {
            console.log('updated board');
            game.board=data.board;
        }
        //serve.dumpBoard(game.board);
        game.markModified('box');
        game.markModified('players');
        game.markModified('board');
        game.scoreboard.push({
            move: data.game.movecount,
            player: data.player.id,
            playedWords: data.playedWords,
            scoreInfo: data.buildWords
        });
        serve.nextPlayer(req, res, game, data.player);
        return null;
    },
    do_resetTurn: function(req, res) {
        var id = serve.cleanId(req.query.game);
        req.app.db.models.Games.findOne({
            _id: id
        }, function(err, game) {
            game.turn=parseInt(req.query.turn);
            game.save(function(err,game) {
                res.send({resetTurn:game.turn});
            });
        });
    },
    do_chatMessage: function(req, res) {
        var id = req.body.id;
        var msg = req.body.message;
        var userId = require('crypto').createHmac('sha512', req.app.get('crypto-key')).update(req.user._id.toString()).digest('hex');
        req.app.db.models.Games.findOne({
            _id: id
        }, function(err, game) {
            if (err) {
                throw (err);
                return;
            }
            if (!id) {
                throw ("No such game? " + id);
                return;
            }
            var player = {};
            for (var i in game.players) {
                if (game.players[i].id == userId) {
                    player = game.players[i];
                    break;
                }
            }

            if (!msg) {
                res.send({
                    success: true,
                    fetched: true
                });
                req.app.io.room(player.id).broadcast('updateChat', {
                    messages: game.messages
                });
                return;
            }
            player = {
                name: player.name,
                index: player.index
            };
            game.messages.push({
                player: player,
                message: msg
            });
            game.save(function(err, game) {
                res.send({
                    success: true,
                    fetched: true
                });
                req.app.io.room(player.id).broadcast('updateChat', {
                    messages: game.messages
                });
                req.app.io.room(game._id).broadcast('updateChat', {
                    messages: game.messages
                });
            });

        });
    },
    getPlayerInfo: function(game,userId) {
        var playerIndex=-1, player=false;
        for (var i in game.players) {
            if (game.players[i].id == userId) {
                player = game.players[playerIndex = i];
                break;
            }
        }
        return { player:player, playerIndex:playerIndex };
    },
    /* return the index of the next players */
    getNextTurn: function(game) {
        for (var i in game.players) {
            game.turn++;
            if (game.turn>=game.players.length) game.turn=0;
            if (game.players[game.turn].left==false) return game.turn;
        }
        return false;
    },
    nextPlayer: function(req, res, game, player) {
        var noPlayersMoved=true;
        var gameWinner={}, highestScore=0, longestRack = 0;

        game.turn=serve.getNextTurn(game);

        /* no players left! */
        if (game.turn===false) {
            game.status='ABANDONED';
            game.save();
            res.send({redirect:"/account/?gameAbandoned"});
            return;
        }

        /* one more move */
        game.movecount++;
        var winningPlayer={},lastScore=0;
        for (var i in game.players) {
            var iPlayer=game.players[i];
            if (!iPlayer.score) continue;
            if (iPlayer.left===true) continue;
            if (iPlayer.lastMove!='PASS') noPlayersMoved=false;
            if (iPlayer.score>lastScore) winningPlayer=game.players[i];

            longestRack = longestRack < iPlayer.rack.length ? longestRack : iPlayer.rack.length;
            highestScore = highestScore < iPlayer.score ? highestScore : (gameWinner = iPlayer.score);
            lastScore=iPlayer.score;
        }

        if (game.box.length == 0 && noPlayersMoved) {
            game.status = 'GAMEOVER';
            game.winner = gameWinner;
            req.app.io.room(game._id).broadcase('updateGame', {
                gameOver:true,
                winner: winningPlayer
            });
        }

        var turnId = game.players[game.turn].id;
        //OHHELL
        //game.board=player.board||game.board;

        game.markModified('box');
        game.markModified('board');
        game.markModified('players');
        /* save successful turn */
        game.save(function(err, game) {
            if (err) throw(err);
            //if (game.status=='GAMEOVER') return;
            var useAI=game.players[game.turn].useAI||false;

            if (useAI) {
                serve.useAI(req,res,game);
                try { 
                    res.send({'wait':true});
                } catch(e){
                    //backend?
                }
            } else {
                req.app.io.room(turnId).broadcast('yourTurn');
            }
            req.app.io.room(player.id).broadcast('updateRack', {
                rack: player.rack
            });
            req.app.io.room(game._id).broadcast('updateGame', {
                tilesleft: game.box.length,
                turnId: turnId,
                scoreboard: game.scoreboard,
                board: game.board,
                players: game.players
            });
            try {
                res.send({ success: true });
            } catch(e) {
                //AI?  .. extend logging here mebe
            }
        });
    },
    useAI:function(req,res,game) {
        var game=game;
        console.log('BRAINING!');
        var zmq       = require('zmq')
          , requester = zmq.socket('req');

        requester.connect('tcp://localhost:5502');
        /* AI reply */
        requester.on('message', function(msg) {
            /* TODO put next move/broadcasts in here */
            //console.log('got reply', msg.toString());
            var placedLetters=msg?JSON.parse(msg.toString()):[];
            req.useAI=true;
            req.body=req.body||{};
            req.body.id=game.id;
            req.body.passTurn=(placedLetters==false);
            req.body.placedLetters=placedLetters||[];
            console.log('making move as AI',req.body,game.turn);
            serve.do_makeMove(req, res);
        });

        /* fix up our data to send to the AI backend */
        var data={};
        data.rack='';
        data.grid=game.board;
        console.log(data.grid);
        for (var i in game.players[game.turn].rack) 
            data.rack+=game.players[game.turn].rack[i];
        requester.send(JSON.stringify(data));

        return;
    },
    dumpBoard:function(board) {
        var out="";
        for (var py=0; py<board.length; py++) {
            out=out+"\r\n";
            for (var px=0; px<board[py].length; px++) {
                out=out+(board[py][px].letter||'_');
            }
        }
        console.log(out);
    },

    /* BOARD LOGIC HELPERS */

    findTopAndBottom:function(pos,board) {
        var top=false;
        var bottom=false;
        var x=pos.x;
        var y=pos.y;
        while (serve.checkBoardLetter(x,y-1,board)) {
            y--;
        }
        top=y;
        while (serve.checkBoardLetter(x,y+1,board)) {
            y++;
        }
        bottom=y;
        return { top:top, bottom:bottom };
    },

    findLeftAndRight:function(pos,board) {
        var left=false;
        var right=false;
        var x=pos.x;
        var y=pos.y;
        while (serve.checkBoardLetter(x-1,y,board)) {
            x--;
        }
        left=x;
        while (serve.checkBoardLetter(x+1,y,board)) {
            x++;
        }
        right=x;
        return { left:left, right:right };
    },

    buildScore:function(coord,placed,board,modifier) {
        var x,y;
        var totalScore=0;

        if (typeof(coord.left)=='number' && typeof(coord.right)=='number' && typeof(coord.y)=='number') {
            var wordScore=0;
            var wordUp=0;
            for (x=coord.left; x<=coord.right; x++) {
                var letterScore=0;
                var mod=modifier[coord.y][x];
                var modType=mod[1];
                var modVal=parseInt(mod[0]);
                var l=board[coord.y][x].letter;
                letterScore=parseInt(serve.rank[l][0]);
                if ( placed[coord.y] ) if ( placed[coord.y][x] ) {
                    if (modType=='l') letterScore=(letterScore*modVal);
                    if (modType=='w') wordUp+=modVal;/*multiplier*/
                }
                wordScore+=letterScore;
            }
            totalScore=wordScore*(wordUp>0?wordUp:1);
            return totalScore;
        }

        if (typeof(coord.top)=='number' && typeof(coord.bottom)=='number' && typeof(coord.x)=='number') {
            var wordScore=0;
            var wordUp=0;
            for (y=coord.top; y<=coord.bottom; y++) {
                var mod=modifier[y][coord.x];
                var modType=mod[1];
                var modVal=parseInt(mod[0]);
                var letterScore=0;
                var l=board[y][coord.x].letter;
                letterScore=parseInt(serve.rank[l][0]);

                if ( placed[y] ) if ( placed[y][coord.x] ) {
                    if (modType=='l') letterScore=(letterScore*modVal);
                    if (modType=='w') wordUp+=modVal;/*multiplier*/
                }
                wordScore+=letterScore;
            }
            totalScore=wordScore*(wordUp>0?wordUp:1);
            return totalScore;
        }
        return false;
    },


    buildWord:function(coord,board) {
        var x,y;
        var word='';
        if (typeof(coord.left)=='number' && typeof(coord.right)=='number' && typeof(coord.y)=='number') {
            for (x=coord.left; x<=coord.right; x++) {
                word+=board[coord.y][x].letter;
            }
            return word.length>1?word:false;
        }
        if (typeof(coord.top)=='number' && typeof(coord.bottom)=='number' && typeof(coord.x)=='number') {
            for (y=coord.top; y<=coord.bottom; y++) {
                word+=board[y][coord.x].letter;
            }
            return word.length>1?word:false;
        }
        return word.length>1?word:false;
    },

    checkBoardLetter:function(x,y,board) {
        if (x<0||x>=board[0].length) return '';
        if (y<0||y>=board.length) return '';
        return board[y][x].letter;
    },



};

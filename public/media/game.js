'use strict';

var rack;

var search = location.search.substring(1);

var request = search ? JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') : {};

//var socket = new io.connect(window.location.href.replace(/\.com.*/,'.com:80'));
var socket = new io.connect("ws://dev.lexycross.com:80");

var gameCopy={
    'NO MATCH':'Sorry, can\'t find those word(s) in the dictionary. Try again ;)',
    'INVALID NAME':'Sorry, stick to letters and such when naming the game.',
    'INVALID PLAYER COUNT':'Sorry, only between 1 and 4 players right now.',
    'AWAITING PLAYERS':'The game is awaiting players.',
    'NO LETTERS TO SWAP':'Place some letters on the board to swap.',
    'NOT YOUR TURN':'Sorry, not your turn - pick those letters up.',
    'BAD PLACEMENT':'Sorry you can\'t play your letters that way.',
    'NOT JOINED':'Whoa.  What are you doing?',
    'ABANDONED':'Not here.'
};

//socket.on('test',function(msg) { console.log(msg); alert(msg); });

socket.on('updateGame', function (data) {
    game.updateGame(data);
});

socket.on('updateRack', function (data) {
    game.updateRack(data.rack);
});

socket.on('pingGame', function (data) {
    game.pingGame(data);
});

socket.on('connect',function() {

});

socket.on('disconnect', function () {
    /* if the user has closed or navigated away this won't fire */
    setTimeout(function() {
        alert('Server went away, try reloading');
    },1000);
});

socket.on('yourTurn', function (data) {
    if (!game.exit) game.sendMessage("It's your turn.");
});

socket.on('updateChat', function (data) {
    $('#chatMessages').html('<div></div>');
    var m; //da message in question
    for (var i in data.messages) {
        m = data.messages[i];
        $('#chatMessages').append('<div class="chatName">' + m.player.name + '</div>' + '<div class="chatMessage">' + m.message + '</div>');
    }
    $('#chatMessages').scrollTop($('#chatMessages div:last').offset().top);
});


/* front end game logic */
var game = {
    dropped: {},
    players: [],
    placedLetters: [],
    pingGame: function (data) {
        /*console.log(data, 'ping');*/
    },
    currentPlayer: {},
    status: '',
    init: function () {

        var $section = $('.page').first();

/* ... sucked 
        $section.find('#board').panzoom({
          $zoomIn: $section.find(".zoom-in"),
          $zoomOut: $section.find(".zoom-out")
        });
*/

        $('#newGame').bind('click', function () {
            game.dialog('#newGameDialog');
        });

        $('#inviteUrl').val(window.location.href);
        $('#inviteUrl').click(function() {
            this.setSelectionRange(0, this.value.length);
        });

        $('#newGameForm').bind('submit', game.post);

        /* we've joined the game */
        if ($('#board').length) {

            var bonusTypes={ 
                '1l':'',
                '2l':'Double Letter Bonus',
                '3l':'Triple Letter Bonus',
                '2w':'Double Word Bonus',
                '3w':'Triple Word Bonus'
            };

            var drawBonus = function () {
                var boxes = $('#board .letter-box');
                var i = 0,
                    x, y;

                for (y in bonus) {
                    for (x in bonus[y]) {
                        bonusTypes[ bonus[y][x] ]?boxes.eq(i).attr('title',bonusTypes[ bonus[y][x] ]):null;
                        boxes.eq(i++).addClass('b-' + bonus[y][x]);
                    }
                }
            }();


            $('#passMove').bind('click', game.makeMove);
            $('#swapTiles').bind('click', game.swapTiles);

            $('#recallWord').bind('click', game.recallLetters);

            $('#playWord').bind('click', function () {
                /* prep data for play */
                var pushPlaced = [], i, data;
                for (i in game.placedLetters) {
                    data = game.placedLetters[i];
                    if (!data) continue;
                    if (!data.letter) continue;
                    pushPlaced.push({
                        x: data.x,
                        y: data.y,
                        letter: data.letter,
                        index: data.index
                    });
                }
                $.post('/game/makeMove', {
                    id: request.game,
                    placedLetters: pushPlaced
                }, function (res) {
                    if (res.success) {
                        //
                    } else {
                        game.sendMessage(res.error);
                    }
                }, 'json');
            });

            $('#startGame').bind('click',function() {
                $.post('/game/makeMove',{ startGame: true, id: request.game },function(res) {
                    if (!res.success) game.sendMessage(res.error);
                    else $('#startGame').remove();
                });
            });

            $('#leaveGame').bind('click',function() {
                $.post('/game/makeMove',{ leaveGame: true, id: request.game },function(res) {
                    window.location.href=res.redirect||'/?leftGameExit';
                });
            });


            $('#rack .letter-box').droppable({
                scope: 'board',
                accept: '.letter',
                drop: function (e, ui) {
                    game.pullLetter($(ui.draggable).data());
                }
            });

            /* setup data for board */
            $('#board .letter-box').each(function(i) {
                var x=i%15; 
                var y=Math.floor(i/15);
                $(this).data('pos',{x:x,y:y}).attr('id','pos_'+y+'_'+x);
                $(this).droppable( {
                    scope: 'board',
                    accept: ".letter",
                    drop: function(e,ui) {
                    var data=$(e.target).data();
                    if (board[data.pos.y][data.pos.x].letter!='') return false;
                    /*stash where we dropped the piece for the reject draggable function */
                    game.dropped=$(ui.draggable).data();
                    game.pullLetter( $(ui.draggable).data() );
                    $(ui.draggable).data({pos: { x:data.pos.x, y: data.pos.y } });
                    }
                });
            });


            socket.emit('ready');

        }
    },
    dragizeTile: function (i) {
        var self=this.parentNode;
/*
        console.log(self);
        $(self).on('touchstart mousedown',function(e) {
            /* start drag */
/*            
            $('#board').on('mousemove',function(e) {
                var x=e.clientX-$('#rack').offset().left;
                var y=e.clientY-$('#rack').offset().top+$(window).scrollTop();
                $(self).css({zIndex:900,left:x+'px',top:y+'px',position:'absolute'});
                e.preventDefault();
            });
            
            $('#board').on('touchend mouseup',function(e) {
                $('#board').unbind('mousemove touchmove');
                console.log(e);
            });

            e.preventDefault();
        });
        return;
*/

        var opts;
        $(this).draggable(opts = {
            scope: 'board',
            snap: '.letter-box',
            start: function (e, ui) {
                var data = $(ui.helper).data();
                data.index = $(e.target).data().index;
                data.ref = $(e.target).data().ref;
                game.dragging = data;
                game.dragging.org = {
                    pos: data.pos,
                    index: data.index,
                    letter: data.letter,
                    helper: ui.helper,
                    ref: data.ref
                };
            },
            /* revert or drop actually */
            revert: function (el) {
                return game.dropLetter(el);
            },
        });

    },
    dropLetter:function(el) {
        /* anywhere on the board? */
        if (!$(el).parent().length) {
            return true;
        }
        /* ok it's back on the rack */
        if ($(el).parent()[0].id == 'rack') {
            return false;
        }
        /* get the data for the element the letter was dropped on */
        var data = $(el).data();
        /* if it wasn't placed on the board */
        if (!data) return true;
        
        /* ok it's on the board then */
        if (data.pos) {
            /* is the board clear in that spot though? */
            if (board[data.pos.y][data.pos.x].letter == '') {
                /* put the piece in place - TODO: put the piece down close by */
                data = game.dragging;
                data.index = game.dragging.index;
                data.letter = game.dragging.letter;
                data.ref = game.dragging.ref;
                game.placeLetter(data);
                game.dragging = false;
                return false;
            } else {
                /* put the piece back on the board where it was and revert it's data */
                $(game.dragging.org.helper).data(game.dragging.org);
                game.placeLetter(game.dragging.org);
                game.dragging = false;
            }
        }
        return true;
    },
    /* fill in the UI board with the logical board */
    testBoard: function () {
        $('#board .letter-box').each(function (i) {
            var x = i % 15;
            var y = Math.floor(i / 15);
            $(this).text(board[y][x].letter);
        });
    },
    checkPlay: function (data) {
        return board[data.pos.y][data.pos.x].letter == "" ? true : false;
    },
    /* called when taking a letter off the board */
    pullLetter: function (data) {
        if (typeof (data) != 'object') return;
        if (typeof (data.pos) != 'object') return;
        board[data.pos.y][data.pos.x].letter = '';
        game.placedLetters[data.index] = false;
    },
    /* and when placing a letter onto the board */
    placeLetter: function (data) {
        if (typeof (data) != 'object') return;
        if (typeof (data.pos) != 'object') return;
        data.letter = board[data.pos.y][data.pos.x].letter = game.dropped.letter;
        game.placedLetters[data.index] = {
            letter: data.letter,
            x: data.pos.x,
            y: data.pos.y,
            index: data.index,
            ref: data.ref
        };
    },
    updateRack: function (data) {
        var n = 0;
        rack = data;
        /* unbind the existing bound rack letters */
        $('#rack .letter.ui-draggable').draggable('destroy').attr('style', '');

        /* now bind them all */
        $('#rack .letter').each(function (i) {
            game.placedLetters[i] = {
                letter: ''
            };
            var l = rack[i];
            /* sanity check */
            if (!l) { return false; }

            /* setup data, text and score for this letter */
            $(this).data({ index: i, letter: l });

            $(this).text(l);

            $(this).append("<span class='score'>" + rank[l][0] + "</span>");

            /* if it's a wildcard, add some hooks */
            if (l == '_') {
                $(this).click(function () {
                    var wildcardWas = $(this).val();
                    var pollInputItr;
                    var clicked = this;
                    var wildscore = "<span class='score'>" + rank['_'][0] + "</span>";
                    $(this).html("<input style='width:1em;position:absolute;margin-left:-0.5em;z-index:100;' type='text' size='1' maxlength='1' id='wildcardPick' />" + wildscore);
                    $('#wildcardPick').trigger('focus');
                    pollInputItr = setInterval(function () {
                        var v = $('#wildcardPick').val();
                        if (v && v != wildcardWas && v!='_') {
                            var l = ($('#wildcardPick')[0].outerHTML = v.toUpperCase().replace(/[^A-Z]/, ''));
                            game.placedLetters[$(clicked).data('index')].letter = l;
                            clearInterval(pollInputItr);
                        }
                    }, 300);
                });
            }

            $(this).data('ref', this);
            game.dragizeTile.call(this);
        });
    },

    updateGame: function (data) {
        var turnName = '';
        if (data.playerLeft) {
            game.sendMessage('Player '+data.player.name+' has left the game (all moves will count as a pass)');
        }

        if (data.status == 'INPROGRESS') {
            game.status = data.status;
            $('#inviteUrlTip').html('The game room is now full - but you can send this to anyone playing.  (click to dismiss)');
            $('#startGame').hide();
            game.sendMessage('The game is on!');
        } else {
            $('#inviteUrlTip').hide();
        }

        game.remaining = data.remaining;

        game.players = players = data.players;
        for (i in game.players) {
            if (data.turnId == game.players[i].id) {
                game.currentPlayer = game.players[i];
                turnName = game.players[i].name;
            }
        }

        if (data.board) {
            game.placedLetters = [];
            $('#board .letter-box').each(function (i) {
                game.placedLetters.push({letter:''});
                var x = i % 15;
                var y = Math.floor(i / 15),
                    l;
                l = data.board[y][x].letter;
                if (l) $(this).html("<div class='letter'>" + l + "<span class='score'>" + rank[l][0] + "</span></div>");
            });
        }
        $('#moves').find('.score-info').remove();//wee faster to find on #element

        $('#currentTurn').html('<span>' + turnName + '\'s move</span>');
        $('#scoreboard').find('div').remove();
        $('#scoreboard').append("<div class='pull-right'>" + data.tilesleft + " Tiles Left</div>");
        var playerId; //who played what
        for (var i in data.players) {
            var _player = data.players[i];
            $('#scoreboard').append(
                "<div><strong>" + _player.name + '</strong>:' + _player.score + "</div>"
            );
        }
        

        $('#moves').append("<div></div>");
        for (var i in data.scoreboard) {
            if (i == 'grandTotal') {
                continue;
            }
            playerId = data.scoreboard[i].player;
            for (var j in data.scoreboard[i].scoreInfo) {
                var _score = data.scoreboard[i].scoreInfo[j];
                var _player = game.getPlayer(playerId);
                if (typeof (_score) != 'object') continue;
                $('#moves').append("<div class='score-info'>" + _player.name + ':' + _score.word + ' for ' + _score.total + "</div>");
            }
        }
        $('#moves').scrollTop($('#moves div:last').offset().top+100);

        $('#chat').submit(function () {
            var msg = $('#msg').val();
            $.ajax({
                async: false,
                url: '/game/chatMessage',
                method: 'post',
                data: {
                    id: request.game,
                    message: msg
                }
            });
            $('#msg').val('');
            return false;
        });

        $.ajax({
            async: false,
            url: '/game/chatMessage',
            method: 'post',
            data: {
                id: request.game,
                message: ''
            }
        });

    },
    post: function (e) {

        var data = {};
        e.preventDefault();
        $(this).find('input').each(function () {
            data[$(this).attr('name')] = $(this).val();
        });
        $.ajax({
            url: $(this).attr('action'),
            dataType: 'json',
            method: 'post',
            data: data,
            success: function (r) {
                game.direct('/game/playGame?game=' + r.id);
            }
        });
        return false;
    },
    direct: function (s) {
        window.location.href = s;
    },
    sendMessage: function (msg) {
        alert(msg);return;
        $('#msgCopy').html(gameCopy[msg]||msg);
        game.dialog('#dialog');
        $(window).keydown(function() { $('#dialog').trigger('click');  $(window).unbind('keydown'); });
    },
    dialog: function (dlg,s) {
        $(dlg).modal(s||null);
    },
    swapTiles: function () {
        var pushPlaced = [], i, data;

        for (i in game.placedLetters) {
            data = game.placedLetters[i];
            if (!data) continue;
            if (!data.letter) continue;
            pushPlaced.push({
                x: data.x,
                y: data.y,
                letter: data.letter,
                index: data.index
            });
        }

        $.post('/game/makeMove', {
            id: request.game,
            placedLetters: pushPlaced,
            swapTiles: true
        }, function (res) {
            if (!res.success) game.sendMessage(res.error);
        });
    },
    recallLetters: function () { 
        /* recall each for every letter in rack */
        for (var i in rack) {
            var l = game.placedLetters[i];
            if (typeof(l.index)=='undefined') continue;
            if (l.index=='') continue;
            game.placedLetters[i].letter = '';
            game.placedLetters[i].index = '';
            board[l.y][l.x].letter = '';
            /* animate letters back into rack */
            $(l.ref).animate({ left: 0, top: 0 });
        }
    },
    makeMove: function () {
        $.post('/game/makeMove', {
            id: request.game,
            passTurn: true
        }, function (r) {
            /* nothing to do here */
        });
    },


    getPlayer: function (id) {
        for (var i in players)
            if (id == players[i].id) return players[i];
    }
    

};



$(document).ready(function () {
    game.init();
});

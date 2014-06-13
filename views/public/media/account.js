'use strict';
var search = location.search.substring(1);
var request = search ? JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') : {};
/* front end account logic */
var account = {
    init: function() {
        /* general hooks */

        $('#newGameForm').bind('submit', account.post);

        $('.lc-tooltip').tooltip();

        /* populate public list */
        $.get('/game/getGames', account.getGames, 'json');

        /* responsive search query */
        $('#search').keyup(account.searchQuery);/* this cuts down on b/w and user errors triggering bad queries */
        $('#search').change(account.searchQuery);/*for touch devices*/
    },
    searchQuery: function(r) {
        var lastKeyTimeout;
        setTimeout(function() {
            var searchVal = $('#search').val();
            if (searchVal.length > 0) {
                    $('#gameList').find('h3').remove();
                    var doSearch = function() {
                        $.get('/game/getGames?name=' + searchVal, function(r) {
                            for (var i in r) {
                                account.appendGame(r[i]);
                            }
                            $('#gameList').find('.openGames').tooltip();
                        }, 'json');
                    }
                    clearTimeout(lastKeyTimeout);
                    lastKeyTimeout = setTimeout(doSearch, 100);
            } else {
                $.get('/game/getGames', account.getGames, 'json');
            }
        },100);
    },      
    getGames: function(r) {
        $('#gameList').find('h3').remove();
        for (var i in r) {
            account.appendGame(r[i]);
        }
        $('#gameList').find('.openGames').tooltip();
    },
    appendGame: function(r) {
        if (!r || !r.players) return;
        var players = [];
        for (var i in r.players) players.push(r.players[i].name);
        $('#gameList').append("<h3>"+
            "<a id='game_" + r._id + "' class='openGames block' data-placement='top' data-toggle='tooltip' title='Players: " + players + "' href='/game/playGame?game=" + r._id + 
            "'><span class='glyphicon glyphicon-circle-arrow-right'></span> " + r.name + " (" + r.players.length + " of " + r.totalplayers + " players)"+
            "</a></h3>");
    },
    post: function(e) {
        var ok = true;
        var data = {};
        e.preventDefault();

        var gn = $('#gamename').val();
        $('#gamename').popover('hide');
        $('#total').popover('hide');
        /* some basic validation */
        if (!gn.replace(/[a-zA-Z0-9 \.\-\_]/, '')) {
            $('#gamename').popover('show');
            ok=false;
        }
        var np = $('#total').val();
        if (parseInt(np) != np || np > 4 || np < 1) {
            $('#total').popover('show');
            ok=false;
        }

        if (ok) {
            $(this).find('input').each(function() {
                data[$(this).attr('name')] = $(this).val();
            });
            data.isprivate = (data.isprivate == 'private');
            $.ajax({
                url: $(this).attr('action'),
                dataType: 'json',
                method: 'post',
                data: data,
                success: function(r) {
                    account.direct('/game/playGame?game=' + r.id);
                }
            });
        }
        return false;
    },
    direct: function(s) {
        window.location.href = s;
    },
    sendMessage: function(msg) {
        $('#msgCopy').html(msg);
        account.dialog('#dialog');
    },
    dialog: function(dlg) {
        $(dlg).modal();
    },
    getPlayer: function(id) {
        for (var i in players)
            if (id == players[i].id) return players[i];
    }
};



$(document).ready(function() {
    account.init();
});

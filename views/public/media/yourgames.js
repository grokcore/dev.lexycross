/*

*/

jQuery(function() {

    var setRange=function() {this.setSelectionRange(0, this.value.length); };
    $('#yourGames div').tooltip();
    $('#yourGames input').each(function() {
        $(this).val( window.location.href.replace('account/game','game/playGame?game=')+$(this).data().id );
        $(this).click(setRange);

    });
    
});

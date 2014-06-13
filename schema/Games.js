'use strict';

exports = module.exports = function(app, mongoose) {
  var gameSchema = new mongoose.Schema({
    created: { type: Date },
    started: { type: Date },
    creator: { type: String },/* _id of creating user */
    players: { type: Array, default: [] },/* array of player user objects */
    playerIndex: { type: Object, default: {} },/* object of players ID's as keys for index lookups (who plays what game) on user's games ($exists}:true */
    gameoptions: { type: Object, default: {} },/* Various game options, { dictionary: '', allowonlookers:false }*/
    size: { type: Number, default: 15 },/*size of the board */
    name: { type: String, default: '' },/*player named game*/
    isprivate: { type: Boolean, default: '' },/*is it viewable from the public index*/
    totalplayers: { type: Number, default: 0},/*number of players before the game will start */
    type: { type: String, default: '' },/*public / private / tbd */
    password: { type: String, default: ''},
    status: { type: String, default: '' },/* open (waiting for players to join) / inprogress */
    rank: { type: Array, default: [] },/* the rank/(points,occurance) for the letters */
    board: { type: Array, default: [] },/* the board (2D array of objects) */
    shadowboard: { type: Array, default: [] },/* the board (2D array of objects) used for processing scores */
    box: { type: Array, default: [] },/* the box AKA the bag, containing the peices */
    messages: { type: Array, default: [] }, /* record for chat messages */
    bonus: { type: Array, default: [] },/* the bonus (2D array of objects) */
    winner: { type: Array, default: [] },/* which player won the game */
    turn: { type: Number, default: 0 },/* which players turn it is, index of in players[] */
    movecount: { type: Number, default: 0 },/*number of moves played*/
    scoreboard: { type: Array, default: [] },/* score board for the game */
  });
  //gameSchema.plugin(require('./plugins/pagedFind'));
  //gameSchema.index({ name: 1 });
  //gameSchema.set('autoIndex', (app.get('env') === 'development'));
  app.db.model('Games', gameSchema);
};

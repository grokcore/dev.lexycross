var zmq       = require('zmq')
  , requester = zmq.socket('req');

gridSize=15;
grid=[];
for (y=0; y<gridSize; y++) {
    grid[y]=[];
    for (x=0; x<gridSize; x++) {
        grid[y][x]={letter:'',score:0};
    }
} 

testWord="SERPENT";
for (x=4; x<4+testWord.length; x++) {
    grid[7][x].letter=testWord[x-4];
    grid[7][x].score=2;
}


requester.connect('tcp://localhost:5502');
requester.on('message', function(msg) {
  console.log('got reply', msg.toString());
});

data={};
data.grid=grid;
data.rack="SERPENT";

requester.send(JSON.stringify(data));


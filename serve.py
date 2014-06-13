import zmq
import json
import logging
import time
import sys
sys.path.append('/var/www/dev.lexicross/wordsmithed')
import smith

logging.basicConfig()


class wordSmither():
    def playMove(self,jsonp):
        data=json.loads(jsonp)
        print "GOT DATA"
        print data

        #lets just let nothing go wrong if we can
        try:
            data['puresuccess']
            return "TEST TRUE"
        except:
            True

        try:
            gridSize=data.gridSize
        except:
            gridSize=15
        try:
            startPosition=(data.startPosition[0],data.startPosition[1])
        except:
            startPosition=(7,7)
        try:
            grid=data['grid']
        except:
            print "no grid"
            return {error:"NO GRID"}
        try:
            rack=data['rack']
        except:
            rack="ZZZZZZZ"

        returnPlay=smith.run(gridSize,startPosition,grid,rack,9)
        returnString=json.dumps(returnPlay);

        return returnString

smither=wordSmither()

context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind("tcp://127.0.0.1:5502")
while True:
    message = socket.recv()
    socket.send(smither.playMove(message))



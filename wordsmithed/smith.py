import sys, board, bag, player, human, ai, heuristic, tile
import logging
logging.basicConfig()


##main
def run(gridSize,startPosition,playBoard,rack,difficulty):
    #print "runRun"
    if difficulty not in range(1,10):
        print "difficulty range error"
        raise NameError("Invalid difficulty")
        return False
    
    #wordsmith handles 
    active = 0
    players = []
    #print "bag"
    theBag = bag.Bag()
    #print theBag
    theBoard = board.Board(gridSize,startPosition)
    #print "board"
    #print theBoard
    #setup our board data we recieved
    for boardY in range(gridSize):
        for boardX in range(gridSize):
            try:
                playTile=playBoard[boardY][boardX]
            except:
                continue
            try:
                playLetter=playTile['letter']
            except:
                continue
            try:
                playScore=playTile['score']
            except:
                playScore=1

            if playLetter=='':
                continue

            wsTile=tile.Tile(playTile['letter'],playScore)

            theBoard.squares[boardY][boardX] = (wsTile, theBoard.squares[boardX][boardY][1])
            theBoard.squares[boardY][boardX][0].locked=True

    #todo fix this up / no hard coded spots
    firstTurn=True
    if theBoard.squares[7][7][0]:
        firstTurn=False

    print "FIRST TURN?"
    print firstTurn
    #print "***PLAYING THE BOARD***"
    #printBoard(theBoard)
    print "RACK:"
    print rack

    #print "engine!"
    h = heuristic.notEndGameHeuristic(heuristic.tileQuantileHeuristic(0.5, 1.0))
    #print "playeru!"
    players.append(ai.AI(theBoard, theBag, theHeuristic = h, theDifficulty = difficulty))
    #print "TRAY!"
    players[active].tray=setTray(rack)
    #print "EXECUTE!!"
    playedMove = players[active].executeTurn(firstTurn)
    #print "OK!"

    if playedMove:
    #   print "PLAYED!"
        success = players[active].play(firstTurn)
    else:
        #pass
        return False;

    # remap for our game
    returnPlay=[]
    for move in playedMove:
        for what in move:
            #where was it was in the rack
            index=rack.index(what[1].letter)
            rack=rack[0:index]+'*'+rack[index+1:len(rack)]
            returnPlay.append({'letter': what[1].letter, 'x' :what[0][1], 'y': what[0][0], 'index': index})

    return returnPlay


#for debugging
def printBoard(theBoard):
    for row in theBoard.squares:
        for cell in row:
            if (cell[0]):
                sys.stdout.write(cell[0].letter)
            else:
                sys.stdout.write(' ')
        print ''


def setTray(word):
    tiles=[]
    for n in range(0,len(word)):
        tiles.append(tile.Tile(word[n],1))
    return tiles



#testplay
def testPlay():
    foo={'letter':'','score':''}
    b=[[{} for i in range(15)] for j in range(15)]

    b[6][7]['letter']='D'
    b[7][7]['letter']='A'
    b[8][7]['letter']='Y'

    run(15,(7,7),b,"SERPENT",9)

#testPlay()

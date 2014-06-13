#!/usr/bin/python
import random, sys, board, bag, player, human, ai, heuristic, tile
from random import randint


##main
def testRun():
    firstTurn=True

    theBag = bag.Bag()
    theBoard = board.Board(15,(7,7))

    boardY=7
    for boardX in range(4,11):
        testTile=tile.Tile("A", 1)
        theBoard.squares[boardY][boardX] = (testTile, theBoard.squares[boardX][boardY][1])
        theBoard.squares[boardY][boardX][0].locked=True

    printBoard(theBoard)

    players = []
    h = heuristic.notEndGameHeuristic(heuristic.tileQuantileHeuristic(0.1, 1.0))

    players.append(ai.AI(theBoard, theBag, theHeuristic = h, theDifficulty = 10.0))

    active = 0
    print "OK"
    #calculate the move
    rack="SERPENT"
    max=9
    for x in range(0,1000000):
        players[active].tray=setTray(rack)
        playedMove = players[active].executeTurn(firstTurn)
        #play that move.. if it played
        success = players[active].play(firstTurn)
        #printBoard(theBoard)
        firstTurn=False


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




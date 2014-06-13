import zmq
import time

context = zmq.Context()
socket = context.socket(zmq.REP)

socket.bind("tcp://127.0.0.1:5502")
print "Bound to port 5502."

while True:
    message = socket.recv()
    time.sleep(10)
    socket.send(message + " Blancmange!")

from socketIO_client import SocketIO

def on_bbb_response(*args):
    print 'on_bbb_response', args

with SocketIO('localhost', 9080) as socketIO:
    socketIO.emit('bbb', {'xxx': 'yyy'}, on_bbb_response)
    socketIO.wait_for_callbacks(seconds=0)

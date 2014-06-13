jQuery(function() {
    socket=new io.connect('http://dev.lexycross.com:80');
    socket.on('connect',function() { alert('WOO'); });
});

// Fix WebSocket connection for network access
// This script helps the React dev server WebSocket work from different devices

(function() {
  if (typeof WebSocket !== 'undefined') {
    const originalWebSocket = WebSocket;
    
    window.WebSocket = function(url, protocols) {
      // Fix localhost WebSocket URLs to use current hostname
      if (url.includes('localhost') && window.location.hostname !== 'localhost') {
        url = url.replace('localhost', window.location.hostname);
        console.log('🔧 Fixed WebSocket URL for network access:', url);
      }
      
      return new originalWebSocket(url, protocols);
    };
    
    // Copy static methods
    Object.setPrototypeOf(window.WebSocket, originalWebSocket);
    window.WebSocket.prototype = originalWebSocket.prototype;
  }
})();

console.log('🌐 WebSocket network fix loaded');

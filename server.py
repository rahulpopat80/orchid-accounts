import http.server
import socketserver
import webbrowser
import threading
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    # Change working directory to script location
    os.chdir(DIRECTORY)
    
    # Create the server
    handler = Handler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving Tally Accounting App at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server.")
        
        # Start browser in a separate thread
        threading.Timer(1.0, open_browser).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.shutdown()

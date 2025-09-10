# HTTPS Solutions for Network Video Access

## Option 1: ngrok (Recommended for Development)

### Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Setup HTTPS tunnel
```bash
# In frontend directory, start React app
npm start  # Runs on localhost:3000

# In another terminal, create HTTPS tunnel
ngrok http 3000
```

### Access from other laptop
```
https://abc123.ngrok.io  # Use the HTTPS URL ngrok provides
```

## Option 2: Browser Development Flags (Chrome)

### Temporarily disable secure context requirement
```bash
# Launch Chrome with flags (DEVELOPMENT ONLY!)
google-chrome --unsafely-treat-insecure-origin-as-secure=http://10.100.1.151:3000 --user-data-dir=/tmp/chrome-dev
```

### Or add localhost exception
```bash
# Add to Chrome flags
--allow-running-insecure-content
--disable-web-security
```

## Option 3: Self-Signed SSL Certificate

### Generate certificate
```bash
# Install mkcert
brew install mkcert
mkcert -install

# Generate certificate for your IP
mkcert 10.100.1.151 localhost 127.0.0.1
```

### Update React dev server
```bash
# Set environment variables
export HTTPS=true
export SSL_CRT_FILE=./10.100.1.151+2.pem
export SSL_KEY_FILE=./10.100.1.151+2-key.pem

# Start with HTTPS
npm start
```

## Recommended Approach
1. **Development**: Use Option 1 (ngrok) - simple and secure
2. **Production**: Proper SSL certificate with domain name
3. **Quick fix**: Set up frontend locally on other laptop

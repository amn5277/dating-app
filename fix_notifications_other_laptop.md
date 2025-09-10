# 🔔 Fix: Notifications Not Working on Other Laptop

## 📋 **Problem Diagnosis**

The other laptop is not receiving video call notifications because it cannot connect to the backend API. The frontend is trying to reach:
```
http://10.101.83.3:8004
```

But this IP address may not be accessible from the other laptop due to network issues.

---

## 🔍 **Step-by-Step Debugging**

### **Step 1: Check Network Connectivity**

On the **other laptop**, open browser developer console (F12) and look for errors like:
- `Failed to fetch`
- `Network Error`  
- `CORS Error`
- `ERR_CONNECTION_REFUSED`

### **Step 2: Test API Connection**

On the **other laptop**, try accessing the backend directly in browser:
```
http://10.101.83.3:8004/health
```

**Expected**: Should show `{"status": "healthy"}` 
**If it fails**: Network connectivity issue

---

## 🛠️ **Fix Solutions**

### **Solution 1: Get Correct IP Address (Recommended)**

On the **laptop running the backend** (this one), run:
```bash
# Get the current IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or use this simpler command
hostname -I
```

**Current backend is running on IP: `10.101.83.3`**

---

### **Solution 2: Update Frontend API URL**

On the **other laptop**, you have two options:

#### **Option A: Quick Fix - Update API URL**
1. Open the project folder
2. Edit `frontend/src/utils/api.ts`
3. Change line 5 to the correct IP:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://[CORRECT_IP]:8004';
```

#### **Option B: Environment Variable (Better)**
1. Create `frontend/.env` file with:
```bash
REACT_APP_API_URL=http://[CORRECT_IP]:8004
```
2. Restart the frontend: `npm start`

---

### **Solution 3: Network Troubleshooting**

If the IP address is correct but still not working:

#### **Check Firewall (Backend Laptop)**
```bash
# macOS - Allow port 8004
sudo ufw allow 8004
# Or disable firewall temporarily
sudo ufw disable
```

#### **Check if Backend is Running on All Interfaces**
The backend should show:
```
🔍 Starting server on all network interfaces (0.0.0.0:8004)...
```

If it shows `127.0.0.1`, it's only accepting local connections.

---

### **Solution 4: Same Network Check**

Both laptops must be on the **same WiFi network**:

#### **Check Network (Both Laptops)**
```bash
# macOS/Linux
ifconfig | grep "inet " | head -3

# Windows  
ipconfig
```

**Both should have similar IP ranges like:**
- Laptop 1: `10.101.83.3`
- Laptop 2: `10.101.83.x` (same first 3 numbers)

---

## 🚀 **Quick Test Script**

Create this test file on the **other laptop**:

**`test_backend_connection.html`**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Backend Connection Test</title>
</head>
<body>
    <h1>Testing Backend Connection</h1>
    <div id="result"></div>
    
    <script>
        async function testConnection() {
            const resultDiv = document.getElementById('result');
            const backendURL = 'http://10.101.83.3:8004';
            
            try {
                // Test health endpoint
                const response = await fetch(`${backendURL}/health`);
                if (response.ok) {
                    const data = await response.json();
                    resultDiv.innerHTML = `
                        <p style="color: green;">✅ Backend Connected Successfully!</p>
                        <p>Response: ${JSON.stringify(data)}</p>
                        <p>Notifications should work now.</p>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <p style="color: red;">❌ Backend responded but with error</p>
                        <p>Status: ${response.status}</p>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <p style="color: red;">❌ Cannot connect to backend</p>
                    <p>Error: ${error.message}</p>
                    <p><strong>Solutions:</strong></p>
                    <ul>
                        <li>Check if both laptops are on same WiFi</li>
                        <li>Check if backend is running on 10.101.83.3:8004</li>
                        <li>Update the IP address in frontend/src/utils/api.ts</li>
                        <li>Check firewall settings</li>
                    </ul>
                `;
            }
        }
        
        // Test immediately when page loads
        testConnection();
    </script>
</body>
</html>
```

Open this HTML file in browser on the other laptop to test connectivity.

---

## 🎯 **Expected Results After Fix**

Once the connection is working, the **other laptop** should:

1. ✅ **See notifications** every 3 seconds when someone starts a video call
2. ✅ **Bouncing notification** with "📞 Incoming Call" or "💕 Mutual Match Calling!"
3. ✅ **Join Call button** that works properly
4. ✅ **Real-time updates** when calls are started/ended

---

## 🚨 **Alternative: Deploy for Easy Testing**

If network issues persist, deploy the app for instant HTTPS access:
```bash
# Deploy everything
./deploy_all.sh
```

This gives you:
- ✅ HTTPS URLs that work from anywhere
- ✅ No network configuration needed
- ✅ Professional testing environment
- ✅ Full camera access on all devices

---

## 🔧 **Debug Commands Summary**

Run these on the **other laptop** to debug:

```bash
# 1. Test backend connectivity
curl http://10.101.83.3:8004/health

# 2. Check your IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# 3. Test API endpoint
curl http://10.101.83.3:8004/api/video/pending-calls \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ✅ **Quick Checklist**

- [ ] Both laptops on same WiFi network?
- [ ] Backend running and showing `0.0.0.0:8004`?
- [ ] Firewall allowing port 8004?
- [ ] Frontend API URL pointing to correct IP?
- [ ] Browser console showing errors?
- [ ] Test HTML file confirms connectivity?

**Once these are all checked, notifications should work perfectly!** 🎉

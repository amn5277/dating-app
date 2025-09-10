// Network Connection Debug Script for Dating App
// Run this in browser console on the OTHER LAPTOP to diagnose notification issues

console.log('🔍 Dating App Network Debug Tool');
console.log('================================');

async function debugConnection() {
  const backendURL = 'http://10.101.83.3:8004';
  
  console.log(`🎯 Testing connection to: ${backendURL}`);
  
  // Test 1: Basic connectivity
  console.log('\n📡 Test 1: Basic Backend Connectivity');
  try {
    const response = await fetch(`${backendURL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is reachable!', data);
    } else {
      console.log('❌ Backend responded with error:', response.status);
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend:', error.message);
    console.log('\n🛠️ SOLUTIONS:');
    console.log('1. Check if both laptops are on the same WiFi network');
    console.log('2. Make sure backend is running on the other laptop');
    console.log('3. Check firewall settings');
    console.log('4. Try updating the IP address in api.ts');
    return;
  }

  // Test 2: CORS headers
  console.log('\n🌐 Test 2: CORS Configuration');
  try {
    const response = await fetch(`${backendURL}/health`);
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    console.log('✅ CORS Headers:', corsHeaders);
  } catch (error) {
    console.log('❌ CORS Error:', error.message);
  }

  // Test 3: Authentication check
  console.log('\n🔑 Test 3: Authentication Status');
  const token = localStorage.getItem('token');
  if (token) {
    console.log('✅ JWT Token found in localStorage');
    
    try {
      const response = await fetch(`${backendURL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Authentication working:', userData.email);
      } else {
        console.log('❌ Authentication failed:', response.status);
      }
    } catch (error) {
      console.log('❌ Auth request failed:', error.message);
    }
  } else {
    console.log('❌ No JWT token found - user might not be logged in');
  }

  // Test 4: Pending calls endpoint
  console.log('\n📞 Test 4: Pending Calls Endpoint');
  if (token) {
    try {
      const response = await fetch(`${backendURL}/api/video/pending-calls`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pending calls endpoint working:', data);
        
        if (data.pending_calls && data.pending_calls.length > 0) {
          console.log('🔔 NOTIFICATIONS SHOULD BE WORKING!');
          console.log('Pending calls found:', data.pending_calls);
        } else {
          console.log('ℹ️ No pending calls right now');
        }
      } else {
        console.log('❌ Pending calls endpoint failed:', response.status);
      }
    } catch (error) {
      console.log('❌ Pending calls request failed:', error.message);
    }
  }

  // Test 5: Real-time polling simulation
  console.log('\n⏱️ Test 5: Notification Polling Simulation');
  console.log('Running 3 test polls (like the notification system)...');
  
  for (let i = 1; i <= 3; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      const response = await fetch(`${backendURL}/api/video/pending-calls`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Poll ${i}/3: ✅ Success - ${data.pending_calls.length} pending calls`);
      } else {
        console.log(`Poll ${i}/3: ❌ Failed - ${response.status}`);
      }
    } catch (error) {
      console.log(`Poll ${i}/3: ❌ Error - ${error.message}`);
    }
  }

  console.log('\n🎉 Debug complete!');
  console.log('\n📋 SUMMARY:');
  console.log('If all tests passed: Notifications should be working!');
  console.log('If tests failed: Check the specific error messages above');
  console.log('\n🛠️ Common fixes:');
  console.log('1. Make sure both laptops are on the same WiFi');
  console.log('2. Update IP address in frontend/src/utils/api.ts');
  console.log('3. Restart both backend and frontend servers');
  console.log('4. Clear browser cache and reload');
}

// Auto-run the debug
debugConnection().catch(console.error);

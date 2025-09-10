// Test API connection to the network backend
const API_URL = 'http://192.168.1.100:8004';

console.log('🔍 Testing API connection to:', API_URL);
console.log('=====================================');

// Test 1: Health check
fetch(`${API_URL}/health`)
  .then(response => response.json())
  .then(data => {
    console.log('✅ Health check successful:', data);
  })
  .catch(error => {
    console.error('❌ Health check failed:', error.message);
  });

// Test 2: API docs
fetch(`${API_URL}/docs`)
  .then(response => {
    if (response.ok) {
      console.log('✅ API docs accessible');
    } else {
      console.log('❌ API docs not accessible:', response.status);
    }
  })
  .catch(error => {
    console.error('❌ API docs check failed:', error.message);
  });

// Test 3: Try to get interests (public endpoint)
setTimeout(() => {
  fetch(`${API_URL}/interests`)
    .then(response => response.json())
    .then(data => {
      console.log('✅ Interests endpoint working, found', data.length, 'interests');
    })
    .catch(error => {
      console.error('❌ Interests endpoint failed:', error.message);
    });
}, 1000);

console.log('');
console.log('💡 If tests pass, your frontend is configured correctly!');
console.log('📱 Frontend should connect to backend at:', API_URL);

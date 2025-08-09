import axios from 'axios';

async function testBackend() {
  try {
    console.log('Testing backend health endpoint...');
    const healthResponse = await axios.get('http://localhost:3001/api/health');
    console.log('Health check:', healthResponse.data);
    
    console.log('\nTesting models endpoint...');
    const modelsResponse = await axios.get('http://localhost:3001/api/models');
    console.log('Models response status:', modelsResponse.status);
    console.log('Number of models:', modelsResponse.data.data?.length || modelsResponse.data.length);
    
    console.log('\nBackend is working correctly!');
  } catch (error) {
    console.error('Error testing backend:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testBackend();
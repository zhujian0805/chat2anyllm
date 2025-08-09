import axios from 'axios';
import { getBackendEndpoint } from './env';

const backend = getBackendEndpoint();

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${backend}/api/health`);
    return response.status === 200;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
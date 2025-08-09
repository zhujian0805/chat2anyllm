import axios from 'axios';
import { RoleDef } from '../types';
import { getBackendEndpoint } from './env';
import { getAuthHeaders, handleAuthError } from './authAPI';

const backend = getBackendEndpoint();

export async function listRoles(): Promise<RoleDef[]> {
  try {
    const { data } = await axios.get(`${backend}/api/roles`, {
      headers: getAuthHeaders()
    });
    return data;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function createRole(name: string, instructions: string): Promise<RoleDef> {
  try {
    const { data } = await axios.post(`${backend}/api/roles`, { name, instructions }, {
      headers: getAuthHeaders()
    });
    return data;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function updateRole(id: string, patch: Partial<Pick<RoleDef,'name'|'instructions'>>): Promise<RoleDef> {
  try {
    const { data } = await axios.put(`${backend}/api/roles/${id}`, patch, {
      headers: getAuthHeaders()
    });
    return data;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function deleteRole(id: string): Promise<void> {
  try {
    await axios.delete(`${backend}/api/roles/${id}`, {
      headers: getAuthHeaders()
    });
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

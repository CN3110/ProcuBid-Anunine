import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error || 
                   error.response?.data?.message || 
                   error.message || 
                   'Request failed';
    console.error('API Error:', message);
    throw new Error(message);
  }
);

export const addBidder = async (bidderData) => {
  try {
    console.log('Adding bidder:', bidderData);
    const response = await api.post('/admin/bidders', bidderData);
    return response;
  } catch (error) {
    console.error('Full error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(error.response?.data?.error || error.message || 'Failed to add bidder');
  }
};

export const fetchBidders = async () => {
  try {
    const response = await api.get('/admin/bidders');
    // Ensure we return an array even if the response is unexpected
    return response.bidders || [];
  } catch (error) {
    console.error('Error fetching bidders:', error);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
};

export const deactivateBidder = async (bidderId) => {
  try {
    const response = await api.patch(`/bidders/${bidderId}/deactivate`);
    return response;
  } catch (error) {
    console.error('Deactivation failed:', error.response?.data || error.message);
    throw error;
  }
};

export const reactivateBidder = async (bidderId) => {
  try {
    const response = await api.patch(`/bidders/${bidderId}/reactivate`);
    return response;
  } catch (error) {
    console.error('Reactivation failed:', error.response?.data || error.message);
    throw error;
  }
};
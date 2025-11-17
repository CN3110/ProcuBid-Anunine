import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
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


//get live auctions for invited bidders
export const getLiveAuctionsForBidder = async () => {
  try {
    const response = await axios.get(`/auction/live/bidder`);
    return response.data.auction;
  } catch (error) {
    console.error('Error fetching live auction:', error);
    throw error;
  }
};

export const placeBid = async (auctionId, amount) => {
  try {
    const response = await axios.post(`/auction/${auctionId}/bids`, { amount });
    return response.data;
  } catch (error) {
    console.error('Error placing bid:', error);
    throw error;
  }
};

export const getBidderRank = async (auctionId) => {
  try {
    const response = await axios.get(`/auction/${auctionId}/rankings`);
    return response.data.rankings.find(rank => rank.bidder_id === localStorage.getItem('userId'));
  } catch (error) {
    console.error('Error fetching bidder rank:', error);
    throw error;
  }
};

export const getMinBidAmount = async (auctionId) => {
  try {
    const response = await axios.get(`/auction/${auctionId}/min-bid`);
    return response.data.minBid;
  } catch (error) {
    console.error('Error fetching min bid amount:', error);
    throw error;
  }
};

export default {
  getLiveAuctions,
  placeBid,
  getBidderRank,
  getMinBidAmount
};
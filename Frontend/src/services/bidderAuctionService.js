import moment from 'moment-timezone';

/**
 * Auction Service
 * Handles all API calls and business logic for the LiveAuction component
 */
const API_URL = import.meta.env.VITE_API_URL;

// ==================== Helper Functions ====================

/**
 * Get authorization headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Get currency symbol based on currency code
 */
export const getCurrencySymbol = (currency) => {
  switch (currency) {
    case 'USD': return '$';
    case 'LKR': return 'Rs.';
    default: return '';
  }
};

/**
 * Format currency amount with symbol
 */
export const formatCurrency = (amount, currency = 'LKR') => {
  if (!amount && amount !== 0) return "Not specified";
  
  const symbol = currency === 'USD' ? '$' : 'RS. ';
  
  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

/**
 * Get current Sri Lanka time
 */
export const getCurrentSLTime = () => {
  return moment().tz('Asia/Colombo').format('DD MMM YYYY, h:mm:ss A');
};

/**
 * Parse Sri Lanka datetime from backend response
 */
export const parseSLDateTime = (start_datetime_sl) => {
  try {
    if (!start_datetime_sl || start_datetime_sl === 'Invalid date') {
      console.warn('Invalid start_datetime_sl:', start_datetime_sl);
      return null;
    }
    
    // The backend now provides properly formatted SL datetime string like "2025-08-19 09:01:00"
    const parsed = moment.tz(start_datetime_sl, 'YYYY-MM-DD HH:mm:ss', 'Asia/Colombo');
    
    if (!parsed.isValid()) {
      console.error('Failed to parse SL datetime:', start_datetime_sl);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing SL datetime:', error);
    return null;
  }
};

/**
 * Format datetime to Sri Lanka time display format
 */
export const formatToSLTime = (dateTime) => {
  try {
    if (!dateTime) return 'Invalid date';
    if (moment.isMoment(dateTime)) {
      return dateTime.format('DD MMM YYYY, h:mm:ss A');
    }
    return moment(dateTime).tz('Asia/Colombo').format('DD MMM YYYY, h:mm:ss A');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Check if auction is currently live
 */
export const isAuctionLive = (auctionItem) => {
  if (!auctionItem) return false;
  
  try {
    // Use the backend's calculation
    return auctionItem.calculated_status === 'live' && auctionItem.is_live === true;
  } catch (error) {
    console.error('Error checking auction status:', error);
    return false;
  }
};

/**
 * Calculate time remaining for auction
 */
export const calculateTimeRemaining = (auction) => {
  if (!auction) return 'Auction Ended';

  try {
    const now = moment().tz('Asia/Colombo');
    
    // Use the end time provided by backend
    let auctionEnd;
    if (auction.end_datetime_sl && auction.end_datetime_sl !== 'Invalid date') {
      auctionEnd = parseSLDateTime(auction.end_datetime_sl);
    } else if (auction.time_remaining_ms && auction.time_remaining_ms > 0) {
      // Fallback: calculate end time from remaining time
      auctionEnd = now.clone().add(auction.time_remaining_ms, 'milliseconds');
    } else {
      return 'Auction Ended';
    }
    
    if (!auctionEnd || !auctionEnd.isValid()) {
      return 'Invalid time';
    }

    const timeRemaining = moment.duration(auctionEnd.diff(now));
    
    console.log('Timer calculation:', {
      now: now.format(),
      auctionEnd: auctionEnd.format(),
      timeRemainingMs: timeRemaining.asMilliseconds(),
      backendTimeRemaining: auction.time_remaining_ms
    });
    
    if (timeRemaining.asMilliseconds() <= 0) {
      return 'Auction Ended';
    } else {
      const totalSeconds = Math.floor(timeRemaining.asSeconds());
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error calculating time remaining:', error);
    return 'Error';
  }
};

// ==================== API Functions ====================

/**
 * Fetch live auction data from the API
 */
export const fetchLiveAuction = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please login to access auctions');
    }

    const response = await fetch(`${API_URL}/auction/live/bidder`, {
      headers: getAuthHeaders()
    });
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch live auction: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Fetched auction data:', data);
    
    return {
      auctions: Array.isArray(data.auctions) ? data.auctions : [],
      futureAuctions: Array.isArray(data.future_auctions) ? data.future_auctions : [],
      pastAuctions: Array.isArray(data.past_auctions) ? data.past_auctions : []
    };
  } catch (error) {
    console.error('Error fetching live auction:', error);
    throw error;
  }
};

/**
 * Place a bid on an auction
 */
export const placeBid = async (auctionId, amount) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/bid/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        amount: parseFloat(amount),
        auction_id: auctionId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to place bid');
    }

    return await response.json();
  } catch (error) {
    console.error('Error placing bid:', error);
    throw error;
  }
};

/**
 * Fetch bidder rank for a specific auction
 */
export const fetchBidderRank = async (auctionId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/bid/rank?auction_id=${auctionId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch bidder rank');

    const data = await response.json();
    return {
      rank: data.rank,
      totalBidders: data.totalBidders
    };
  } catch (error) {
    console.error('Error fetching bidder rank:', error);
    return { rank: null, totalBidders: 0 };
  }
};

/**
 * Fetch latest bid for a specific auction
 */
export const fetchLatestBid = async (auctionId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/bid/latest?auction_id=${auctionId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch latest bid');

    const data = await response.json();
    return data.bid;
  } catch (error) {
    console.error('Error fetching latest bid:', error);
    return null;
  }
};

/**
 * Fetch complete auction data including bidder information
 */
export const fetchAuctionData = async () => {
  try {
    const { auctions, futureAuctions, pastAuctions } = await fetchLiveAuction();
    
    // Find live auction from the live auctions array
    let liveAuction = null;
    
    if (auctions && auctions.length > 0) {
      liveAuction = auctions.find(auc => 
        auc.calculated_status === 'live' && auc.is_live === true
      );
    }
    
    if (!liveAuction) {
      console.log('No live auction found');
      
      // Check if there are upcoming auctions
      if (futureAuctions && futureAuctions.length > 0) {
        console.log('Found future auctions:', futureAuctions.length);
      }
      
      return {
        auction: null,
        bidderInfo: { rank: null, latestBid: null, totalBidders: 0 },
        futureAuctions,
        pastAuctions
      };
    }

    console.log('Found live auction:', liveAuction);
    
    // Fetch additional data for the live auction
    const [rankData, latestBid] = await Promise.all([
      fetchBidderRank(liveAuction.id),
      fetchLatestBid(liveAuction.id)
    ]);
    
    return {
      auction: liveAuction,
      bidderInfo: {
        rank: rankData?.rank || null,
        latestBid: latestBid?.amount || null,
        totalBidders: rankData?.totalBidders || 0
      },
      futureAuctions,
      pastAuctions
    };
  } catch (error) {
    console.error('Error fetching auction data:', error);
    throw error;
  }
};

/**
 * Validate bid amount
 */
export const validateBidAmount = (bidAmount, auction) => {
  if (!bidAmount || isNaN(bidAmount)) {
    return { valid: false, message: 'Please enter a valid number for bid amount' };
  }

  if (parseFloat(bidAmount) <= 0) {
    return { valid: false, message: 'Bid amount must be greater than 0' };
  }

  if (!auction || !isAuctionLive(auction)) {
    return { valid: false, message: 'Auction is not currently live' };
  }

  return { valid: true, message: '' };
};

export default {
  // API Functions
  fetchLiveAuction,
  placeBid,
  fetchBidderRank,
  fetchLatestBid,
  fetchAuctionData,
  
  // Helper Functions
  getCurrencySymbol,
  formatCurrency,
  getCurrentSLTime,
  parseSLDateTime,
  formatToSLTime,
  isAuctionLive,
  calculateTimeRemaining,
  validateBidAmount
};
/**
 * Auction History Service
 * Handles all API calls and business logic for the AuctionHistory component
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
 * Get result badge class based on auction_results status
 */
export const getResultBadgeClass = (resultStatus) => {
  switch (resultStatus?.toLowerCase()) {
    case 'awarded':
      return 'bg-success';
    case 'short-listed':
      return 'bg-info';
    case 'not-short-listed':
      return 'bg-warning';
    case 'disqualified':
      return 'bg-danger';
    case 'not_awarded':
      return 'bg-secondary';
    case 'cancel':
    case 'cancelled':
      return 'bg-dark';
    case 'pending':
      return 'bg-warning';
    default:
      return 'bg-secondary';
  }
};

/**
 * Format result status for display
 */
export const formatResultStatus = (resultStatus) => {
  const statusMap = {
    'awarded': 'Awarded 🎉',
    'short-listed': 'Short-Listed 📋',
    'not-short-listed': 'Not Short-Listed',
    'disqualified': 'Disqualified ❌',
    'not_awarded': 'Not Awarded',
    'cancel': 'Cancelled 🚫',
    'cancelled': 'Cancelled 🚫',
    'pending': 'Pending Review'
  };
  return statusMap[resultStatus] || resultStatus;
};

/**
 * Get icon class for result status
 */
export const getResultIcon = (resultStatus) => {
  const iconMap = {
    'awarded': 'fas fa-trophy',
    'short-listed': 'fas fa-list',
    'not-short-listed': 'fas fa-times-circle',
    'disqualified': 'fas fa-times',
    'not_awarded': 'fas fa-times-circle',
    'cancel': 'fas fa-ban',
    'cancelled': 'fas fa-ban',
    'pending': 'fas fa-clock'
  };
  return iconMap[resultStatus?.toLowerCase()] || '';
};

/**
 * Calculate summary statistics from auction history
 */
export const calculateSummary = (historyData) => {
  if (!historyData || historyData.length === 0) {
    return {
      total_auctions_participated: 0,
      auctions_won: 0,
      auctions_shortlisted: 0,
      win_rate: 0
    };
  }

  const auctionsWon = historyData.filter(item => item.raw_status === 'awarded').length;
  const auctionsShortlisted = historyData.filter(item => item.raw_status === 'short-listed').length;
  const totalAuctions = historyData.length;
  
  return {
    total_auctions_participated: totalAuctions,
    auctions_won: auctionsWon,
    auctions_shortlisted: auctionsShortlisted,
    win_rate: totalAuctions > 0 ? Math.round((auctionsWon / totalAuctions) * 100) : 0
  };
};

/**
 * Format auction history data from API response
 */
export const formatHistoryData = (apiResults) => {
  if (!apiResults || !Array.isArray(apiResults)) {
    return [];
  }

  return apiResults.map(item => ({
    auction_id: item["Auction ID"],
    title: item["Title"],
    bid_amount: item["Best Bid Amount"],
    result: item["Result"],
    raw_status: item["Raw Status"],
    date_time: item["Date Time"],
    disqualification_reason: item["Disqualification Reason"],
    cancel_reason: item["Cancel Reason"],
    shortlisted_at: item["Shortlisted At"]
  }));
};

// ==================== API Functions ====================

/**
 * Fetch auction history from backend
 */
export const fetchAuctionHistory = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(
      `${API_URL}/auction/results/bidder/results`,
      {
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch auction results');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch auction results');
    }

    // Format the history data
    const formattedHistory = formatHistoryData(data.auctionResults);
    
    // Calculate summary statistics
    const summary = calculateSummary(formattedHistory);

    return {
      success: true,
      history: formattedHistory,
      summary: summary
    };

  } catch (error) {
    console.error('Error fetching auction results:', error);
    throw error;
  }
};

/**
 * Get auction details by ID
 */
export const fetchAuctionDetails = async (auctionId) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(
      `${API_URL}/auction/${auctionId}`,
      {
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch auction details');
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching auction details:', error);
    throw error;
  }
};

/**
 * Export auction history to CSV
 */
export const exportHistoryToCSV = (historyData) => {
  if (!historyData || historyData.length === 0) {
    throw new Error('No data to export');
  }

  // Create CSV header
  const headers = ['Auction ID', 'Title', 'Bid Amount', 'Result', 'Status', 'Date/Time'];
  
  // Create CSV rows
  const rows = historyData.map(item => [
    item.auction_id || 'N/A',
    item.title || 'Untitled',
    item.bid_amount || '0',
    item.result || 'N/A',
    item.raw_status || 'N/A',
    item.date_time || 'N/A'
  ]);

  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `auction_history_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Filter auction history by status
 */
export const filterHistoryByStatus = (historyData, status) => {
  if (!status || status === 'all') {
    return historyData;
  }

  return historyData.filter(item => item.raw_status?.toLowerCase() === status.toLowerCase());
};

/**
 * Sort auction history
 */
export const sortHistory = (historyData, sortBy = 'date', order = 'desc') => {
  if (!historyData || historyData.length === 0) {
    return [];
  }

  const sortedData = [...historyData];

  sortedData.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = new Date(b.date_time || 0) - new Date(a.date_time || 0);
        break;
      case 'bid_amount':
        comparison = (b.bid_amount || 0) - (a.bid_amount || 0);
        break;
      case 'auction_id':
        comparison = (a.auction_id || '').localeCompare(b.auction_id || '');
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      default:
        comparison = 0;
    }

    return order === 'desc' ? comparison : -comparison;
  });

  return sortedData;
};

/**
 * Search auction history
 */
export const searchHistory = (historyData, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return historyData;
  }

  const term = searchTerm.toLowerCase().trim();

  return historyData.filter(item => {
    return (
      (item.auction_id || '').toLowerCase().includes(term) ||
      (item.title || '').toLowerCase().includes(term) ||
      (item.result || '').toLowerCase().includes(term) ||
      (item.raw_status || '').toLowerCase().includes(term)
    );
  });
};

export default {
  // API Functions
  fetchAuctionHistory,
  fetchAuctionDetails,
  
  // Helper Functions
  formatCurrency,
  getResultBadgeClass,
  formatResultStatus,
  getResultIcon,
  calculateSummary,
  formatHistoryData,
  
  // Utility Functions
  exportHistoryToCSV,
  filterHistoryByStatus,
  sortHistory,
  searchHistory
};
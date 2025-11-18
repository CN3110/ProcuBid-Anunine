import React, { useState, useEffect, useCallback } from 'react';
import Card from '../Common/Card';
import Alert from '../Common/Alert';
import auctionService from '../../services/auctionService';

const LiveAuction = () => {
  // State management
  const [bidAmount, setBidAmount] = useState('');
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [auction, setAuction] = useState(null);
  const [bidderInfo, setBidderInfo] = useState({
    rank: null,
    latestBid: null,
    totalBidders: 0
  });
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTimeSL, setCurrentTimeSL] = useState('');

  // Alert helper
  const showAlert = useCallback((message, type) => {
    setAlert({ show: true, message, type });
    const timer = setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch auction data
  const fetchAuctionData = useCallback(async () => {
    try {
      setHasError(false);
      const result = await auctionService.fetchAuctionData();
      
      if (!result.auction) {
        setAuction(null);
        setBidderInfo({ rank: null, latestBid: null, totalBidders: 0 });
        console.log('No live auction found');
        
        if (result.futureAuctions && result.futureAuctions.length > 0) {
          console.log('Found future auctions:', result.futureAuctions.length);
        }
        return;
      }

      setAuction(result.auction);
      setBidderInfo(result.bidderInfo);
      
    } catch (error) {
      console.error('Error fetching auction data:', error);
      setHasError(true);
      
      if (error.message.includes('Session expired') || 
          error.message.includes('Please login')) {
        showAlert(error.message, 'danger');
      } else {
        showAlert(`Error fetching auction data: ${error.message}`, 'danger');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [showAlert]);

  // Update timer
  const updateTimer = useCallback(() => {
    if (!auction) return;

    try {
      const timeRemaining = auctionService.calculateTimeRemaining(auction);
      setCurrentTimeSL(auctionService.getCurrentSLTime());
      setTimeLeft(timeRemaining);
      
      if (timeRemaining === 'Auction Ended') {
        // Refresh auction data when auction ends
        setTimeout(() => fetchAuctionData(), 1000);
      }
    } catch (error) {
      console.error('Error updating timer:', error);
      setTimeLeft('Error');
    }
  }, [auction, fetchAuctionData]);

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setLoading(true);
      await fetchAuctionData();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle place bid
  const handlePlaceBid = async () => {
    // Validate bid
    const validation = auctionService.validateBidAmount(bidAmount, auction);
    if (!validation.valid) {
      showAlert(validation.message, 'danger');
      return;
    }

    setLoading(true);
    try {
      const result = await auctionService.placeBid(auction.id, bidAmount);
      showAlert('Bid placed successfully!', 'success');
      setBidAmount('');
      
      setBidderInfo(prev => ({
        ...prev,
        latestBid: parseFloat(bidAmount),
        rank: result.rank || prev.rank
      }));
      
      // Refresh auction data after placing bid
      await fetchAuctionData();
    } catch (error) {
      showAlert(error.message || 'Failed to place bid', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchAuctionData();
    setCurrentTimeSL(auctionService.getCurrentSLTime());
    
    // Refresh auction data every 5 seconds
    const interval = setInterval(() => {
      fetchAuctionData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchAuctionData]);

  useEffect(() => {
    if (auction) {
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [auction, updateTimer]);

  useEffect(() => {
    const timeTimer = setInterval(() => {
      setCurrentTimeSL(auctionService.getCurrentSLTime());
    }, 1000);
    
    return () => clearInterval(timeTimer);
  }, []);

  // Render states
  if (initialLoading) {
    return (
      <div className="live-auction text-center p-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading auction data...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="live-auction">
        <Alert 
          message="Failed to load auction data. Please refresh the page or try again later." 
          type="danger" 
        />
        <button 
          className="btn btn-primary mt-3" 
          onClick={() => {
            setHasError(false);
            setInitialLoading(true);
            fetchAuctionData();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="live-auction">
        <h2>Live Auction</h2>
        <div className="current-time-display text-center mb-3">
          <small className="text-muted">Current Time (Sri Lanka): </small>
          <strong>{currentTimeSL}</strong>
        </div>
        <Alert 
          message="Currently there are no live auctions available to you. Please check back later when the auction starts."
          type="info"
        />
        <button 
          className="btn btn-outline-primary mt-3" 
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    );
  }

  const auctionStatus = auction.calculated_status || 'unknown';
  const auctionStart = auctionService.parseSLDateTime(auction.start_datetime_sl);
  const auctionEnd = auctionService.parseSLDateTime(auction.end_datetime_sl);

  return (
    <div className="live-auction">
      <h2>Live Auction</h2>
      
      <div className="current-time-display text-center mb-3">
        <small className="text-muted">Current Time (Sri Lanka): </small>
        <strong className="text-primary">{currentTimeSL}</strong>
      </div>
      
      <div className="timer-container text-center mb-4">
        <div className={`timer display-4 fw-bold ${
          auctionStatus === 'live' ? 'text-danger' : 'text-secondary'
        }`}>
          {timeLeft}
        </div>
        <small className="text-muted">
          {auctionStatus === 'live' ? 'Time Remaining' : 'Auction Status'}
        </small>
      </div>
      
      <div className="row">
        <div className="col-md-6">
          <Card 
            title={
              <div className="d-flex justify-content-between align-items-center">
                <span>Place Your Bid</span>
              </div>
            }
          >
            <div className="user-info mb-3">
              <p className="mb-2">
                <strong>Your Current Rank:</strong> 
                <span className={`badge ms-2 ${
                  bidderInfo.rank === 1 ? 'bg-success' : 
                  bidderInfo.rank <= 3 ? 'bg-warning' : 
                  'bg-secondary'
                }`}>
                  {bidderInfo.rank ? `#${bidderInfo.rank}` : 'No rank yet'}
                </span>
              </p>
              <p className="mb-2">
                <strong>Your Latest Bid:</strong> 
                <span className="fw-bold text-success ms-2">
                  {bidderInfo.latestBid ? 
                    auctionService.formatCurrency(bidderInfo.latestBid) : 
                    'No bids yet'
                  }
                </span>
              </p>
            </div>

            <div className="bid-input">
              <div className="input-group mb-3">
                <span className="input-group-text">LKR</span>
                <input 
                  type="number" 
                  className="form-control"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter bid amount" 
                  min="0"
                  step="0.01"
                  disabled={loading || auctionStatus !== 'live'}
                />
              </div>
              <button 
                className="btn btn-primary w-100" 
                onClick={handlePlaceBid}
                disabled={loading || !bidAmount || auctionStatus !== 'live'}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Placing Bid...
                  </>
                ) : (
                  'Place Bid'
                )}
              </button>
            </div>

            {alert.show && (
              <Alert 
                message={alert.message} 
                type={alert.type}
                onClose={() => setAlert({ show: false, message: '', type: '' })}
              />
            )}
          </Card>
        </div>
        
        <div className="col-md-6">
          <Card title="Auction Details">
            <p><strong>Title:</strong> {auction.title}</p>
            <p><strong>Auction ID:</strong> {auction.auction_id}</p>
            <p><strong>Category:</strong> {auction.category}</p>
            <p><strong>SBU:</strong> {auction.sbu}</p>
            <p>
              <strong>Ceiling Price:</strong> {
                auction.ceiling_price ? 
                  auctionService.formatCurrency(auction.ceiling_price, auction.currency) : 
                  'Not specified'
              }
            </p> 
            <p>
              <strong>Step Amount:</strong> {
                auction.step_amount ? 
                  auctionService.formatCurrency(auction.step_amount, auction.currency) : 
                  'Not specified'
              }
            </p>
            <p>
              <strong>Start Date/Time:</strong> {
                auctionStart ? 
                  auctionService.formatToSLTime(auctionStart) : 
                  'Invalid date'
              }
            </p>
            <p>
              <strong>End Date/Time:</strong> {
                auctionEnd ? 
                  auctionService.formatToSLTime(auctionEnd) : 
                  'Invalid date'
              }
            </p>
            <p><strong>Duration:</strong> {auction.duration_minutes} minutes</p> 
            <p><strong>Time Until End:</strong> {auction.time_until_end}</p> 
            {auction.special_notices && (
              <div className="mt-3">
                <strong>Special Notices:</strong>
                <div className="alert alert-info mt-2 small">
                  {auction.special_notices}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LiveAuction;
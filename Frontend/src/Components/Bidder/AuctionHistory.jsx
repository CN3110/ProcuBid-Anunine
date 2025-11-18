import React, { useState, useEffect, useCallback } from 'react';
import Alert from '../Common/Alert';
import auctionHistoryService from '../../services/AuctionHistoryService.js';

const AuctionHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  // Fetch auction history from backend
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await auctionHistoryService.fetchAuctionHistory();
      
      if (result.success) {
        setHistory(result.history);
        setSummary(result.summary);
      }

    } catch (err) {
      console.error('Error fetching auction results:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refresh data
  const handleRefresh = () => {
    fetchHistory();
  };

  if (loading && history.length === 0) {
    return (
      <div className="auction-history">
        <h4 className="mb-3">Your Auction Results</h4>
        <div className="text-center p-4">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading your auction results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auction-history">
        <h4 className="mb-3">Your Auction Results</h4>
        <Alert 
          message={`Error loading auction results: ${error}`} 
          type="danger" 
        />
        <button 
          className="btn btn-primary mt-2" 
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Try Again'}
        </button>
      </div>
    );
  }

  return (
    <div className="auction-history">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Your Auction Results</h4>
          {summary && (
            <small className="text-muted">
              {summary.total_auctions_participated} auctions • {summary.auctions_won} awarded • {summary.auctions_shortlisted} shortlisted • {summary.win_rate}% success rate
            </small>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center p-5">
          <div className="mb-3">
            <i className="fas fa-history fa-3x text-muted"></i>
          </div>
          <h5 className="text-muted">No Auction Results</h5>
          <p className="text-muted">
            You haven't participated in any auctions yet.
            <br />
            Check the Live Auction tab to join active auctions.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="card text-center">
                  <div className="card-body">
                    <h5 className="card-title text-primary">{summary.total_auctions_participated}</h5>
                    <p className="card-text small">Total Participated</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card text-center">
                  <div className="card-body">
                    <h5 className="card-title text-success">{summary.auctions_won}</h5>
                    <p className="card-text small">Awarded</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card text-center">
                  <div className="card-body">
                    <h5 className="card-title text-info">{summary.auctions_shortlisted}</h5>
                    <p className="card-text small">Shortlisted</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card text-center">
                  <div className="card-body">
                    <h5 className="card-title text-warning">{summary.win_rate}%</h5>
                    <p className="card-text small">Success Rate</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-bordered table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Auction ID</th>
                  <th>Title</th>
                  <th>Bid Amount</th>
                  <th>Result</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={`${item.auction_id}-${index}`}>
                    <td>
                      <strong>{item.auction_id || 'N/A'}</strong>
                    </td>
                    <td>
                      <div className="fw-medium">{item.title || 'Untitled Auction'}</div>
                    </td>
                    <td>
                      <strong className="text-primary">
                        {auctionHistoryService.formatCurrency(item.bid_amount)}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${auctionHistoryService.getResultBadgeClass(item.raw_status)}`}>
                        {auctionHistoryService.getResultIcon(item.raw_status) && (
                          <i className={`${auctionHistoryService.getResultIcon(item.raw_status)} me-1`}></i>
                        )}
                        {item.result}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        {/* Shortlist Notice */}
                        {item.raw_status === 'short-listed' && (
                          <div className="alert alert-info alert-sm p-1 mb-1">
                            <small>
                              <i className="fas fa-info-circle me-1"></i>
                              <strong>Congratulations!</strong> You've been shortlisted. Please prepare your quotation.
                            </small>
                          </div>
                        )}

                        {/* Disqualification Reason */}
                        {item.disqualification_reason && (
                          <div className="alert alert-danger alert-sm p-1 mb-1">
                            <small>
                              <strong>Reason:</strong> {item.disqualification_reason}
                            </small>
                          </div>
                        )}

                        {/* Cancellation Reason */}
                        {item.cancel_reason && (
                          <div className="alert alert-warning alert-sm p-1 mb-1">
                            <small>
                              <strong>Cancelled:</strong> {item.cancel_reason}
                            </small>
                          </div>
                        )}

                        {/* Award Notice */}
                        {item.raw_status === 'awarded' && (
                          <div className="alert alert-success alert-sm p-1 mb-1">
                            <small>
                              <i className="fas fa-trophy me-1"></i>
                              <strong>Congratulations!</strong> You won this auction. Our team will contact you soon.
                            </small>
                          </div>
                        )}

                        {/* Not Shortlisted Notice */}
                        {item.raw_status === 'not-short-listed' && (
                          <div className="alert alert-secondary alert-sm p-1 mb-1">
                            <small>
                              <i className="fas fa-info-circle me-1"></i>
                              You were not selected for the shortlist this time.
                            </small>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <div className="row">
              <div className="col-md-12 text-center">
                <small className="text-muted">
                  Showing {history.length} auction result{history.length !== 1 ? 's' : ''}
                </small>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuctionHistory;
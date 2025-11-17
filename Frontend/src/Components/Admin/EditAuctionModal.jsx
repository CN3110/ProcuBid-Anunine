import React, { useState, useEffect } from 'react';
import { updateAuction, fetchActiveBidders } from '../../services/auctionService';
import '../../styles/editAuctionModal.css';

const EditAuctionModal = ({ auction, onClose, onSave }) => {
  // State for form data - UPDATED with new fields
  const [formData, setFormData] = useState({
    title: '',
    auction_date: '',
    start_time: '',
    duration_minutes: '',
    ceiling_price: '',      // NEW FIELD
    currency: 'LKR',        // NEW FIELD
    step_amount: '',        // NEW FIELD
    category: '',
    sbu: '',
    special_notices: '',
    selected_bidders: []
  });

  // State for available bidders
  const [availableBidders, setAvailableBidders] = useState([]);
  
  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Currency options
  const currencyOptions = ['LKR', 'USD'];

  // Initialize form data when auction prop changes - UPDATED
 useEffect(() => {
  if (auction) {
    // Parse the date and time for the form inputs
    const auctionDate = auction.auction_date || auction.DateTime?.split(' ')[0] || '';
    const startTime = auction.start_time || auction.DateTime?.split(' ')[1] || '';

    // Debug: Check what bidder data we're receiving
    console.log('Auction bidder data:', auction.auction_bidders);
    console.log('Available bidders:', availableBidders);

    setFormData({
      title: auction.title || auction.Title || '',
      auction_date: auctionDate,
      start_time: startTime,
      duration_minutes: auction.duration_minutes || parseInt(auction.Duration) || '',
      ceiling_price: auction.ceiling_price || '',
      currency: auction.currency || 'LKR',
      step_amount: auction.step_amount || '',
      category: auction.category || '',
      sbu: auction.sbu || '',
      special_notices: auction.special_notices || '',
      selected_bidders: auction.auction_bidders?.map(b => b.bidder_id) || auction.auction_bidders?.map(b => b.id) || []
    });
  }
  
  // Fetch available bidders
  fetchBidders();
}, [auction]);

  /**
   * Fetch all active bidders for selection
   */
  const fetchBidders = async () => {
  try {
    setLoading(true);
    const response = await fetchActiveBidders();
    
    if (response.success) {
      // Ensure bidders have consistent ID field
      const normalizedBidders = response.bidders.map(bidder => ({
        ...bidder,
        id: bidder.id || bidder.bidder_id || bidder.user_id // Normalize ID field
      }));
      setAvailableBidders(normalizedBidders || []);
    } else {
      setError('Failed to fetch available bidders');
    }
  } catch (err) {
    console.error('Error fetching bidders:', err);
    setError('Failed to fetch available bidders');
  } finally {
    setLoading(false);
  }
};

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  /**
   * Handle bidder selection changes
   */
  /**
 * Handle bidder selection changes
 */
const handleBidderSelection = (bidderId) => {
  setFormData(prev => ({
    ...prev,
    selected_bidders: prev.selected_bidders.includes(bidderId)
      ? prev.selected_bidders.filter(id => id !== bidderId)
      : [...prev.selected_bidders, bidderId]
  }));

  // Clear validation error for bidders
  if (validationErrors.selected_bidders) {
    setValidationErrors(prev => ({
      ...prev,
      selected_bidders: null
    }));
  }
};

/**
 * Check if a bidder is selected
 */
const isBidderSelected = (bidder) => {
  // Try multiple possible ID fields
  const bidderIdentifier = bidder.id || bidder.bidder_id || bidder.user_id;
  return formData.selected_bidders.includes(bidderIdentifier);
};

  /**
   * Validate form data - UPDATED with new field validations
   */
  const validateForm = () => {
    const errors = {};

    // Required field validation
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.auction_date) {
      errors.auction_date = 'Auction date is required';
    } else {
      // Check if date is in the future
      const selectedDate = new Date(`${formData.auction_date}T${formData.start_time || '00:00'}`);
      const now = new Date();
      
      if (selectedDate <= now) {
        errors.auction_date = 'Auction date and time must be in the future';
      }
    }

    if (!formData.start_time) {
      errors.start_time = 'Start time is required';
    }

    if (!formData.duration_minutes || formData.duration_minutes < 1) {
      errors.duration_minutes = 'Duration must be at least 1 minute';
    } else if (formData.duration_minutes > 480) {
      errors.duration_minutes = 'Duration cannot exceed 8 hours (480 minutes)';
    }

    // NEW VALIDATIONS
    if (!formData.ceiling_price) {
      errors.ceiling_price = 'Ceiling price is required';
    } else if (parseFloat(formData.ceiling_price) <= 0) {
      errors.ceiling_price = 'Ceiling price must be a positive number';
    }

    if (!formData.currency) {
      errors.currency = 'Currency is required';
    }

    if (!formData.step_amount) {
      errors.step_amount = 'Step amount is required';
    } else if (parseFloat(formData.step_amount) <= 0) {
      errors.step_amount = 'Step amount must be a positive number';
    } else if (parseFloat(formData.step_amount) >= parseFloat(formData.ceiling_price)) {
      errors.step_amount = 'Step amount must be less than ceiling price';
    }

    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    }

    if (!formData.sbu) {
      errors.sbu = 'SBU selection is required';
    }

    if (formData.selected_bidders.length === 0) {
      errors.selected_bidders = 'At least one bidder must be selected';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission - UPDATED
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare the update data - UPDATED
      const updateData = {
        ...formData,
        duration_minutes: parseInt(formData.duration_minutes),
        ceiling_price: parseFloat(formData.ceiling_price),      // NEW FIELD
        step_amount: parseFloat(formData.step_amount),          // NEW FIELD
        created_by_name: auction.created_by // Keep original creator
      };

      // Call the update API
      const response = await updateAuction(auction.id || auction.AuctionID, updateData);

      if (response.success) {
        onSave(); // Notify parent component of successful save
        alert('Auction updated successfully!');
      } else {
        setError(response.error || 'Failed to update auction');
      }
    } catch (err) {
      console.error('Error updating auction:', err);
      setError('Failed to update auction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle modal backdrop click
   */
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Get currency symbol
   */
  const getCurrencySymbol = () => {
    return formData.currency === 'USD' ? '$' : '₨';
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content edit-auction-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <h2>Edit Auction</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="edit-auction-form">
            {/* Basic Information Section */}
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-grid">
                {/* Title */}
                <div className="form-group">
                  <label htmlFor="title">
                    Auction Title <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={validationErrors.title ? 'error' : ''}
                    placeholder="Enter auction title"
                    maxLength={255}
                  />
                  {validationErrors.title && (
                    <span className="error-text">{validationErrors.title}</span>
                  )}
                </div>

                {/* Category */}
                <div className="form-group">
                  <label htmlFor="category">
                    Category <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={validationErrors.category ? 'error' : ''}
                    placeholder="Enter category"
                    maxLength={100}
                  />
                  {validationErrors.category && (
                    <span className="error-text">{validationErrors.category}</span>
                  )}
                </div>

                {/* SBU */}
                <div className="form-group">
                  <label htmlFor="sbu">
                    SBU <span className="required">*</span>
                  </label>
                  <select
                    id="sbu"
                    name="sbu"
                    value={formData.sbu}
                    onChange={handleInputChange}
                    className={validationErrors.sbu ? 'error' : ''}
                  >
                    <option value="">Select SBU</option>
                    <option value="KSPA Paper">KSPA Paper</option>
                    <option value="KSPA Packaging">KSPA Packaging</option>
                    <option value="Ethimale">Ethimale</option>
                    <option value="KSPA Accessories">KSPA Accessories</option>
                    <option value="ATIRE">ATIRE</option>
                  </select>
                  {validationErrors.sbu && (
                    <span className="error-text">{validationErrors.sbu}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="form-section">
              <h3>Schedule Information</h3>
              
              <div className="form-grid">
                {/* Auction Date */}
                <div className="form-group">
                  <label htmlFor="auction_date">
                    Auction Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="auction_date"
                    name="auction_date"
                    value={formData.auction_date}
                    onChange={handleInputChange}
                    className={validationErrors.auction_date ? 'error' : ''}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {validationErrors.auction_date && (
                    <span className="error-text">{validationErrors.auction_date}</span>
                  )}
                </div>

                {/* Start Time */}
                <div className="form-group">
                  <label htmlFor="start_time">
                    Start Time <span className="required">*</span>
                  </label>
                  <input
                    type="time"
                    id="start_time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className={validationErrors.start_time ? 'error' : ''}
                  />
                  {validationErrors.start_time && (
                    <span className="error-text">{validationErrors.start_time}</span>
                  )}
                </div>

                {/* Duration */}
                <div className="form-group">
                  <label htmlFor="duration_minutes">
                    Duration (minutes) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    id="duration_minutes"
                    name="duration_minutes"
                    value={formData.duration_minutes}
                    onChange={handleInputChange}
                    className={validationErrors.duration_minutes ? 'error' : ''}
                    placeholder="Enter duration in minutes"
                    min="1"
                    max="480"
                  />
                  {validationErrors.duration_minutes && (
                    <span className="error-text">{validationErrors.duration_minutes}</span>
                  )}
                </div>
              </div>
            </div>

            {/* NEW SECTION: Pricing Information */}
            <div className="form-section">
              <h3>Pricing Information</h3>
              
              <div className="form-grid form-grid-3">
                {/* Ceiling Price */}
                <div className="form-group">
                  <label htmlFor="ceiling_price">
                    Ceiling Price <span className="required">*</span>
                  </label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">{getCurrencySymbol()}</span>
                    <input
                      type="number"
                      id="ceiling_price"
                      name="ceiling_price"
                      value={formData.ceiling_price}
                      onChange={handleInputChange}
                      className={validationErrors.ceiling_price ? 'error with-prefix' : 'with-prefix'}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {validationErrors.ceiling_price && (
                    <span className="error-text">{validationErrors.ceiling_price}</span>
                  )}
                </div>

                {/* Currency */}
                <div className="form-group">
                  <label htmlFor="currency">
                    Currency <span className="required">*</span>
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className={validationErrors.currency ? 'error' : ''}
                  >
                    {currencyOptions.map(curr => (
                      <option key={curr} value={curr}>
                        {curr} {curr === 'LKR' ? '(₨)' : '($)'}
                      </option>
                    ))}
                  </select>
                  {validationErrors.currency && (
                    <span className="error-text">{validationErrors.currency}</span>
                  )}
                </div>

                {/* Step Amount */}
                <div className="form-group">
                  <label htmlFor="step_amount">
                    Step Amount <span className="required">*</span>
                  </label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">{getCurrencySymbol()}</span>
                    <input
                      type="number"
                      id="step_amount"
                      name="step_amount"
                      value={formData.step_amount}
                      onChange={handleInputChange}
                      className={validationErrors.step_amount ? 'error with-prefix' : 'with-prefix'}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {validationErrors.step_amount && (
                    <span className="error-text">{validationErrors.step_amount}</span>
                  )}
                  <small className="form-hint">
                    Minimum bid decrement amount (must be less than ceiling price)
                  </small>
                </div>
              </div>
            </div>

            {/* Special Notices Section */}
            <div className="form-section">
              <h3>Additional Information</h3>
              
              <div className="form-group">
                <label htmlFor="special_notices">Special Notices</label>
                <textarea
                  id="special_notices"
                  name="special_notices"
                  value={formData.special_notices}
                  onChange={handleInputChange}
                  placeholder="Enter any special notices or instructions for bidders..."
                  rows={4}
                  maxLength={1000}
                />
                <small className="form-hint">
                  {1000 - formData.special_notices.length} characters remaining
                </small>
              </div>
            </div>

            {/* Bidder Selection Section */}
            <div className="form-section">
              <h3>Invited Bidders <span className="required">*</span></h3>
              
              {loading ? (
                <div className="loading-bidders">
                  <p>Loading available bidders...</p>
                </div>
              ) : (
                <div className="bidders-selection">
                  {availableBidders.length === 0 ? (
                    <div className="no-bidders">
                      <p>No active bidders available</p>
                    </div>
                  ) : (
                    <div className="bidders-grid">
                      {availableBidders.map(bidder => (
                        <div 
                          key={bidder.id} 
                          className={`bidder-card ${formData.selected_bidders.includes(bidder.id) ? 'selected' : ''}`}
                          onClick={() => handleBidderSelection(bidder.id)}
                        >
                          <div className="bidder-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.selected_bidders.includes(bidder.id)}
                              onChange={() => handleBidderSelection(bidder.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="bidder-info">
                            <span className="bidder-name">{bidder.name}</span>
                            <span className="bidder-company">{bidder.company || 'No company'}</span>
                            <span className="bidder-email">{bidder.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="selection-summary">
                    <p>{formData.selected_bidders.length} bidder(s) selected</p>
                  </div>
                  
                  {validationErrors.selected_bidders && (
                    <span className="error-text">{validationErrors.selected_bidders}</span>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-info">
            <small>
              <span className="required">*</span> Required fields
            </small>
          </div>
          <div className="footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || loading}
            >
              {saving ? 'Updating...' : 'Update Auction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAuctionModal;
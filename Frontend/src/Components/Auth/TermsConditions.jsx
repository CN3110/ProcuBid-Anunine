// components/TermsAndConditions.jsx
import React, { useState } from 'react';
//import '../../styles/terms.css';

const TermsAndConditions = () => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="terms-container">
      <h2>ProcuBid - E-Auction System Terms and Conditions</h2>
      
      <div className="terms-content">
        <h3>1. Introduction</h3>
        <p>
          Welcome to the "ProcuBid", E-Auction System by Anunine Holdings Pvt Ltd. These Terms and Conditions govern your participation 
          in our reverse auction platform. By accessing or using our system, you agree to be bound by these terms.
        </p>

        <h3>2. Reverse Auction Process</h3>
        <p>
          Our platform operates as a reverse auction system where suppliers compete to offer the lowest price for 
          goods or services. The auction process follows these steps:
        </p>
        <ul>
          <li>Only accounts created by the administrator, and invited bidders, may participate in auctions</li>
          <li>Each auction has a <strong>ceiling price</strong> (maximum starting price) set by the administrator, which represents the highest acceptable bid value</li>
          <li>A <strong>step amount</strong> (bid decrement) is configured for each auction to define the minimum amount by which each subsequent bid must decrease from the previous bid</li>
          <li>Bidders submit decreasing bids during the auction period, adhering to the step amount requirements</li>
          <li>Real-time ranking is displayed but is not final</li>
          <li>The administrator reserves the right to disqualify any bidder for valid reasons</li>
          <li>The bidder with the lowest qualified bid will be awarded the contract</li>
        </ul>

        <h3>3. Bidder Responsibilities</h3>
        <p>
          As a bidder, you agree to:
        </p>
        <ul>
          <li>Maintain the confidentiality of your login credentials provided via email</li>
          <li>Submit bids in good faith with the intention to honor them if awarded</li>
          <li>Ensure your bids comply with the ceiling price and step amount configured for the auction</li>
          <li>Avoid bidding within the last 10 seconds of the auction, as rankings update every 10 minutes</li>
          <li>Comply with all applicable laws and regulations</li>
          <li>Submit relevant documents if shortlisted, after which the administration will decide the final result</li>
          <li>Not engage in collusion or anti-competitive behavior</li>
        </ul>

        <h3>4. Admin Rights and Disqualification</h3>
        <p>
          The auction administrator reserves the right to:
        </p>
        <ul>
          <li>Set appropriate ceiling prices and step amounts for each auction</li>
          <li>Disqualify any bidder for valid reasons and will provide the reason for disqualification</li>
          <li>Cancel an auction at any stage, even after completion</li>
          <li>Make the final determination of the winning bidder</li>
          <li>Modify auction parameters as necessary</li>
        </ul>
        <p className="admin-note">
          <strong>Important Note for Administrators:</strong> When configuring auctions, please ensure that the 
          <strong> step amount is set to commonly used, convenient values</strong> for bidders, such as 
          <strong> 0.01, 0.05, 0.025, 0.10</strong>, or similar increments. This facilitates easier calculation 
          and bid submission for participants, improving the overall auction experience.
        </p>

        <h3>5. Auction Cancellation</h3>
        <p>
          The production team, management, or authorized senior personnel reserve the right to cancel any auction, 
          even after completion, due to:
        </p>
        <ul>
          <li>Changes in business requirements</li>
          <li>Budgetary constraints</li>
          <li>Suspected fraudulent activity</li>
          <li>Force majeure events</li>
        </ul>

        <div className="important-note">
          <p>
            <strong>Note:</strong> The ceiling price and step amount are critical parameters that ensure fair 
            competition and systematic bidding. All participants should review these values before submitting bids.
          </p>
        </div>

        <h3>6. Liability Limitations</h3>
        <p>
          Anunine Holdings Pvt Ltd shall not be liable for:
        </p>
        <ul>
          <li>Technical failures or interruptions in service</li>
          <li>Bidder errors in submitting bids</li>
          <li>Financial losses resulting from auction participation</li>
          <li>Decisions to disqualify or not award a contract</li>
          <li>Auction cancellations</li>
        </ul>

        <h3>7. Governing Law</h3>
        <p>
          These terms shall be governed by and construed in accordance with the laws of the jurisdiction where 
          Anunine Holdings Pvt Ltd is registered.
        </p>
      </div>
    </div>
  );
};

export default TermsAndConditions;
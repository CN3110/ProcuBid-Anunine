const { query, transaction } = require("../Config/database");
const { generateAuctionId } = require("../Utils/generators");
const { sendEmail } = require("../Config/email");
const moment = require("moment-timezone");

// Helper function to get current Sri Lanka time
const getCurrentSLTime = () => {
  return moment().tz("Asia/Colombo");
};

// Helper function to check if auction should be live
const isAuctionLive = (auction) => {
  try {
    if (!auction || !auction.auction_date || !auction.start_time) {
      return false;
    }

    const nowSL = getCurrentSLTime();

    // Handle different date formats
    let auctionDate = auction.auction_date;
    let auctionTime = auction.start_time;

    if (auctionDate instanceof Date) {
      auctionDate = moment(auctionDate).format("YYYY-MM-DD");
    }

    // Convert to string and clean time format
    auctionDate = String(auctionDate);
    auctionTime = String(auctionTime);

    if (auctionTime.includes(".")) {
      auctionTime = auctionTime.split(".")[0];
    }

    // Create start and end datetime
    const startDateTime = moment.tz(
      `${auctionDate} ${auctionTime}`,
      "YYYY-MM-DD HH:mm:ss",
      "Asia/Colombo"
    );
    const endDateTime = startDateTime
      .clone()
      .add(auction.duration_minutes || 0, "minutes");

    if (!startDateTime.isValid()) {
      console.error(
        `Invalid datetime for auction ${auction.auction_id}: ${auctionDate} ${auctionTime}`
      );
      return false;
    }

    // Check if auction is approved and within time bounds
    const isApproved =
      auction.status === "approved" || auction.status === "live";
    const isWithinTimeRange = nowSL.isBetween(
      startDateTime,
      endDateTime,
      null,
      "[]"
    );

    return isApproved && isWithinTimeRange;
  } catch (error) {
    console.error("Error checking if auction is live:", error);
    return false;
  }
};

// Helper function to get auction calculated status
const getAuctionStatus = (auction) => {
  try {
    if (!auction || !auction.auction_date || !auction.start_time) {
      return "error";
    }

    const nowSL = getCurrentSLTime();

    // Handle date/time parsing
    let auctionDate = auction.auction_date;
    let auctionTime = auction.start_time;

    if (auctionDate instanceof Date) {
      auctionDate = moment(auctionDate).format("YYYY-MM-DD");
    }

    auctionDate = String(auctionDate);
    auctionTime = String(auctionTime);

    if (auctionTime.includes(".")) {
      auctionTime = auctionTime.split(".")[0];
    }

    const startDateTime = moment.tz(
      `${auctionDate} ${auctionTime}`,
      "YYYY-MM-DD HH:mm:ss",
      "Asia/Colombo"
    );
    const endDateTime = startDateTime
      .clone()
      .add(auction.duration_minutes || 0, "minutes");

    if (!startDateTime.isValid()) {
      console.error(
        `Cannot parse auction datetime: ${auctionDate} ${auctionTime}`
      );
      return "error";
    }

    // If auction is rejected or pending
    if (auction.status === "rejected" || auction.status === "pending") {
      return auction.status;
    }

    // Time-based status for approved auctions
    if (auction.status === "approved") {
      if (nowSL.isBefore(startDateTime)) {
        return "approved"; // Approved but not started
      } else if (nowSL.isBetween(startDateTime, endDateTime, null, "[]")) {
        return "live"; // Should be live now
      } else {
        return "ended"; // Time has passed
      }
    }

    // For live auctions, check if they should end
    if (auction.status === "live") {
      if (nowSL.isSameOrAfter(endDateTime)) {
        return "ended";
      } else {
        return "live";
      }
    }

    // Default behavior for other statuses
    return auction.status;
  } catch (error) {
    console.error("Error getting auction status:", error);
    return "error";
  }
};

// Create auction function
// Create auction function
const createAuction = async (req, res) => {
  try {
    console.log("Create auction request received");
    console.log("Request user:", req.user);
    console.log("Request body:", req.body);

    // Check authentication
    if (!req.user || !req.user.id) {
      console.log("Authentication failed - no user or user ID");
      return res.status(401).json({
        success: false,
        error: "Authentication required. User not found in request.",
      });
    }

    const {
      title,
      auction_date,
      start_time,
      duration_minutes,
      ceiling_price,
      currency,
      step_amount,
      special_notices,
      selected_bidders,
      category,
      sbu,
      created_by_name,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !auction_date ||
      !start_time ||
      !duration_minutes ||
      !selected_bidders?.length ||
      !category ||
      !sbu ||
      !created_by_name ||
      !ceiling_price ||
      !currency ||
      !step_amount
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: title, auction_date, start_time, duration_minutes, ceiling_price, currency, selected_bidders, category, sbu, or created_by_name",
      });
    }

    // Validate currency
    if (!['LKR', 'USD'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: "Invalid currency. Must be either LKR or USD",
      });
    }

    // Validate ceiling price
    if (isNaN(ceiling_price) || parseFloat(ceiling_price) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Ceiling price must be a positive number",
      });
    }

    // Validate step amount
    if (isNaN(step_amount) || parseFloat(step_amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Step amount must be a positive number",
      });
    }

    // Validate step amount is less than ceiling price
    if (parseFloat(step_amount) >= parseFloat(ceiling_price)) {
      return res.status(400).json({
        success: false,
        error: "Step amount must be less than ceiling price",
      });
    }

    // Validate auction date/time is in future (Sri Lanka time)
    const nowSL = getCurrentSLTime();
    const auctionDateTime = moment.tz(
      `${auction_date} ${start_time}`,
      "YYYY-MM-DD HH:mm:ss",
      "Asia/Colombo"
    );

    if (!auctionDateTime.isValid()) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid date or time format. Use YYYY-MM-DD for date and HH:mm:ss for time",
      });
    }

    if (auctionDateTime.isBefore(nowSL)) {
      return res.status(400).json({
        success: false,
        error: "Auction date and time must be in the future (Sri Lanka time)",
      });
    }

    // Validate selected bidders exist and fetch their details
    console.log("Validating selected bidders:", selected_bidders);
    const { data: validBidders, error: biddersValidationError } = await query(
      `SELECT id, name, email, company FROM users WHERE id IN (${selected_bidders
        .map(() => "?")
        .join(",")}) AND role = 'bidder' AND is_active = TRUE`,
      selected_bidders
    );

    if (biddersValidationError) {
      console.error("Error validating bidders:", biddersValidationError);
      return res.status(400).json({
        success: false,
        error: "Error validating selected bidders",
      });
    }

    if (!validBidders || validBidders.length !== selected_bidders.length) {
      return res.status(400).json({
        success: false,
        error: "One or more selected bidders are invalid or inactive",
      });
    }

    console.log("Valid bidders found:", validBidders);

    // Generate auction ID
    const { data: lastAuction, error: lastAuctionError } = await query(
      "SELECT auction_id FROM auctions ORDER BY auction_id DESC LIMIT 1"
    );

    if (lastAuctionError) {
      console.error("Error fetching last auction ID:", lastAuctionError);
      throw lastAuctionError;
    }

    const auctionId = generateAuctionId(lastAuction?.[0]?.auction_id);
    console.log("Generated auction ID:", auctionId);

    // Create auction with transaction
    const result = await transaction(async (connection) => {
      // Insert auction - starts as 'pending' for approval
      console.log("Creating auction with pending status for approval workflow");

      const [auctionResult] = await connection.execute(
        `INSERT INTO auctions (
          auction_id, 
          title, 
          auction_date, 
          start_time, 
          duration_minutes,
          ceiling_price,
          currency,
          step_amount, 
          special_notices, 
          status,
          category,
          sbu,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          auctionId,
          title,
          auction_date,
          start_time,
          duration_minutes,
          parseFloat(ceiling_price),
          currency,
          parseFloat(step_amount),
          special_notices || null,
          "pending",
          category,
          sbu,
          created_by_name,
        ]
      );

      console.log("Auction inserted with result:", auctionResult);

      // Get the created auction using the UUID id
      const [createdAuction] = await connection.execute(
        "SELECT * FROM auctions WHERE auction_id = ?",
        [auctionId]
      );

      if (!createdAuction.length) {
        throw new Error("Failed to retrieve created auction");
      }

      console.log("Retrieved created auction:", createdAuction[0]);

      // Add selected bidders
      const auctionUUID = createdAuction[0].id;
      const bidderInvites = selected_bidders.map((bidderId) => [
        auctionUUID,
        bidderId,
      ]);

      if (bidderInvites.length > 0) {
        const placeholders = bidderInvites.map(() => "(?, ?)").join(", ");
        const flatValues = bidderInvites.flat();

        console.log("Inserting auction bidders:", flatValues);

        await connection.execute(
          `INSERT INTO auction_bidders (auction_id, bidder_id) VALUES ${placeholders}`,
          flatValues
        );
      }

      return { auction: createdAuction[0], auction_id: auctionId };
    });

    if (result.error) {
      console.error("Transaction error:", result.error);
      throw result.error;
    }

    console.log(
      "Auction created successfully and is pending approval:",
      result.data
    );

    // ===== EMAIL NOTIFICATION SECTION - START =====
    console.log("\n========================================");
    console.log("STARTING EMAIL NOTIFICATION PROCESS");
    console.log("========================================");
    
    // Send email notification to approver - MOVED BEFORE RESPONSE
    let emailSent = false;
    let emailError = null;
    
    try {
      console.log("Step 1: Preparing email data...");
      
      const websiteUrl = process.env.WEBSITE_URL || 'http://23.101.29.218:5173';
      const approvalUrl = `${websiteUrl}`;
      
      console.log("Website URL:", websiteUrl);
      console.log("Approval URL:", approvalUrl);
      
      // Format date and time for display
      console.log("Step 2: Formatting date and time...");
      console.log("Auction Date:", auction_date);
      console.log("Start Time:", start_time);
      
      const baseDate = new Date(auction_date);
      const [hours, minutes] = start_time.split(":").map(Number);
      baseDate.setHours(hours, minutes, 0);

      const day = baseDate.getDate();
      const suffix = ((d) => {
        if (d > 3 && d < 21) return "th";
        switch (d % 10) {
          case 1: return "st";
          case 2: return "nd";
          case 3: return "rd";
          default: return "th";
        }
      })(day);

      const formattedDate = `${day}${suffix} ${baseDate.toLocaleString("en-GB", {
        month: "short",
        year: "numeric",
      })}`;

      const formattedTime = baseDate
        .toLocaleString("en-GB", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(":", ".");

      const displayDateTime = `${formattedDate} @${formattedTime}`;
      
      console.log("Formatted DateTime:", displayDateTime);
      
      console.log("Step 3: Building bidder list for email...");
      
      // Generate HTML for invited bidders list
      let biddersListHTML = '';
      if (validBidders && validBidders.length > 0) {
        biddersListHTML = `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Invited Bidders:</td>
            <td style="padding: 8px 0;">
              <div style="margin-bottom: 5px;">${validBidders.length} bidder(s) invited:</div>
              <ul style="margin: 5px 0; padding-left: 20px;">
                ${validBidders.map(bidder => `
                  <li style="margin-bottom: 3px;">
                    <strong>${bidder.name}</strong> 
                    ${bidder.company ? `- ${bidder.company}` : ''}
                    ${bidder.email ? `<br><small style="color: #666;">${bidder.email}</small>` : ''}
                  </li>
                `).join('')}
              </ul>
            </td>
          </tr>
        `;
      } else {
        biddersListHTML = `
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Invited Bidders:</td>
            <td style="padding: 8px 0;">${selected_bidders.length} bidder(s) - Details not available</td>
          </tr>
        `;
      }
      
      console.log("Step 4: Building email content...");
      
      const emailSubject = `New Auction Created - Approval Required: ${title}`;
      const emailHTML = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">New Auction Created - Approval Required</h2>
  
  <p>A new auction has been created in the ProcuBid E-Auction System and requires your approval.</p>
  
  <div style="background-color: #fafaf8ff; padding: 20px; border-radius: 5px; border-left: 4px solid #c8c8c8ff; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #555;">📋 Auction Details:</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Auction ID:</td>
        <td style="padding: 8px 0;">${auctionId}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Title:</td>
        <td style="padding: 8px 0;">${title}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Category:</td>
        <td style="padding: 8px 0;">${category}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">SBU:</td>
        <td style="padding: 8px 0;">${sbu}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Ceiling Price:</td>
        <td style="padding: 8px 0;">${currency === 'LKR' ? '₨' : '$'} ${parseFloat(ceiling_price).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Step Amount:</td>
        <td style="padding: 8px 0;">${currency === 'LKR' ? '₨' : '$'} ${parseFloat(step_amount).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Date & Time:</td>
        <td style="padding: 8px 0;">${displayDateTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
        <td style="padding: 8px 0;">${duration_minutes} minutes</td>
      </tr>
      ${biddersListHTML}
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Created By:</td>
        <td style="padding: 8px 0;">${created_by_name}</td>
      </tr>
      ${special_notices ? `
      <tr>
        <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Special Notices:</td>
        <td style="padding: 8px 0;">${special_notices}</td>
      </tr>
      ` : ''}
    </table>
  </div>
  
  <div style="background-color: #e8f6ff; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; margin: 20px 0;">
    <p style="margin: 0;"><strong>⚠️ Action Required:</strong></p>
    <p style="margin: 10px 0 0 0;">Please review the auction details and approve or reject this auction. Once approved, bidders will be automatically notified.</p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${approvalUrl}" 
       style="background-color: #007bff; color: white; padding: 12px 30px; 
              text-decoration: none; border-radius: 5px; display: inline-block;
              font-weight: bold;">
      Review and Approve Auction
    </a>
  </div>
  
  
  
  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px;">
    This is an automated notification from the ProcuBid E-Auction System. Please do not reply to this email.
  </p>
</div>
      `;

      console.log("Email Subject:", emailSubject);
      console.log("Email HTML length:", emailHTML.length, "characters");
      console.log("\nStep 5: Calling sendEmail function...");
      console.log("Recipient: chathuni.n@anunine.com");
      
      const emailResult = await sendEmail(
        'chathuninimesha12@gmail.com',
        emailSubject,
        emailHTML
      );

      console.log("\nStep 6: Email result received:");
      console.log("Success:", emailResult.success);
      
      if (emailResult.success) {
        console.log("✓✓✓ APPROVAL EMAIL SENT SUCCESSFULLY! ✓✓✓");
        emailSent = true;
      } else {
        console.error("✗✗✗ APPROVAL EMAIL FAILED! ✗✗✗");
        console.error("Error:", emailResult.error);
        emailError = emailResult.error;
      }
    } catch (error) {
      console.error("✗✗✗ EXCEPTION IN EMAIL PROCESS! ✗✗✗");
      console.error("Error Type:", error.name);
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
      emailError = error;
    }
    
    console.log("========================================");
    console.log("EMAIL NOTIFICATION PROCESS COMPLETE");
    console.log("Email Sent:", emailSent);
    console.log("========================================\n");
    // ===== EMAIL NOTIFICATION SECTION - END =====

    res.json({
      success: true,
      auction: result.data.auction,
      auction_id: result.data.auction_id,
      message:
        "Auction created successfully and is pending approval. Bidders will be notified once approved.",
      email_notification: {
        sent: emailSent,
        error: emailError ? emailError.message : null
      }
    });
  } catch (error) {
    console.error("Create auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get specific auction details
const getAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    console.log("Getting auction details for:", auctionId);

    // Get basic auction details
    const { data: auction, error: auctionError } = await query(
      `
      SELECT 
        a.id,
        a.auction_id,
        a.title,
        a.status,
        a.auction_date,
        a.start_time,
        a.duration_minutes,
        a.ceiling_price,
        a.currency,
        a.step_amount,
        a.created_by,
        a.created_at,
        a.special_notices,
        a.sbu,
        a.category,
        a.updated_at,
        a.approved_by,
        a.approved_at,
        a.rejected_by,
        a.rejected_at,
        a.rejection_reason
      FROM auctions a
      WHERE a.auction_id = ? OR a.id = ?
    `,
      [auctionId, auctionId]
    );

    if (auctionError) {
      console.error("Error fetching auction:", auctionError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch auction details",
      });
    }

    if (!auction || auction.length === 0) {
      console.log("Auction not found:", auctionId);
      return res.status(404).json({
        success: false,
        error: "Auction not found",
      });
    }

    const auctionData = auction[0];
    console.log("Found auction:", auctionData.auction_id);

    // Get invited bidders
    const { data: invitedBidders, error: biddersError } = await query(
      `
      SELECT 
        u.id as bidder_id,
        u.user_id,
        u.name,
        u.company,
        u.email,
        u.phone,
        ab.invited_at
      FROM auction_bidders ab
      JOIN users u ON ab.bidder_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY u.name
    `,
      [auctionData.id]
    );

    if (biddersError) {
      console.error("Error fetching invited bidders:", biddersError);
      auctionData.invited_bidders = [];
    } else {
      auctionData.invited_bidders = invitedBidders || [];
    }

    // Get bid statistics
    const { data: bidStats, error: bidStatsError } = await query(
      `
      SELECT 
        COUNT(*) as total_bids,
        MIN(amount) as lowest_bid,
        MAX(amount) as highest_bid,
        AVG(amount) as average_bid
      FROM bids 
      WHERE auction_id = ?
    `,
      [auctionData.id]
    );

    if (!bidStatsError && bidStats && bidStats.length > 0) {
      auctionData.total_bids = bidStats[0].total_bids || 0;
      auctionData.lowest_bid = bidStats[0].lowest_bid;
      auctionData.highest_bid = bidStats[0].highest_bid;
      auctionData.average_bid = bidStats[0].average_bid;
    } else {
      auctionData.total_bids = 0;
      auctionData.lowest_bid = null;
      auctionData.highest_bid = null;
      auctionData.average_bid = null;
    }

    // Add calculated status and timing info
    try {
      auctionData.calculated_status = getAuctionStatus(auctionData);
      auctionData.is_live = isAuctionLive(auctionData);

      // Add formatted datetime for easier frontend consumption
      if (auctionData.auction_date && auctionData.start_time) {
        const startDateTime = moment.tz(
          `${auctionData.auction_date} ${auctionData.start_time}`,
          "YYYY-MM-DD HH:mm:ss",
          "Asia/Colombo"
        );

        if (startDateTime.isValid()) {
          const endDateTime = startDateTime
            .clone()
            .add(auctionData.duration_minutes || 0, "minutes");

          auctionData.start_datetime_formatted = startDateTime.format(
            "YYYY-MM-DD HH:mm:ss"
          );
          auctionData.end_datetime_formatted = endDateTime.format(
            "YYYY-MM-DD HH:mm:ss"
          );
          auctionData.date_time = `${auctionData.auction_date} ${auctionData.start_time}`;

          if (auctionData.is_live) {
            const nowSL = getCurrentSLTime();
            auctionData.time_remaining_ms = Math.max(
              0,
              endDateTime.diff(nowSL, "milliseconds")
            );
          }
        }
      }
    } catch (statusError) {
      console.error("Error calculating auction status:", statusError);
      auctionData.calculated_status = auctionData.status;
      auctionData.is_live = false;
    }

    res.json({
      success: true,
      auction: auctionData,
      current_time_sl: getCurrentSLTime().format("YYYY-MM-DD HH:mm:ss"),
    });
  } catch (error) {
    console.error("Get auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all auctions (with filtering) - UPDATED for approval workflow
const getAllAuctions = async (req, res) => {
  try {
    const { status, date } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let sql = "";
    let params = [];

    if (userRole === "admin" || userRole === "system_admin") {
      // Admin and System Admin can see all auctions
      sql = "SELECT * FROM auctions";
      if (status) {
        sql += " WHERE status = ?";
        params.push(status);
      }
      if (date) {
        sql += status ? " AND auction_date = ?" : " WHERE auction_date = ?";
        params.push(date);
      }
    } else {
      // Bidders can only see APPROVED auctions they're invited to
      sql = `
        SELECT a.* FROM auctions a
        JOIN auction_bidders ab ON a.id = ab.auction_id
        WHERE ab.bidder_id = ? AND a.status IN ('approved', 'live', 'ended')
      `;
      params.push(userId);

      if (status) {
        sql += " AND a.status = ?";
        params.push(status);
      }
      if (date) {
        sql += " AND a.auction_date = ?";
        params.push(date);
      }
    }

    sql += " ORDER BY auction_date DESC, start_time DESC";

    const { data: auctions, error } = await query(sql, params);

    if (error) {
      console.error("Get auctions error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch auctions",
      });
    }

    // Update status based on current time for each auction
    const auctionsWithUpdatedStatus = auctions.map((auction) => ({
      ...auction,
      calculated_status: getAuctionStatus(auction),
      is_live: isAuctionLive(auction),
    }));

    res.json({
      success: true,
      auctions: auctionsWithUpdatedStatus,
      current_time_sl: getCurrentSLTime().format("YYYY-MM-DD HH:mm:ss"),
    });
  } catch (error) {
    console.error("Get all auctions error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Get all auctions for admin view
const getAllAuctionsAdmin = async (req, res) => {
  try {
    // Get all auctions with invited bidders' names and approval info
    const { data: auctions, error } = await query(`
      SELECT 
        a.auction_id AS AuctionID,
        a.title AS Title,
        a.category,
        a.sbu,
        CONCAT(a.auction_date, ' ', a.start_time) AS DateTime,
        a.duration_minutes AS Duration,
        a.status AS Status,
        a.approved_by,
        a.approved_at,
        a.rejected_by,
        a.rejected_at,
        GROUP_CONCAT(u.name SEPARATOR ', ') AS InvitedBidders
      FROM 
        auctions a
      LEFT JOIN 
        auction_bidders ab ON a.id = ab.auction_id
      LEFT JOIN 
        users u ON ab.bidder_id = u.id
      GROUP BY 
        a.id
      ORDER BY 
        a.auction_date DESC, a.start_time DESC
    `);

    if (error) {
      console.error("Error fetching auctions:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch auctions",
      });
    }

    // Add calculated status for each auction
    const auctionsWithStatus = auctions.map((auction) => {
      // Parse the DateTime back to separate date/time for status calculation
      const [date, time] = auction.DateTime.split(" ");
      const calculatedStatus = getAuctionStatus({
        auction_date: date,
        start_time: time,
        duration_minutes: auction.Duration,
        status: auction.Status,
      });

      return {
        AuctionID: auction.AuctionID,
        Title: auction.Title,
        Category: auction.category,
        SBU: auction.sbu,
        DateTime: auction.DateTime,
        Duration: `${auction.Duration} minutes`,
        Status:
          calculatedStatus.charAt(0).toUpperCase() + calculatedStatus.slice(1),
        InvitedBidders: auction.InvitedBidders || "No bidders invited",
        calculated_status: calculatedStatus,
        approved_by: auction.approved_by,
        approved_at: auction.approved_at,
        rejected_by: auction.rejected_by,
        rejected_at: auction.rejected_at,
      };
    });

    res.status(200).json({
      success: true,
      auctions: auctionsWithStatus,
      current_time_sl: getCurrentSLTime().format("YYYY-MM-DD HH:mm:ss"),
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Approve auction function
const approveAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;

    console.log("Approve auction request:", { auctionId, user: req.user });

    // Check if user is system admin
    if (req.user.role !== "system_admin") {
      return res.status(403).json({
        success: false,
        error: "Only System Administrator can approve auctions",
      });
    }

    // Get the system admin user ID from database
    const { data: sysAdminUser, error: userError } = await query(
      "SELECT id, name, user_id FROM users WHERE user_id = ? AND role = ?",
      ["SYSADMIN", "system_admin"]
    );

    if (userError || !sysAdminUser || sysAdminUser.length === 0) {
      console.error("System admin user not found:", userError);
      return res.status(500).json({
        success: false,
        error: "System administrator user not found in database",
      });
    }

    const approvedByUserId = sysAdminUser[0].id;

    // Get auction with invited bidders
    const { data: auction, error: fetchError } = await query(
      `
      SELECT a.*, 
             GROUP_CONCAT(ab.bidder_id) as bidder_ids
      FROM auctions a
      LEFT JOIN auction_bidders ab ON a.id = ab.auction_id
      WHERE (a.id = ? OR a.auction_id = ?)
      GROUP BY a.id
    `,
      [auctionId, auctionId]
    );

    if (fetchError || !auction || auction.length === 0) {
      console.error("Auction not found:", fetchError);
      return res.status(404).json({
        success: false,
        error: "Auction not found",
      });
    }

    const auctionData = auction[0];

    // Check if auction is in pending status
    if (auctionData.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot approve auction with status: ${auctionData.status}`,
      });
    }

    // Update auction status to approved
    const { error: updateError } = await query(
      `UPDATE auctions SET 
        status = 'approved', 
        approved_by = ?, 
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [approvedByUserId, auctionData.id]
    );

    if (updateError) {
      console.error("Error approving auction:", updateError);
      throw updateError;
    }

    console.log("Auction approved successfully:", auctionData.auction_id);

    // Send email notifications to invited bidders
    if (auctionData.bidder_ids) {
      try {
        const bidderIds = auctionData.bidder_ids.split(",");

        // Get bidder details for email
        const { data: bidders, error: biddersError } = await query(
          `SELECT email, name FROM users WHERE id IN (${bidderIds
            .map(() => "?")
            .join(",")}) AND role = 'bidder' AND is_active = TRUE`,
          bidderIds
        );

        if (!biddersError && bidders && bidders.length > 0) {
          // Format date/time for email in Sri Lanka timezone
          // Build full datetime string safely
          // auction_date is something like "Thu Aug 28 2025 00:00:00 GMT+0530 (India Standard Time)"
          // start_time is something like "12:40:00"

          // 1. Convert auction_date into a Date object
          const baseDate = new Date(auctionData.auction_date);

          // 2. Split time into parts
          const [hours, minutes, seconds] = auctionData.start_time
            .split(":")
            .map(Number);

          // 3. Apply the time to the date
          baseDate.setHours(hours, minutes, seconds || 0);

          // 4. Format day with suffix
          const day = baseDate.getDate();
          const suffix = ((d) => {
            if (d > 3 && d < 21) return "th";
            switch (d % 10) {
              case 1:
                return "st";
              case 2:
                return "nd";
              case 3:
                return "rd";
              default:
                return "th";
            }
          })(day);

          // 5. Format final date
          const formattedDate = `${day}${suffix} ${baseDate.toLocaleString(
            "en-GB",
            {
              month: "short",
              year: "numeric",
            }
          )}`;

          const formattedTime = baseDate
            .toLocaleString("en-GB", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
            .replace(":", ".");

          // 6. Final result
          const displayDateTime = `${formattedDate} @${formattedTime}`;

          // ✅ Email Body (Auction Invitation)
const emailPromises = bidders.map(async (bidder) => {
  const emailHTML = `
<h2>Auction Invitation - ProcuBid E-Auction System</h2>
<p>Dear ${bidder.name},</p>
<p>We are pleased to invite you to participate in the following <strong>E-Auction</strong>, which has been scheduled for bidding:</p>

<div style="background-color: #fafaf8ff; padding: 15px; border-left: 4px solid #c8c8c8ff; margin: 20px 0;">
  <p><strong>📋 Title:</strong> ${auctionData.title}</p>
  <p><strong>🏷️ Category:</strong> ${auctionData.category}</p>
  <p><strong>🏢 SBU:</strong> ${auctionData.sbu}</p>
  <p><strong>📅 Date & Time:</strong> ${displayDateTime}</p>
  <p><strong>⏱️ Duration:</strong> ${auctionData.duration_minutes} minutes</p>
  <p><strong>💰 Ceiling Price:</strong> ${auctionData.currency === 'LKR' ? '₨' : '$'} ${parseFloat(auctionData.ceiling_price).toLocaleString()}</p>
  <p><strong>📊 Step Amount:</strong> ${auctionData.currency === 'LKR' ? '₨' : '$'} ${parseFloat(auctionData.step_amount).toLocaleString()}</p>
  ${
    auctionData.special_notices
      ? `<p><strong>📝 Special Notices:</strong> ${auctionData.special_notices}</p>`
      : ""
  }
</div>

<p>You may access the auction system at: <a href="http://23.101.29.218:5173/" target="_blank">https://procubid.anunine.com/</a></p>

<div style="background-color: #fdffe9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>🚀 Next Steps:</strong></p>
  <ul>
    <li>Login to your account well before the scheduled time.</li>
    <li>Ensure you are prepared to participate once the auction goes live.</li>
    <li>If the auction is not displayed when the scheduled time arrives, please refresh your browser.</li>
    <li>Remember: This is a <strong>reverse auction</strong> — the lowest bid wins!</li>
  </ul>
</div>

<div style="background-color: #e8f6ff; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; margin: 25px 0;">
  <p><strong>ℹ️ Note:</strong></p>
  <ul>
    <li><strong>Ceiling Price</strong> represents the maximum allowable bid value. Bidders must place bids below this price.</li>
    <li><strong>Step Amount</strong> indicates the minimum decrement allowed for each subsequent bid. 
        (e.g., if Step Amount = 0.1, your next bid must be at least 0.1 lower than the previous bid.)</li>
  </ul>
</div>

<p>We look forward to your active participation.</p>
<br>
<p>Best regards,<br>
The ProcuBid E-Auction Team</p>


<hr style="margin: 20px 0;">
<p style="font-size: 12px; color: #666;">
  This is an automated invitation. Please do not reply to this email.
</p>
  `;

            try {
              await sendEmail(
                bidder.email,
                `🎯 Auction Invitation: ${auctionData.title}`,
                emailHTML
              );
              console.log(`Approval email sent to ${bidder.email}`);
            } catch (emailError) {
              console.error(
                `Failed to send approval email to ${bidder.email}:`,
                emailError
              );
            }
          });

          await Promise.all(emailPromises);
          console.log(`Approval emails sent to ${bidders.length} bidders`);
        }
      } catch (emailError) {
        console.error("Error in approval email sending process:", emailError);
        // Don't fail the approval for email errors
      }
    }

    res.json({
      success: true,
      message: "Auction approved successfully and bidders notified",
      auction_id: auctionData.auction_id,
    });
  } catch (error) {
    console.error("Approve auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Reject auction function
const rejectAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { reason } = req.body;
    const rejectedBy = req.user.name || req.user.user_id;

    console.log("Reject auction request:", { auctionId, rejectedBy, reason });

    // Check if user is system admin
    if (req.user.role !== "system_admin") {
      return res.status(403).json({
        success: false,
        error: "Only System Administrator can reject auctions",
      });
    }

    // Get auction
    const { data: auction, error: fetchError } = await query(
      "SELECT * FROM auctions WHERE id = ? OR auction_id = ?",
      [auctionId, auctionId]
    );

    if (fetchError || !auction || auction.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Auction not found",
      });
    }

    const auctionData = auction[0];

    // Check if auction is in pending or approved status
    if (auctionData.status !== "pending" && auctionData.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: `Cannot reject auction with status: ${auctionData.status}`,
      });
    }

    // Update auction status to rejected
    const rejectionNotes = reason ? `Rejected: ${reason}` : null;
    const currentSpecialNotices = auctionData.special_notices;
    const updatedSpecialNotices = rejectionNotes
      ? currentSpecialNotices
        ? `${currentSpecialNotices}\n\n${rejectionNotes}`
        : rejectionNotes
      : currentSpecialNotices;

    const { error: updateError } = await query(
      `UPDATE auctions SET 
        status = 'rejected', 
        rejected_by = ?, 
        rejected_at = CURRENT_TIMESTAMP,
        rejection_reason = ?,
        special_notices = ?,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [rejectedBy, reason, updatedSpecialNotices, auctionData.id]
    );

    if (updateError) {
      console.error("Error rejecting auction:", updateError);
      throw updateError;
    }

    console.log("Auction rejected successfully:", auctionData.auction_id);

    res.json({
      success: true,
      message: "Auction rejected successfully",
      auction_id: auctionData.auction_id,
    });
  } catch (error) {
    console.error("Reject auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Function to update auction statuses based on current time
const updateAuctionStatuses = async () => {
  try {
    console.log("Updating auction statuses...");
    const { data: auctions, error } = await query(
      "SELECT id, auction_id, auction_date, start_time, duration_minutes, status FROM auctions WHERE status IN (?, ?)",
      ["approved", "live"]
    );

    if (error) {
      console.error("Error fetching auctions for status update:", error);
      return;
    }

    const nowSL = getCurrentSLTime();
    console.log(
      "Current SL time for status update:",
      nowSL.format("YYYY-MM-DD HH:mm:ss")
    );

    for (const auction of auctions) {
      let newStatus = auction.status;

      // Only update status for approved auctions
      if (auction.status === "approved") {
        const startDateTime = moment.tz(
          `${auction.auction_date} ${auction.start_time}`,
          "YYYY-MM-DD HH:mm:ss",
          "Asia/Colombo"
        );
        const endDateTime = startDateTime
          .clone()
          .add(auction.duration_minutes, "minutes");

        if (nowSL.isSameOrAfter(startDateTime) && nowSL.isBefore(endDateTime)) {
          newStatus = "live";
        } else if (nowSL.isSameOrAfter(endDateTime)) {
          newStatus = "ended";
        }
      } else if (auction.status === "live") {
        const startDateTime = moment.tz(
          `${auction.auction_date} ${auction.start_time}`,
          "YYYY-MM-DD HH:mm:ss",
          "Asia/Colombo"
        );
        const endDateTime = startDateTime
          .clone()
          .add(auction.duration_minutes, "minutes");

        if (nowSL.isSameOrAfter(endDateTime)) {
          newStatus = "ended";
        }
      }

      // Only update if status has changed
      if (auction.status !== newStatus) {
        await query(
          "UPDATE auctions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [newStatus, auction.id]
        );
        console.log(
          `Updated auction ${auction.auction_id} status from ${auction.status} to ${newStatus}`
        );
      }
    }
  } catch (error) {
    console.error("Error updating auction statuses:", error);
  }
};

// Update auction function
const updateAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const {
      title,
      auction_date,
      start_time,
      duration_minutes,
      ceiling_price,      // NEW FIELD
      step_amount,
      currency,  
      special_notices,
      selected_bidders,
      category,
      sbu,
    } = req.body;

    console.log("Update auction request:", { auctionId, body: req.body });

    // Check authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Get existing auction
    const { data: existingAuction, error: fetchError } = await query(
      "SELECT * FROM auctions WHERE id = ? OR auction_id = ?",
      [auctionId, auctionId]
    );

    if (fetchError || !existingAuction || existingAuction.length === 0) {
      console.error("Auction not found:", fetchError);
      return res.status(404).json({
        success: false,
        error: "Auction not found",
      });
    }

    const auction = existingAuction[0];

    // Check if auction can be updated (not live or ended)
    const auctionStatus = getAuctionStatus(auction);
    if (auctionStatus === "live" || auctionStatus === "ended") {
      return res.status(400).json({
        success: false,
        error: "Cannot update auction that has already started or ended",
      });
    }

    // Validate required fields
    if (
      !title ||
      !auction_date ||
      !start_time ||
      !duration_minutes ||
      !selected_bidders?.length ||
      !category ||
      !sbu ||
       !ceiling_price ||     // NEW VALIDATION
      !currency ||   // NEW VALIDATION
      !step_amount
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    /*Validate SBU
    const allowedSBUs = ["KSPA Paper", "KSPA Packaging", "Ethimale", "KSPA Accessories", "ATIRE"];
    if (!allowedSBUs.includes(sbu)) {
      return res.status(400).json({
        success: false,
        error: "Invalid SBU value",
      });
    }*/

    // Validate auction date/time is in future
    const nowSL = getCurrentSLTime();
    const auctionDateTime = moment.tz(
      `${auction_date} ${start_time}`,
      "YYYY-MM-DD HH:mm:ss",
      "Asia/Colombo"
    );

    if (!auctionDateTime.isValid() || auctionDateTime.isBefore(nowSL)) {
      return res.status(400).json({
        success: false,
        error: "Auction date and time must be in the future",
      });
    }

    // Validate selected bidders
    const { data: validBidders, error: biddersValidationError } = await query(
      `SELECT id FROM users WHERE id IN (${selected_bidders
        .map(() => "?")
        .join(",")}) AND role = 'bidder' AND is_active = TRUE`,
      selected_bidders
    );

    if (
      biddersValidationError ||
      validBidders.length !== selected_bidders.length
    ) {
      return res.status(400).json({
        success: false,
        error: "One or more selected bidders are invalid or inactive",
      });
    }

    // Update auction with transaction
    const result = await transaction(async (connection) => {
      // Update auction details
      await connection.execute(
        `UPDATE auctions SET 
          title = ?, 
          auction_date = ?, 
          start_time = ?, 
          duration_minutes = ?, 
          ceiling_price = ?,
          currency = ?,
          step_amount = ?,
          special_notices = ?, 
          category = ?,
          sbu = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          title,
          auction_date,
          start_time,
          duration_minutes,
          parseFloat(ceiling_price),  // NEW FIELD
          currency,
          parseFloat(step_amount),
          special_notices || null,
          category,
          sbu,
          auction.id,
        ]
      );

      // Update invited bidders - remove existing and add new ones
      await connection.execute(
        "DELETE FROM auction_bidders WHERE auction_id = ?",
        [auction.id]
      );

      if (selected_bidders.length > 0) {
        const bidderInvites = selected_bidders.map((bidderId) => [
          auction.id,
          bidderId,
        ]);
        const placeholders = bidderInvites.map(() => "(?, ?)").join(", ");
        const flatValues = bidderInvites.flat();

        await connection.execute(
          `INSERT INTO auction_bidders (auction_id, bidder_id) VALUES ${placeholders}`,
          flatValues
        );
      }

      // Get updated auction
      const [updatedAuction] = await connection.execute(
        "SELECT * FROM auctions WHERE id = ?",
        [auction.id]
      );

      return updatedAuction[0];
    });

    if (result.error) {
      console.error("Transaction error:", result.error);
      throw result.error;
    }

    console.log("Auction updated successfully:", result.data);

    res.json({
      success: true,
      auction: result.data,
      message: "Auction updated successfully",
    });
  } catch (error) {
    console.error("Update auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete auction function
const deleteAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;

    console.log("Delete auction request:", auctionId);

    // Check authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Get existing auction
    const { data: existingAuction, error: fetchError } = await query(
      "SELECT * FROM auctions WHERE id = ? OR auction_id = ?",
      [auctionId, auctionId]
    );

    if (fetchError || !existingAuction || existingAuction.length === 0) {
      console.error("Auction not found:", fetchError);
      return res.status(404).json({
        success: false,
        error: "Auction not found",
      });
    }

    const auction = existingAuction[0];

    // Check if auction can be deleted
    const auctionStatus = getAuctionStatus(auction);
    if (auctionStatus === "live") {
      return res.status(400).json({
        success: false,
        error: "Cannot delete a live auction",
      });
    }

    // Check if there are any bids
    const { data: existingBids, error: bidsError } = await query(
      "SELECT COUNT(*) as bid_count FROM bids WHERE auction_id = ?",
      [auction.id]
    );

    if (bidsError) {
      console.error("Error checking existing bids:", bidsError);
      return res.status(500).json({
        success: false,
        error: "Error checking auction bids",
      });
    }

    if (existingBids[0].bid_count > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete auction that has received bids",
      });
    }

    // Delete auction with transaction
    const result = await transaction(async (connection) => {
      await connection.execute("DELETE FROM auctions WHERE id = ?", [
        auction.id,
      ]);

      return { deleted: true };
    });

    if (result.error) {
      console.error("Transaction error:", result.error);
      throw result.error;
    }

    console.log("Auction deleted successfully:", auction.auction_id);

    res.json({
      success: true,
      message: "Auction deleted successfully",
    });
  } catch (error) {
    console.error("Delete auction error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createAuction,
  getAuction,
  getAllAuctions,
  getAllAuctionsAdmin,
  approveAuction,
  rejectAuction,
  updateAuction,
  deleteAuction,
  updateAuctionStatuses,
  isAuctionLive,
  getAuctionStatus,
  getCurrentSLTime,
};

# Reporting Features Implementation

## Overview
The reporting system has been successfully implemented with role-based access for Admin and Agent users. Both roles can now view detailed reports on claim work and activities.

---

## Admin Reporting Features

### 1. **Stat Cards (All Claims Dashboard)**
The dashboard now displays 4 interactive stat cards that are **clickable** to view detailed reports:

- **All Claims Card**
  - Shows: Total number of all claims in the portal
  - Click to view: Detailed list of ALL claims with filters
  - Definition: All claims present in the system

- **Pending Card**
  - Shows: Claims that have NOT been worked yet (dateWorked is null) and are not paid
  - Click to view: Detailed list of pending claims
  - Definition: Claims not worked by any agent and not marked as paid

- **Paid Card**
  - Shows: Claims with status = 'PAID' or 'PAID_TO_OTHER_PROV'
  - Click to view: Detailed list of paid claims
  - Definition: Claims that have been fully paid

- **Overdue Card**
  - Shows: Claims where next follow-up date has passed and not paid
  - Click to view: Detailed list of overdue claims
  - Definition: Claims requiring follow-up (nextFollowUp date < today)

### 2. **Agent Selection in Reports**
- Admin can select any agent from the dropdown to view their work report
- Shows claims worked by that specific agent within the selected date range

### 3. **Date Range Filtering**
- Admin can filter by date range (start date to end date)
- Default: Today's date for quick access
- Custom date ranges supported for historical analysis

### 4. **Report Details**
Each report includes:
- **Total Claims Count** - Number of claims in the filtered report
- **Total Balance** - Sum of all balances in the report
- **Detailed Table** with columns:
  - Claim #
  - Patient Name
  - Balance
  - Status (with color-coded badges)
  - Assigned To (Agent name)
  - Date Worked
  - Next Follow-Up Date

### 5. **Export Functionality**
- Click "Export" button to download report as CSV file
- Useful for external analysis or sharing

---

## Agent Reporting Features

### 1. **Personal Daily Report**
- Agents can view their own daily work report
- Shows: "My Daily Report" for the selected date range
- Can only see claims assigned to them

### 2. **Date Range Selection**
- Agents can select custom date ranges
- Useful for:
  - Daily report (single day)
  - Weekly report (7 days)
  - Monthly report (full month)
  - Historical data review

### 3. **Personal Report Details**
Each agent report includes:
- Claims worked by the agent
- Total count of claims worked
- Total balance handled
- Complete work history with:
  - Claim number and patient name
  - Status of each claim
  - When the work was done (date worked)
  - Next follow-up date

### 4. **Export Personal Reports**
- Agents can export their reports as CSV
- Useful for personal records or manager review

---

## Key Metrics (Updated Definitions)

### For Admin:
- **All Claims** = All claims present in the portal
- **Pending** = Claims NOT worked (dateWorked is null) AND not paid
- **Paid** = Claims with status "PAID" or "PAID_TO_OTHER_PROV"
- **Overdue** = Claims where nextFollowUp date has passed AND not paid

### For Agents:
- **My Claims** = All claims assigned to the agent
- **Pending** = Claims with no dateWorked AND not paid
- **Paid** = Claims with status "PAID" or "PAID_TO_OTHER_PROV"
- **Overdue** = Claims where nextFollowUp date has passed AND not paid

---

## How to Use

### For Admin:
1. Login as Admin
2. Click on any stat card (All Claims, Pending, Paid, or Overdue)
3. Reporting modal opens with:
   - Start and End date inputs
   - Agent selection dropdown
   - Generate Report button
4. Select date range and agent (optional)
5. Click "Generate Report"
6. View detailed claims table
7. Click "Export" to download CSV if needed

### For Agents:
1. Login as Agent
2. Click on any stat card (My Claims, Pending, Paid, or Overdue)
3. Reporting modal opens with:
   - Start and End date inputs (no agent selection)
   - Generate Report button
4. Select date range (defaults to today)
5. Click "Generate Report"
6. View their personal claims table
7. Click "Export" to download CSV if needed

---

## Technical Implementation

### Backend (server.js)
New API endpoints added:
- `GET /api/reports/agent/daily/:userId` - Agent's daily report
- `GET /api/reports/agent/:userId` - Agent's custom date range report
- `GET /api/reports/admin/agent/:userId` - Admin viewing agent's report
- `GET /api/reports/admin/claims` - Admin viewing filtered claims
- `GET /api/reports/admin/stats` - Real-time stat card counts

### Frontend (app.js)
New functions:
- `openReportingModal(reportType)` - Opens report with type (all, pending, paid, overdue)
- `closeReportingModal()` - Closes the report modal
- `generateReport()` - Generates report based on filters
- `displayReportData(data)` - Renders report in table format
- `exportReportData()` - Exports report as CSV
- `updateStats()` - Updated logic for new card definitions

### UI (index.html)
- Made stat cards clickable with `onclick="openReportingModal('type')"`
- Added reporting modal with date filters and report table

### Styling (style.css)
- Clickable card hover effects
- Reporting modal styles
- Report table styling with status badges
- Dark mode support for all new elements

---

## Features Summary

✅ **Admin can view:**
- All claims in the system
- Pending claims (not worked)
- Paid claims
- Overdue claims
- Claims for any specific agent
- Custom date ranges
- Export reports as CSV

✅ **Agents can view:**
- Their own daily/custom reports
- Claims they've worked on
- Custom date ranges
- Export their reports as CSV
- Cannot see other agents' claims

✅ **Interactive Features:**
- Clickable stat cards
- Real-time report generation
- Date range filtering
- Agent selection (admin only)
- CSV export functionality
- Status badges with color coding
- Responsive design
- Dark mode support

---

## Data Fields in Reports

Each claim in the report shows:
- **Claim Number** - Unique identifier
- **Patient Name** - Patient associated with claim
- **Balance** - Outstanding balance amount
- **Status** - Current status with color badge
- **Assigned To** - Agent responsible
- **Date Worked** - When the claim was last worked
- **Next Follow-Up Date** - Scheduled follow-up date

---

## Notes

- Reports use the `dateWorked` field to determine when claims were worked
- Pending status is determined by: `dateWorked === null AND status !== 'paid'`
- Overdue status is determined by: `nextFollowUp < today AND status !== 'paid'`
- All timestamps are stored in UTC and converted to local date format
- CSV exports maintain data integrity and formatting

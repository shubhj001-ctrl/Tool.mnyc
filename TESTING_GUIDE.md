# Testing Guide - Reporting Features

## Quick Start Testing

### Prerequisites
- Make sure the application is running
- Have test data with various claim statuses and dates

### Test Scenario 1: Admin Daily Report (All Claims)

**Steps:**
1. Login as Admin (username: yashpal, password: admin123)
2. Click on the **"All Claims"** card (blue icon with count)
3. Notice the reporting modal opens
4. The start and end dates are pre-filled with today's date
5. Agent dropdown is visible (only for admin)
6. Click "Generate Report" button
7. Verify the report table shows all claims in the system
8. Check the totals: Total Claims and Total Balance are calculated
9. Verify each claim shows: Claim #, Patient, Balance, Status, Assigned To, Date Worked, Next Follow-Up

**Expected Result:** ✓ Report displays all claims with correct counts

---

### Test Scenario 2: Admin Pending Claims Report

**Steps:**
1. Still logged in as Admin
2. Click on the **"Pending"** card (yellow icon)
3. Reporting modal opens with same dates
4. Click "Generate Report"
5. Verify the table shows ONLY claims that:
   - Have NOT been worked (dateWorked is null)
   - Are NOT marked as paid

**Expected Result:** ✓ Report shows only unworked, non-paid claims

---

### Test Scenario 3: Admin Paid Claims Report

**Steps:**
1. Still logged in as Admin
2. Click on the **"Paid"** card (green icon)
3. Click "Generate Report"
4. Verify all claims in the table have status = "PAID"

**Expected Result:** ✓ Report shows only paid claims

---

### Test Scenario 4: Admin Overdue Claims Report

**Steps:**
1. Still logged in as Admin
2. Click on the **"Overdue"** card (red icon)
3. Click "Generate Report"
4. Verify claims shown have:
   - Next Follow-Up date in the past (< today)
   - Status is NOT paid

**Expected Result:** ✓ Report shows only overdue claims

---

### Test Scenario 5: Admin - Filter by Specific Agent

**Steps:**
1. Click on any stat card (e.g., "All Claims")
2. In the reporting modal, select an agent from the dropdown
3. Change report type filter to "agent" (if available)
4. Set date range
5. Click "Generate Report"
6. Verify report shows only claims assigned to that agent

**Expected Result:** ✓ Report filtered by selected agent

---

### Test Scenario 6: Admin - Custom Date Range

**Steps:**
1. Click on any stat card
2. Change Start Date to a date 7 days ago
3. Change End Date to today
4. Click "Generate Report"
5. Verify claims shown were worked within that date range

**Expected Result:** ✓ Report respects the custom date range

---

### Test Scenario 7: Agent Daily Report

**Steps:**
1. Logout and login as Agent (username: shubham, password: pass123)
2. Click on any stat card (e.g., "My Claims")
3. Notice:
   - Title shows "My Daily Report" (not a generic report)
   - NO agent dropdown is visible
   - Only dates can be changed
4. Default dates are today
5. Click "Generate Report"
6. Verify report shows only claims assigned to this agent

**Expected Result:** ✓ Agent sees only their own claims, no agent selection option

---

### Test Scenario 8: Agent - Custom Date Range

**Steps:**
1. Still logged in as Agent
2. Click on any stat card
3. Set Start Date to 30 days ago
4. Set End Date to today
5. Click "Generate Report"
6. Verify claims in report were worked between those dates and belong to agent

**Expected Result:** ✓ Agent report respects custom date range

---

### Test Scenario 9: Export Report to CSV

**Steps:**
1. Generate any report (admin or agent)
2. Click "Export" button
3. File downloads as "Report_MM/DD/YYYY.csv"
4. Open the CSV file in Excel or text editor
5. Verify data is properly formatted with columns:
   - Claim #
   - Patient
   - Balance
   - Status
   - Assigned To
   - Date Worked
   - Next Follow-Up

**Expected Result:** ✓ CSV file downloads with proper formatting

---

### Test Scenario 10: Clickable Cards Visual Feedback

**Steps:**
1. Hover over any stat card
2. Observe the card animation:
   - Card rises slightly (translateY)
   - Card background changes to primary color
   - Text becomes white
   - Icon scales slightly larger
3. Move cursor away
4. Card returns to normal

**Expected Result:** ✓ All hover effects work smoothly

---

### Test Scenario 11: Empty Report Handling

**Steps:**
1. As Admin or Agent
2. Click on a stat card
3. Set a date range far in the past (e.g., year 2000)
4. Click "Generate Report"
5. If no claims match, verify:
   - Stats section is hidden
   - Table is hidden
   - Empty state message displays: "No claims found for the selected criteria"

**Expected Result:** ✓ Proper empty state display

---

### Test Scenario 12: Dark Mode Support

**Steps:**
1. Click the theme toggle (moon/sun icon) in the header
2. Switch to dark mode
3. Click on a stat card to open reporting modal
4. Verify all elements are properly styled in dark mode:
   - Filter inputs have dark background
   - Report table has proper contrast
   - Status badges are visible
   - Text is readable

**Expected Result:** ✓ Dark mode styling applied correctly

---

### Test Scenario 13: Stat Card Values Accuracy

**Steps:**
1. As Admin, note the counts on each card:
   - All Claims: [X]
   - Pending: [Y]
   - Paid: [Z]
   - Overdue: [W]
2. Click each card and verify the count matches:
   - All Claims count = number of rows in table
   - Pending count = rows with dateWorked null
   - Paid count = rows with status = "PAID"
   - Overdue count = rows with nextFollowUp < today

**Expected Result:** ✓ All card counts match actual report data

---

### Test Scenario 14: Status Badges Coloring

**Steps:**
1. Generate any report
2. Look at the Status column
3. Verify color coding:
   - "PAID" = Green badge
   - "PENDING" / "INPRCS" / "WAITING" = Yellow badge
   - "OVERDUE" entries = Red badge
   - Other statuses = appropriate badge

**Expected Result:** ✓ All status badges display with correct colors

---

### Test Scenario 15: Report Modal Close Functionality

**Steps:**
1. Open a reporting modal by clicking a stat card
2. Click the "X" button in the top right
3. Modal should close with animation
4. Verify background overlay is removed

**Expected Result:** ✓ Modal closes properly

---

## Troubleshooting

### Issue: Empty report always shown
- **Check:** Do you have test data with claims that have dateWorked values?
- **Solution:** Add test claims with dates via the admin import/add feature

### Issue: Stat cards not clickable
- **Check:** Browser console for JavaScript errors
- **Solution:** Clear browser cache and refresh page

### Issue: Dates not filtering correctly
- **Check:** Claim dateWorked field is properly set
- **Solution:** Ensure claims have valid date values

### Issue: Agent dropdown not showing for admin
- **Check:** Confirm logged in as admin user
- **Solution:** Refresh page and try again

---

## Expected Data Format

For best testing results, ensure your test claims have:
```
{
  claimNo: "CLM001",
  patient: "John Doe",
  balance: 750,
  status: "PAID",  // or "INPRCS", "WAITING", etc.
  dateWorked: "2025-01-21T10:30:00Z",  // ISO format date
  nextFollowUp: "2025-01-28T00:00:00Z",
  assignedTo: "shubham"  // or other agent username
}
```

---

## Notes

- All dates are stored in UTC but displayed in user's local timezone
- Reports are generated in real-time from the database
- CSV exports maintain all formatting and special characters
- Dark mode toggle is persistent (saved to localStorage)
- Report modal can be opened multiple times without issues

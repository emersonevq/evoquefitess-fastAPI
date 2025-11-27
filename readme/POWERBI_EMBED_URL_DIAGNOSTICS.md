# Power BI embedUrl Invalid Error - Diagnostic Guide

## Problem

Getting error: **"Invalid embed URL detected. Either URL hostname or protocol are invalid. Please use Power BI REST APIs to get the valid URL"**

## Root Cause

The Power BI JavaScript client library (`powerbi-client`) validates embedUrls and requires:

1. **HTTPS protocol** (https://app.powerbi.com/...)
2. **Valid Power BI hostname** (app.powerbi.com)
3. **Essential parameters**:
   - `reportId` (required)
   - `groupId` (workspace ID) - recommended
   - `w=2` - embedding type parameter

## Solution Applied

### Backend Changes (backend/ti/api/powerbi.py)

✅ **Fixed embedUrl fallback** to include `groupId`:

```python
# OLD (INCORRECT):
embed_url_value = f"https://app.powerbi.com/reportEmbed?reportId={report_id}&ctid={POWERBI_TENANT_ID}"

# NEW (CORRECT):
embed_url_value = f"https://app.powerbi.com/reportEmbed?reportId={report_id}&groupId={POWERBI_WORKSPACE_ID}&w=2"
```

✅ **Added URL validation** before returning to frontend
✅ **Improved error logging** for diagnostics

### Frontend Changes (frontend/src/pages/sectors/bi/)

✅ **Added embedUrl validation utilities** in `utils/powerbi-debug.ts`
✅ **Enhanced error messages** with detailed diagnostics
✅ **Added debugging information** to browser console

## How to Verify the Fix

### Step 1: Check Backend Debug Endpoint

Visit one of these URLs in your browser to check the exact embedUrl format:

```
http://localhost:8000/api/powerbi/debug/embed-url/{reportId}
```

Example with a real report ID:

```
http://localhost:8000/api/powerbi/debug/embed-url/8799e0cf-fe55-4670-8a67-ceeee9744bc4
```

**Expected Response:**

```json
{
  "status": "✅ Found",
  "report_id": "8799e0cf-fe55-4670-8a67-ceeee9744bc4",
  "embed_url": "https://app.powerbi.com/reportEmbed?reportId=8799e0cf-fe55-4670-8a67-ceeee9744bc4&groupId=69ba8530-10f0-4aab-9365-a02d1007265a&w=2&config=...",
  "embed_url_valid": true,
  "has_groupId": true,
  "has_reportId": true,
  "has_config": true,
  "has_w": true
}
```

### Step 2: Check Frontend Console

When loading a BI dashboard, check your browser's **Developer Console** (F12) for diagnostic logs:

```
[PowerBI] Embed URL Validation
URL: https://app.powerbi.com/reportEmbed?reportId=...
Valid: true
Metadata: {
  hasReportId: true,
  hasGroupId: true,
  hasConfig: true,
  hasW: true,
  protocol: "https",
  hostname: "app.powerbi.com"
}
```

### Step 3: Test Dashboard Loading

Try loading a BI dashboard in the app. You should see:

1. "Logando..." loading state
2. "Carregando dashboard..." loading state
3. Dashboard renders successfully
4. Success confetti animation

## Common Issues & Solutions

### Issue 1: "embedUrl not found in Power BI API response"

**Cause:** Service Principal doesn't have read access to report details
**Solution:**

1. Ensure Service Principal is added to the workspace with at least Viewer role
2. Check Power BI Admin settings allow Service Principal access
3. Run `/api/powerbi/debug/workspace-access` to verify permissions

### Issue 2: "embedUrl missing groupId"

**Cause:** API returned old format embedUrl without groupId
**Solution:** Already fixed! The fallback now includes groupId automatically.

### Issue 3: "embedUrl still shows protocol/hostname errors"

**Cause:** Network proxy or CORS issue might be corrupting the URL
**Solution:**

1. Check browser Network tab (F12) to see full `/powerbi/embed-token/{reportId}` response
2. Verify the full URL is being transmitted correctly
3. Check for any proxy rewriting URL parameters

## Report IDs from Your Workspace

Use these in the debug endpoint:

```
- Análise de OC's: 8799e0cf-fe55-4670-8a67-ceeee9744bc4
- Central de Relacionamento: 837fb0a1-d589-4857-ad9d-44a34fb70b05
- Central de Vendas: 737afc5a-c604-4583-9e71-3f8e81d0f276
- Comercial: 0117fd5b-b3c0-46ff-8c1e-c35ff5d4bb8d
- Fiscal: 34adf0c5-d4ff-49ab-bffd-26eef0df797e
- Controle de Cotas: 4bc4c1aa-b8c5-4a8a-b3a2-2417cdfb17c2
```

## Files Modified

1. **backend/ti/api/powerbi.py**
   - Fixed embedUrl fallback to include groupId
   - Added URL validation
   - Added new debug endpoint: `/powerbi/debug/embed-url/{report_id}`
   - Improved logging

2. **frontend/src/pages/sectors/bi/components/DashboardViewer.tsx**
   - Added embedUrl validation before using
   - Enhanced error messages
   - Added diagnostic logging

3. **frontend/src/pages/sectors/bi/utils/powerbi-debug.ts** (NEW)
   - URL validation function
   - Diagnostic utilities
   - Metadata extraction helpers

## Next Steps if Issue Persists

1. Check `/api/powerbi/debug/workspace-access` - verify Service Principal has access
2. Check `/api/powerbi/debug/embed-url/{reportId}` - verify embedUrl format
3. Open browser F12 DevTools → Console to see detailed error logs
4. Check browser Network tab to see `/powerbi/embed-token/{reportId}` response
5. Look for any 403/404 errors from Power BI API

---

**Modified:** $(date)
**Backend Status:** ✅ Fixed fallback and validation
**Frontend Status:** ✅ Added diagnostics and validation

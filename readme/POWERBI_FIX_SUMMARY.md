# Power BI embedUrl Invalid Error - Fix Summary

## What Was Fixed

The error **"Invalid embed URL detected. Either URL hostname or protocol are invalid"** was caused by incomplete or incorrectly formatted `embedUrl` parameters being sent to the Power BI JavaScript client library.

### Root Cause

The fallback embedUrl was missing critical parameters:

- ❌ OLD: `https://app.powerbi.com/reportEmbed?reportId={id}&ctid={tenant}`
- ✅ NEW: `https://app.powerbi.com/reportEmbed?reportId={id}&groupId={workspace}&w=2`

## Changes Made

### 1. Backend (backend/ti/api/powerbi.py)

**Lines 145-174: Enhanced embedUrl retrieval**

- Added validation that embedUrl starts with `https://`
- Added check that embedUrl is a valid string
- Improved error handling and logging
- **Fixed fallback URL** to include `groupId` and `w=2` parameters

**Lines 563-602: New debug endpoint**

- Added `/api/powerbi/debug/embed-url/{report_id}` endpoint
- Shows exact embedUrl format returned by Power BI API
- Validates URL parameters (has reportId, groupId, config, w)
- Helps diagnose issues

### 2. Frontend (frontend/src/pages/sectors/bi/components/DashboardViewer.tsx)

**Lines 1-6: Added imports**

- Imported validation utilities

**Lines 103-120: Enhanced validation and error handling**

- Validates embedUrl before passing to powerbi-client
- Checks for https:// protocol
- Checks for reportId parameter
- Provides detailed error messages
- Logs diagnostic information to console

### 3. New Utilities (frontend/src/pages/sectors/bi/utils/powerbi-debug.ts)

**Created comprehensive URL validation:**

```typescript
- validateEmbedUrl(url): Validates URL format and required parameters
- logEmbedUrlDiagnostics(url): Logs validation results to console
- extractReportIdFromUrl(url): Extracts reportId from URL
- extractGroupIdFromUrl(url): Extracts groupId from URL
```

## How to Test

### Option 1: Direct Debug Endpoint

Visit in browser: `http://localhost:8000/api/powerbi/debug/embed-url/{reportId}`

Example:

```
http://localhost:8000/api/powerbi/debug/embed-url/8799e0cf-fe55-4670-8a67-ceeee9744bc4
```

Expected response:

```json
{
  "status": "✅ Found",
  "embed_url": "https://app.powerbi.com/reportEmbed?reportId=...&groupId=...&w=2&config=...",
  "embed_url_valid": true,
  "has_groupId": true,
  "has_reportId": true,
  "has_config": true,
  "has_w": true
}
```

### Option 2: Load Dashboard and Check Console

1. Navigate to BI section
2. Try to load a dashboard
3. Press F12 to open Developer Tools
4. Check Console tab for logs

Expected logs:

```
[PowerBI] Embed URL Validation
URL: https://app.powerbi.com/reportEmbed?reportId=...
Valid: true
Metadata: {
  hasReportId: true,
  hasGroupId: true,
  protocol: "https",
  hostname: "app.powerbi.com"
}
```

## What Happens Now

### Before (Broken)

1. Backend returns incomplete embedUrl
2. Frontend passes to powerbi-client
3. powerbi-client rejects with "Invalid embed URL" error ❌

### After (Fixed)

1. Backend retrieves embedUrl from API OR builds correct fallback with `groupId` and `w=2`
2. Backend validates embedUrl before returning
3. Frontend validates embedUrl format
4. Frontend provides detailed error messages if validation fails
5. powerbi-client receives valid embedUrl and embeds report ✅

## Files Modified

- `backend/ti/api/powerbi.py` - Fixed fallback, added validation and debug endpoint
- `frontend/src/pages/sectors/bi/components/DashboardViewer.tsx` - Added validation and diagnostics
- `frontend/src/pages/sectors/bi/utils/powerbi-debug.ts` - New utility file for URL validation

## Documentation

- `POWERBI_EMBED_URL_DIAGNOSTICS.md` - Comprehensive diagnostic guide
- `POWERBI_FIX_SUMMARY.md` - This file

## Next Steps if Issue Persists

1. Check `/api/powerbi/debug/embed-url/{reportId}` response
2. Verify embedUrl has ALL of: reportId, groupId, w, config
3. Check `/api/powerbi/debug/workspace-access` to verify Service Principal access
4. Open browser console (F12) to see validation logs
5. Check Network tab to see full HTTP responses

---

✅ **Backend**: Fixed embedUrl validation and fallback
✅ **Frontend**: Added URL validation and diagnostics
✅ **Documentation**: Complete diagnostic guide provided

# Fixes Being Applied

## 1. Video Countdown Issue
**Problem**: Countdown stuck at 7s after granting camera permissions
**Fix**:
- Add console.log debugging at each step
- Fix async state updates in countdown
- Ensure camera stream is ready before countdown

## 2. Resume Progress on Refresh
**Problem**: Refreshing restarts from Step 1
**Fix**:
- Save current step (`currentStep`) to database
- Load last active step on page refresh
- Auto-navigate to last step

## 3. Screen Share at Start (Intimidation)
**Fix**:
- Request screen share at beginning (Step 1 start)
- Don't record, just request permission
- Show "Screen monitoring active" message

## 4. Camera/Mic from Start (Intimidation)
**Fix**:
- Request camera/mic at Step 1 start
- Show preview in corner throughout assessment
- Only actually record in Step 5

## 5. Admin: Show Correct/Wrong Answers
**Fix**:
- Add correct answer data to DOMAIN_QUESTIONS
- In admin view, show selected answer in red if wrong
- Show correct answer in green
- Display both if candidate got it wrong

## 6. Video Storage Solution
**Current**: Supabase Storage (1GB free, then $0.021/GB/month)
**Recommendation**:
- Keep Supabase for now (very cheap)
- If needed, switch to Google Drive API (15GB free per user)
- Or use Cloudflare R2 (10GB free, no egress fees)

# 🔐 Authentication Services

This folder contains all authentication-related services for Apparel Modest.

## Files

### `otpService.js`
Handles OTP generation, email sending, and verification.
- Generates 6-digit OTP codes
- Sends emails via EmailJS
- Saves OTPs to database
- Verifies OTP codes

### `authService.js`
Handles user authentication and session management.
- User login/logout
- JWT token management
- Session storage
- Role-based access checks

## Setup

### 1. Add EmailJS Library to HTML

Add this to your HTML files (before closing `</body>` tag):

```html
<!-- EmailJS Library -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

<!-- Supabase Library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Supabase Config -->
<script>
    window.SUPABASE_URL = 'YOUR_SUPABASE_URL';
    window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
</script>
<script src="config/supabase.js"></script>

<!-- Auth Services -->
<script src="auth services/otpService.js"></script>
<script src="auth services/authService.js"></script>
```

### 2. Initialize Services

In your JavaScript:

```javascript
// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    authService.init();
});
```

## Usage Examples

### Request OTP

```javascript
const result = await authService.requestOTP('user@example.com');
if (result.success) {
    console.log('OTP sent!');
} else {
    console.error(result.message);
}
```

### Verify OTP and Login

```javascript
const result = await authService.verifyOTPAndLogin('user@example.com', '123456');
if (result.success) {
    console.log('Logged in!', result.user);
    // Redirect to dashboard
} else {
    console.error(result.message);
}
```

### Check if Logged In

```javascript
if (authService.isLoggedIn()) {
    const user = authService.getCurrentUser();
    console.log('Current user:', user);
}
```

### Logout

```javascript
authService.logout();
```

## Configuration

### EmailJS Settings (in `otpService.js`)
- Service ID: Set via `EMAILJS_SERVICE_ID` environment variable
- Template ID: Set via `EMAILJS_TEMPLATE_ID` or `One_Time_Password_Template_ID` environment variable
- Public Key: Set via `EMAILJS_PUBLIC_KEY` or `API_keys_Public_Key` environment variable

### OTP Settings
- Length: 6 digits
- Expiration: 10 minutes



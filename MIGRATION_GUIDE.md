# 🚀 CLEANUP PHASE 1 - MIGRATION GUIDE FOR DEVELOPERS

**Pour migrer ton code vers la nouvelle architecture centralisée**

---

## 1️⃣ Auth & Login

### ❌ OLD WAY (Don't do this)
```javascript
import { login, memberLogin } from '../api/auth.js';

const result = await login(username, password);
localStorage.setItem('token', result.token);
localStorage.setItem('user', JSON.stringify(result.user));
```

### ✅ NEW WAY
```javascript
import { login, memberLogin } from '../api/authService.js';
import { useUser } from '../context/UserContext.jsx';

const { setToken, setUser } = useUser();

const result = await login(username, password);
setToken(result.token);  // Handles localStorage + authService sync
setUser(result.user);
```

---

## 2️⃣ API Calls

### ❌ OLD WAY (Don't do this)
```javascript
import { fetchJson } from '../apiClient.js';

// Token had to be passed manually
const token = localStorage.getItem('token');
const data = await fetchJson('/api/vehicles', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### ✅ NEW WAY
```javascript
import { apiClient } from '../apiClient.js';

// Auth header added automatically
const data = await apiClient.get('/api/vehicles');

// Other methods:
await apiClient.post('/api/vehicles', { name: 'Bus A' });
await apiClient.patch('/api/vehicles/1', { name: 'Bus B' });
await apiClient.delete('/api/vehicles/1');

// For multipart upload:
const formData = new FormData();
formData.append('file', file);
await apiClient.upload('/api/upload', formData);
```

---

## 3️⃣ Permissions

### ❌ OLD WAY (Don't do this)
```javascript
import { usePermissions } from '../hooks/usePermissions.js';
import { useFunctionPermissions } from '../hooks/useFunctionPermissions.js';

// Had to use TWO hooks!
const perms = usePermissions(userId);
const funcs = useFunctionPermissions(userId);

if (perms.loading || funcs.loading) return <Spinner />;
if (perms.hasPermission('CREATE_VEHICLE') && funcs.hasFunction('EDIT_DETAILS')) {
  // ...
}
```

### ✅ NEW WAY
```javascript
import { usePermissions } from '../hooks/usePermissions.unified.js';

// One hook for everything!
const { 
  hasPermission,    // Check single permission
  hasAnyPermission, // Check any of multiple
  hasAllPermissions,
  hasFunction,      // Check function
  hasAnyFunction,
  hasAllFunctions,
  loading,
  error
} = usePermissions(userId);

if (loading) return <Spinner />;
if (error) return <Alert>{error}</Alert>;

if (hasPermission('CREATE_VEHICLE') && hasFunction('EDIT_DETAILS')) {
  // Do something
}

// Or check multiple:
if (hasAnyPermission(['ADMIN', 'MANAGER'])) { /*...*/ }
if (hasAllFunctions(['VIEW', 'EDIT', 'DELETE'])) { /*...*/ }
```

---

## 4️⃣ Token Management

### ❌ OLD WAY (Don't do this)
```javascript
// Token read directly from localStorage everywhere
const token = localStorage.getItem('token');
if (!token) {
  // Navigate to login
}

// No centralized logout
localStorage.removeItem('token');
localStorage.removeItem('user');
```

### ✅ NEW WAY
```javascript
import { useUser } from '../context/UserContext.jsx';

const { token, isAuthenticated, logout } = useUser();

if (!isAuthenticated) {
  // Navigate to login
}

// Centralized logout (clears everywhere)
logout();
```

---

## 5️⃣ Local Storage Management

### ❌ OLD WAY (Don't do this)
```javascript
// Scattered localStorage usage
localStorage.setItem('rbe_api_prefix', '/api');
localStorage.setItem('rbe_api_origin', 'https://...');
localStorage.setItem('permissions_123', JSON.stringify(...));
localStorage.setItem('token', '...');

// No expiry, no cleanup
const data = localStorage.getItem('permissions_123');
```

### ✅ NEW WAY
```javascript
import { StorageManager } from '../api/authService.js';

// Token & User: handled by authService automatically
// Other data: use StorageManager

// Store with auto-expiry
StorageManager.set('my_cache_key', myData);

// Get if fresh (auto-expires after 5 mins)
const data = StorageManager.getIfFresh('my_cache_key');

// Remove specific key
StorageManager.remove('my_cache_key');

// Clear all app cache (keeps token, user, pointages)
StorageManager.clearAppCache();
```

---

## 6️⃣ buildPathCandidates Removal

### ❌ OLD WAY (Don't do this)
```javascript
import { buildPathCandidates } from '../utils/api.js';

const paths = buildPathCandidates('/api/finance/data');
const data = await fetchJsonFirst(paths, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### ✅ NEW WAY
```javascript
import { apiClient } from '../apiClient.js';

// apiClient handles all path variants internally
const data = await apiClient.get('/api/finance/data');
```

---

## 7️⃣ Error Handling

### ❌ OLD WAY (Don't do this)
```javascript
try {
  const response = await fetch(url, { headers });
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  const data = await response.json();
  // ...
} catch (error) {
  // Scattered error handling
}
```

### ✅ NEW WAY
```javascript
// apiClient handles 401 automatically!
try {
  const data = await apiClient.get('/api/data');
  // ...
} catch (error) {
  // 401 already redirected by apiClient
  // You just handle business logic errors
  toast.error(error.message);
}
```

---

## 🔄 Import Migration Checklist

Find-Replace in your component files:

```javascript
// ❌ → ✅

// Auth imports
import { login } from '../api/auth.js'
  → import { login } from '../api/authService.js'

import { loginMember } from '../api/auth.js'
  → import { memberLogin } from '../api/authService.js'

// API client
import { fetchJson } from '../apiClient.js'
  → import { apiClient } from '../apiClient.js'

// Permissions
import { usePermissions } from '../hooks/usePermissions.js'
  → import { usePermissions } from '../hooks/usePermissions.unified.js'

import { useFunctionPermissions } from '../hooks/useFunctionPermissions.js'
  → import { usePermissions } from '../hooks/usePermissions.unified.js'

// User context (same)
import { useUser } from '../context/UserContext.jsx'
  → import { useUser } from '../context/UserContext.jsx'
```

---

## 🎯 Priority Order for Migration

1. **Highest**: Components with `localStorage.getItem('token')` direct calls
   - `AdminFinance.jsx`
   - `MyRBEActions.jsx`
   - `SiteManagement.jsx`
   - `EventsHub.jsx`

2. **High**: Components using `fetchJson`
   - Replace all with `apiClient.get/post/patch/delete`

3. **High**: Components using multiple permission hooks
   - Consolidate to single `usePermissions.unified`

4. **Medium**: Utility functions
   - Update `buildPathCandidates` callers

5. **Low**: Config/constants files
   - Clean up unused API helpers

---

## ✅ Testing Your Migration

After migrating a component:

```javascript
// 1. Console should show new logs format:
// 🔗 GET /api/vehicles
// 📤 POST /api/vehicles
// etc.

// 2. Token should always come from context, never localStorage directly:
// ✅ const { token } = useUser()
// ❌ const token = localStorage.getItem('token')

// 3. Permissions should use single hook:
// ✅ const { hasPermission } = usePermissions(userId)
// ❌ Two separate hooks

// 4. API errors should be handled:
try {
  await apiClient.get(...)
} catch (error) {
  // 401? Already redirected by apiClient
  // 403? Business logic error
  // 500? Server error
}
```

---

## 🐛 Debugging

### Check current token
```javascript
import { tokenManager } from '../api/authService.js';
console.log(tokenManager.getToken());
console.log(localStorage.getItem('token'));  // Should be same
```

### Check permissions cached
```javascript
import { StorageManager } from '../api/authService.js';
console.log(StorageManager.getIfFresh('perms_123'));
console.log(StorageManager.getIfFresh('func_perms_123'));
```

### Monitor auth changes
```javascript
import { tokenManager } from '../api/authService.js';
const unsub = tokenManager.subscribe((newToken) => {
  console.log('Token changed:', newToken);
});
// Later: unsub();
```

---

## 🆘 Troubleshooting

### "apiClient is not defined"
```javascript
// Check import
import { apiClient } from '../apiClient.js';  // ✅ Correct

// Check path (relative to your file)
```

### "usePermissions is not a function"
```javascript
// Check import location
import { usePermissions } from '../hooks/usePermissions.unified.js';  // ✅

// Old import still exists
import { usePermissions } from '../hooks/usePermissions.js';  // ❌ Wrong file
```

### Permissions not updating
```javascript
const perms = usePermissions(userId);

// After permissions change:
perms.refresh();  // Force reload from API

// Or invalidate cache first
perms.invalidateCache();
```

### Token lost after refresh
```javascript
// Make sure UserContext is at top of App:
<UserProvider>
  <App />
</UserProvider>

// Token should hydrate from localStorage on mount
```

---

**Questions?** Check `CLEANUP_PHASE1_SUMMARY.md` for architecture overview.

**Status**: Phase 1 Complete. Phase 2: Bulk migration of all components.

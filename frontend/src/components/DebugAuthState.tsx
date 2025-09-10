import React from 'react';
import { useAuthStore } from '../store/auth';

const DebugAuthState: React.FC = () => {
  const { user, profile, token, isAuthenticated } = useAuthStore();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <h3 className="text-sm font-bold mb-2">🔍 Auth State Debug</h3>
      <div className="text-xs space-y-1">
        <div>
          <strong>Token:</strong> {token ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Authenticated:</strong> {isAuthenticated ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>User:</strong> {user ? `✅ ${user.email}` : '❌ No'}
        </div>
        <div>
          <strong>Profile:</strong> {profile ? `✅ ID: ${profile.id}` : '❌ No'}
        </div>
        {profile && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div><strong>Name:</strong> {profile.name}</div>
            <div><strong>Age:</strong> {profile.age}</div>
            <div><strong>Location:</strong> {profile.location}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugAuthState;

import React from 'react';

export default function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: 12 }}>
      <div className="spinner" aria-hidden="true" style={{ width: 36, height: 36, borderWidth: 4 }}></div>
    </div>
  );
}

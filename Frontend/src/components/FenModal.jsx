// FenModal.jsx
import React from 'react';

const FenModal = ({ show, fenInput, setFenInput, handleSetFen, handleCancel }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md shadow-md w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Set FEN</h2>
        <input
          type="text"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          placeholder="Enter FEN string"
        />
        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition duration-200"
            onClick={handleSetFen}
          >
            Set
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition duration-200"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FenModal;

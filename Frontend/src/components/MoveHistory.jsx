import React from 'react';

const MoveHistory = ({ history, onMoveClick }) => {
  const groupedMoves = [];
  for (let i = 0; i < history.length; i += 2) {
    groupedMoves.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1]
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Move History</h3>
      <div className="moves-container h-[400px] overflow-y-auto border border-gray-200 rounded-lg bg-gray-50">
        <table className="w-full table-auto border-collapse text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="w-[20%] py-3 px-4 text-left font-medium text-gray-700 border-b border-gray-200">Move</th>
              <th className="w-[40%] py-3 px-4 text-left font-medium text-gray-700 border-b border-gray-200">White</th>
              <th className="w-[40%] py-3 px-4 text-left font-medium text-gray-700 border-b border-gray-200">Black</th>
            </tr>
          </thead>
          <tbody>
            {groupedMoves.map((pair) => (
              <tr 
                key={pair.number} 
                className="border-b border-gray-200 last:border-b-0 odd:bg-white even:bg-gray-50 transition-colors duration-200 hover:bg-gray-100"
              >
                <td className="py-3 px-4 text-gray-600 font-medium">{pair.number}.</td>
                <td 
                  className={`py-3 px-4 text-gray-800 ${onMoveClick ? 'cursor-pointer hover:text-gray-900 hover:font-semibold' : 'cursor-default'}`} 
                  onClick={() => onMoveClick && onMoveClick(pair.white)}
                >
                  {pair.white.san}
                </td>
                <td 
                  className={`py-3 px-4 text-gray-800 ${pair.black && onMoveClick ? 'cursor-pointer hover:text-gray-900 hover:font-semibold' : 'cursor-default'}`} 
                  onClick={() => pair.black && onMoveClick && onMoveClick(pair.black)}
                >
                  {pair.black ? pair.black.san : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MoveHistory;
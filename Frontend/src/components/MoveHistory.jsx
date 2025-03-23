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
    <div className="analysis-panel">
      <div className="analysis-panel-header">Move History</div>
      <div className="move-history h-[300px] overflow-y-auto pr-2">
        {groupedMoves.length > 0 ? (
          <table className="w-full">
            <thead className="bg-[rgba(255,255,255,0.05)] sticky top-0 z-10">
              <tr>
                <th className="w-[20%] py-2 px-3 text-left font-medium text-gray-300 text-sm">#</th>
                <th className="w-[40%] py-2 px-3 text-left font-medium text-gray-300 text-sm">White</th>
                <th className="w-[40%] py-2 px-3 text-left font-medium text-gray-300 text-sm">Black</th>
              </tr>
            </thead>
            <tbody>
              {groupedMoves.map((pair) => (
                <tr 
                  key={pair.number} 
                  className="border-b border-[rgba(255,255,255,0.05)] last:border-b-0 hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <td className="py-2 px-3 text-accent-color font-medium">{pair.number}.</td>
                  <td 
                    className={`py-2 px-3 text-gray-200 ${onMoveClick ? 'cursor-pointer hover:text-white hover:font-medium' : 'cursor-default'}`} 
                    onClick={() => onMoveClick && onMoveClick(pair.white)}
                  >
                    {pair.white.san}
                  </td>
                  <td 
                    className={`py-2 px-3 text-gray-200 ${pair.black && onMoveClick ? 'cursor-pointer hover:text-white hover:font-medium' : 'cursor-default'}`} 
                    onClick={() => pair.black && onMoveClick && onMoveClick(pair.black)}
                  >
                    {pair.black ? pair.black.san : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 italic">No moves yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoveHistory;
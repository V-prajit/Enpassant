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
    <div className="bg-white p-5 rounded-md shadow-md border border-gray-300">
      <h3 className="text-lg font-bold mb-4">Move History</h3>
      <div className="moves-container h-[300px] overflow-y-auto border border-gray-200 rounded-md">
        <table className="w-full table-auto border-collapse border border-gray-200">
          <thead>
            <tr>
              <th className="w-[20%] py-2 border-b border-gray-200">Move</th>
              <th className="w-[40%] py-2 border-b border-gray-200">White</th>
              <th className="w-[40%] py-2 border-b border-gray-200">Black</th>
            </tr>
          </thead>
          <tbody>
            {groupedMoves.map((pair) => (
              <tr key={pair.number}>
                <td className="py-2 border-b border-gray-200">{pair.number}.</td>
                <td 
                  className={`py-2 cursor-pointer border-b border-gray-200 ${onMoveClick ? 'hover:text-green-500' : 'cursor-default'}`} 
                  onClick={() => onMoveClick && onMoveClick(pair.white)}
                >
                  {pair.white.san}
                </td>
                <td 
                  className={`py-2 cursor-pointer border-b border-gray-200 ${pair.black && onMoveClick ? 'hover:text-green-500' : 'cursor-default'}`} 
                  onClick={() => pair.black && onMoveClick && onMoveClick(pair.black)}
                >
                  {pair.black ? pair.black.san : ''}
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

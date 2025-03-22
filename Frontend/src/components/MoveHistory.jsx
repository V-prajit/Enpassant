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
      <div className="move-history">
        <h3>Move History</h3>
        <div className="moves-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Move</th>
                <th style={{ width: '40%' }}>White</th>
                <th style={{ width: '40%' }}>Black</th>
              </tr>
            </thead>
            <tbody>
              {groupedMoves.map((pair) => (
                <tr key={pair.number}>
                  <td>{pair.number}.</td>
                  <td 
                    onClick={() => onMoveClick && onMoveClick(pair.white)} 
                    style={{ cursor: onMoveClick ? 'pointer' : 'default' }}
                  >
                    {pair.white.san}
                  </td>
                  <td 
                    onClick={() => pair.black && onMoveClick && onMoveClick(pair.black)} 
                    style={{ cursor: pair.black && onMoveClick ? 'pointer' : 'default' }}
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